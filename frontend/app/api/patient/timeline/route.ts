import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { requirePatientSession } from "@/lib/serverAuth";
import { getPatientIds, getPrimaryPatientId } from "@/lib/patientScope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user, payload } = authResult;

    const patientIds = getPatientIds(user);
    const patientId = getPrimaryPatientId(user);
    if (!patientId || patientIds.length === 0) {
      return NextResponse.json({
        success: true,
        events: [],
        timelineEvents: [],
        total: 0,
        conflictsCount: 0,
      });
    }

    // 1. Fetch User's Documents from patient summary
    const documents = await query(
      `SELECT d.id, d."originalName", d."storedFilename", d."documentType", d.status, d."uploadedAt", d."filePath",
              a.summary, a."structuredResult"
       FROM "Document" d
       LEFT JOIN "Analysis" a ON d.id = a."documentId"
       WHERE (d."userId" = $1 OR d."patientId" = ANY($2::text[]))
         AND d.status != 'DISCARDED'
       ORDER BY d."uploadedAt" DESC;`,
      [payload.userId, patientIds]
    );

    // 1. Query patient's custom/verified timeline events first
    let customEvents: any[] = [];
    try {
      customEvents = await query(
        `SELECT id, patient_id, user_id, event_date, category, title, description,
                source, reliability, verification_status, facility, doctor, reference_id,
                is_conflicting, conflict_details, created_at
         FROM patient_timeline_events
         WHERE patient_id = ANY($1::text[]) OR (patient_id IS NULL AND user_id = $2)
         ORDER BY event_date DESC, id DESC;`,
        [patientIds, payload.userId]
      );
    } catch (e) {
      console.warn("Could not query patient_timeline_events:", e);
    }

    const verifiedRefIds = new Set<string>();
    customEvents.forEach((ev) => {
      if (ev.reference_id) verifiedRefIds.add(String(ev.reference_id).trim().toLowerCase());
    });

    // 2. Track timeline events directly from documents
    const docTimelineEvents: any[] = [];
    documents.forEach((doc) => {
      const sr = doc.structuredResult || {};
      const docDate = sr.date_iso || (doc.uploadedAt ? new Date(doc.uploadedAt).toISOString().split('T')[0] : '2026-09-10');
      const facility = sr.hospital || "City Care Medical Centre";
      const doctor = typeof sr.doctor === 'string' ? sr.doctor : sr.doctor?.name || "Consulting Physician";

      const extractionId = doc.filePath && doc.filePath.startsWith('/extractions/')
        ? doc.filePath.replace('/extractions/', '').trim()
        : String(doc.id);
      const refId = sr.reference_id || `HMS-DOC-${doc.id}`;
      const rxRefId = `HMS-RX-${extractionId}`;

      // Check if this document already has a verified timeline event in the DB
      const hasVerifiedEvent =
        verifiedRefIds.has(rxRefId.toLowerCase()) ||
        verifiedRefIds.has(refId.toLowerCase()) ||
        customEvents.some(
          (ev) =>
            (ev.reference_id === rxRefId || ev.reference_id === refId) &&
            (ev.verification_status === "Prescription Verified" || ev.verification_status === "Hospital Verified")
        );

      if (hasVerifiedEvent && doc.status !== 'CONFIRMED') {
        doc.status = 'CONFIRMED';
      }

      const isConfirmed = doc.status === 'CONFIRMED';

      // If patient_timeline_events already contains an event representing this document, skip adding duplicate
      if (hasVerifiedEvent) {
        return;
      }

      let category = "Consultation";
      const nameLower = (doc.originalName || "").toLowerCase();
      if (sr.medicines && Array.isArray(sr.medicines) && sr.medicines.length > 0) {
        category = "Medication";
      } else if (nameLower.includes("metabolic") || nameLower.includes("electrolytes") || nameLower.includes("thyroid") || nameLower.includes("ratio") || nameLower.includes("panel") || nameLower.includes("urine")) {
        category = "Lab Result";
      } else if (nameLower.includes("x-ray") || nameLower.includes("ultrasound") || nameLower.includes("imaging") || nameLower.includes("parenchyma")) {
        category = "Diagnostic Imaging";
      } else if (nameLower.includes("fundus") || nameLower.includes("ophthalmology") || nameLower.includes("eye")) {
        category = "Clinical Examination";
      } else if (nameLower.includes("cardiovascular") || nameLower.includes("ecg") || nameLower.includes("echo") || nameLower.includes("blood pressure")) {
        category = "Cardiovascular";
      }

      docTimelineEvents.push({
        id: `doc-${doc.id}`,
        document_id: doc.id,
        extraction_id: extractionId,
        patient_id: patientId,
        user_id: payload.userId,
        event_date: docDate,
        category,
        title: isConfirmed ? (doc.originalName || "Clinical Encounter Record") : (doc.originalName || "Prescription Scan (Draft)"),
        description: doc.summary || (isConfirmed ? "Verified medical record stored in patient electronic health summary." : "Prescription scan awaiting patient review and confirmation."),
        source: isConfirmed ? "Prescription Scan" : "Uploaded Document",
        reliability: isConfirmed ? "High" : "Pending Review",
        verification_status: isConfirmed ? "Prescription Verified" : "Awaiting Review",
        facility,
        doctor,
        reference_id: refId,
        is_conflicting: false,
        conflict_details: null,
        created_at: doc.uploadedAt,
        status: doc.status,
      });
    });

    const seenTl = new Set<string>();
    const unifiedTimeline: any[] = [];
    [...customEvents, ...docTimelineEvents].forEach((item) => {
      const titleDateKey = `${(item.title || '').trim().toLowerCase()}_${item.event_date ? item.event_date.toString().slice(0, 10) : ''}`;
      const refKey = item.reference_id ? `ref_${String(item.reference_id).trim().toLowerCase()}` : '';
      if (!seenTl.has(titleDateKey) && (!refKey || !seenTl.has(refKey))) {
        seenTl.add(titleDateKey);
        if (refKey) seenTl.add(refKey);
        unifiedTimeline.push(item);
      }
    });
    unifiedTimeline.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

    return NextResponse.json({
      success: true,
      events: unifiedTimeline,
      timelineEvents: unifiedTimeline,
      total: unifiedTimeline.length,
      conflictsCount: unifiedTimeline.filter(e => e.is_conflicting).length,
    });
  } catch (error: any) {
    console.error("Timeline API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load medical timeline" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user, payload } = authResult;

    const body = await req.json().catch(() => ({}));
    const {
      event_date,
      category,
      title,
      description,
      source = "Manual Entry",
      reliability = "Low",
      verification_status = "Patient Confirmed",
      facility = "Patient Home Portal",
      doctor,
      reference_id,
      is_conflicting = false,
      conflict_details = null,
    } = body;

    if (!title || !event_date || !category) {
      return NextResponse.json(
        { error: "Date, category, and title are required" },
        { status: 400 }
      );
    }

    const patientId = getPrimaryPatientId(user) || payload.patientId || `P-${payload.userId}`;
    const refId = reference_id || `PATIENT-${category.toUpperCase().replace(/\s+/g, "_")}-${Date.now().toString().slice(-6)}`;
    const docName = doctor || `${payload.name || "Patient"} (Self-Report)`;

    const inserted = await query(
      `INSERT INTO patient_timeline_events 
       (patient_id, user_id, event_date, category, title, description, source, reliability, verification_status, facility, doctor, reference_id, is_conflicting, conflict_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *;`,
      [
        patientId,
        payload.userId,
        event_date,
        category,
        title,
        description || null,
        source,
        reliability,
        verification_status,
        facility,
        docName,
        refId,
        Boolean(is_conflicting),
        conflict_details || null,
      ]
    );

    return NextResponse.json({
      success: true,
      event: inserted[0],
      message: "Timeline event recorded successfully",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Create Timeline Event Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save timeline event" },
      { status: 500 }
    );
  }
}

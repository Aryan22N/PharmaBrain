import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePatientSession } from "@/lib/serverAuth";
import { getPatientIds } from "@/lib/patientScope";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const { id } = await context.params;
    const patientIds = getPatientIds(user);
    const cleanId = String(id).replace(/^doc-/, "").trim();
    const docId = Number(cleanId);

    if (!docId || isNaN(docId)) {
      return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
    }

    // 1. Update Document status to CONFIRMED
    const updatedDocs = await query(
      `UPDATE "Document"
       SET status = 'CONFIRMED'
       WHERE id = $1 AND ("userId" = $2 OR "patientId" = ANY($3::text[]))
       RETURNING id, "filePath", "originalName", status;`,
      [docId, user.id, patientIds]
    );

    if (updatedDocs.length === 0) {
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    const doc = updatedDocs[0];

    // 2. Update Analysis summary
    await query(
      `UPDATE "Analysis"
       SET summary = REGEXP_REPLACE(summary, 'Status: NOT CONFIRMED.*', 'Status: CONFIRMED (Verified EHR Record).')
       WHERE "documentId" = $1;`,
      [docId]
    );

    // 3. If extraction linked, update extraction table as well
    if (doc.filePath && doc.filePath.startsWith("/extractions/")) {
      const extId = Number(doc.filePath.replace("/extractions/", ""));
      if (extId) {
        try {
          await query(
            `UPDATE extractions SET status = 'CONFIRMED' WHERE id = $1;`,
            [extId]
          );
        } catch (_) {}
      }
    }

    // 4. Promote medications & timeline event to active EHR if not already created
    try {
      const anRows = await query(
        `SELECT "structuredResult", summary FROM "Analysis" WHERE "documentId" = $1 LIMIT 1;`,
        [docId]
      );
      if (anRows.length > 0) {
        let sr = anRows[0].structuredResult;
        if (typeof sr === "string") {
          try { sr = JSON.parse(sr); } catch (_) { sr = {}; }
        }
        if (!sr) sr = {};

        const effectivePatientId = user.patientId || patientIds[0] || `P-${user.id}`;
        const eventDate = sr.date_iso || new Date().toISOString().slice(0, 10);
        const doctorStr = typeof sr.doctor === "string" ? sr.doctor : sr.doctor?.name || "Consulting Physician";
        const hospitalStr = sr.hospital || doc.originalName || "City Care Medical Centre";
        const medSummary = (sr.medicines || [])
          .map((m: any) => `${m.name || "Medicine"} ${m.strength || ""}`.trim())
          .filter(Boolean)
          .join(", ");

        await query(
          `INSERT INTO patient_timeline_events (
            patient_id, user_id, event_date, category, title, description,
            source, reliability, verification_status, facility, doctor, reference_id,
            is_conflicting, conflict_details
          ) VALUES ($1, $2, $3, 'Medication', $4, $5, 'Prescription Scan', 'High', 'Prescription Verified', $6, $7, $8, false, null);`,
          [
            effectivePatientId,
            user.id,
            eventDate,
            `Prescription: ${medSummary || doc.originalName || "Verified Rx"}`,
            anRows[0].summary || `Prescribed: ${medSummary}. Verified record.`,
            hospitalStr,
            doctorStr,
            `HMS-DOC-${docId}`,
          ]
        );

        if (Array.isArray(sr.medicines)) {
          for (const med of sr.medicines) {
            if (!med.name) continue;
            await query(
              `INSERT INTO patient_medications (
                patient_id, user_id, name, normalized_name, strength, status, indication,
                frequency, route, start_date, doctor, reference_id, source, reliability,
                verification_status
              ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7, $8, $9, $10, $11, 'Prescription Scan', 'High', 'Prescription Verified');`,
              [
                effectivePatientId,
                user.id,
                med.name.trim(),
                med.name.trim().toLowerCase(),
                med.strength || "",
                sr.diagnosis || "Clinical Management",
                med.frequency || "Once daily",
                med.route || "Oral",
                eventDate,
                doctorStr,
                `HMS-DOC-${docId}`,
              ]
            );
          }
        }
      }
    } catch (promoteErr) {
      console.warn("Could not promote therapies to EHR tables:", promoteErr);
    }

    return NextResponse.json({
      success: true,
      document: doc,
      message: "Document successfully confirmed and verified in EHR.",
    });
  } catch (error: any) {
    console.error("Confirm Document Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm document" },
      { status: 500 }
    );
  }
}

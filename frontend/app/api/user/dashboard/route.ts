import { NextResponse } from 'next/server';
import { generate9DigitPatientId } from '@/lib/auth';
import { query } from '@/lib/db';
import { requirePatientSession } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await requirePatientSession(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { user } = authResult;

    // Ensure 9-digit patientId is always populated
    let patientCode = user.patientId;
    if (!patientCode) {
      patientCode = generate9DigitPatientId();
      await query(
        `UPDATE "User" SET "patientId" = $1 WHERE id = $2;`,
        [patientCode, user.id]
      );
      user.patientId = patientCode;
    }

    const patientIds = [user.patientId, user.legacyPatientId, patientCode].filter(Boolean);

    // 1. Fetch User's Documents strictly isolated to this patient account
    const documents = await query(
      `SELECT d.id, d."originalName", d."storedFilename", d."documentType", d.status, d."uploadedAt", d."filePath",
              a.summary, a."structuredResult"
       FROM "Document" d
       LEFT JOIN "Analysis" a ON d.id = a."documentId"
       WHERE (d."userId" = $1 OR d."patientId" = ANY($2::text[])) AND d.status != 'DISCARDED'
       ORDER BY d."uploadedAt" DESC;`,
      [user.id, patientIds]
    );

    // 2. Fetch Patient Conditions from DB table
    let conditions: any[] = [];
    try {
      conditions = await query(
        `SELECT id, condition_name, icd10_code, category, status, diagnosed_date, severity, doctor, facility, notes
         FROM patient_conditions
         WHERE patient_id = ANY($1::text[]) OR user_id = $2
         ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, diagnosed_date DESC NULLS LAST, id DESC;`,
        [patientIds, user.id]
      );
    } catch (e) {
      console.warn("Could not query patient_conditions:", e);
    }

    // 3. Fetch Patient Allergies from DB table
    let allergies: any[] = [];
    try {
      allergies = await query(
        `SELECT id, allergen, category, reaction, severity, status, source, verification_status, added_date, notes
         FROM patient_allergies
         WHERE patient_id = ANY($1::text[]) OR user_id = $2
         ORDER BY id DESC;`,
        [patientIds, user.id]
      );
    } catch (e) {
      console.warn("Could not query patient_allergies:", e);
    }

    // 4. Fetch Doctor Access Request from DB table
    let doctorSharing: any = null;
    try {
      const docReqs = await query(
        `SELECT id, doctor_id, doctor_code, doctor_name, doctor_specialization, doctor_hospital,
                status, reason, requested_at, responded_at, expires_at
         FROM patient_access_requests
         WHERE patient_id = $1 OR patient_code = ANY($2::text[])
         ORDER BY CASE WHEN status = 'APPROVED' THEN 0 WHEN status = 'PENDING' THEN 1 ELSE 2 END, requested_at DESC
         LIMIT 1;`,
        [user.id, patientIds]
      );
      if (docReqs.length > 0) {
        doctorSharing = docReqs[0];
      }
    } catch (e) {
      console.warn("Could not query doctor access requests:", e);
    }

    // 5. Query Observations & Biomarkers
    let bloodPressure = "--";
    let lastHbA1c = "--";
    let fastingGlucose = "--";
    let bodyWeight = "--";

    interface BiomarkerMetric {
      latestValue: string;
      numericValue: number | null;
      unit: string;
      date: string | null;
      targetRange: string;
      statusLabel: string;
      trendNote: string;
      history: { value: number; date: string }[];
    }

    const vitalsData: {
      glucose: BiomarkerMetric;
      hba1c: BiomarkerMetric;
      bp: BiomarkerMetric;
      weight: BiomarkerMetric;
    } = {
      glucose: {
        latestValue: "--",
        numericValue: null,
        unit: "mg/dL",
        date: null,
        targetRange: "70 - 130 mg/dL (Fasting)",
        statusLabel: "No data",
        trendNote: "No fasting glucose recorded",
        history: [],
      },
      hba1c: {
        latestValue: "--",
        numericValue: null,
        unit: "%",
        date: null,
        targetRange: "< 7.0 % (Type 2 DM)",
        statusLabel: "No data",
        trendNote: "No HbA1c lab result recorded",
        history: [],
      },
      bp: {
        latestValue: "-- / --",
        numericValue: null,
        unit: "mmHg",
        date: null,
        targetRange: "< 130 / 80 mmHg",
        statusLabel: "No data",
        trendNote: "No blood pressure recorded",
        history: [],
      },
      weight: {
        latestValue: "--",
        numericValue: null,
        unit: "kg",
        date: null,
        targetRange: "62.0 - 72.0 kg (BMI 18.5 - 24.9)",
        statusLabel: "No data",
        trendNote: "No body weight recorded",
        history: [],
      },
    };

    try {
      const allObs = await query(
        `SELECT id, kind, systolic, diastolic, value, unit, obs_date, created_at
         FROM observations
         WHERE patient_id = ANY($1::text[])
         ORDER BY obs_date ASC, id ASC;`,
        [patientIds]
      );

      // Fasting Glucose
      const glucoseRows = allObs.filter(
        (o) => o.kind === "sugar_fasting" || o.kind === "glucose" || o.kind === "sugar_random"
      );
      if (glucoseRows.length > 0) {
        const last = glucoseRows[glucoseRows.length - 1];
        const val = last.value != null ? Math.round(last.value) : null;
        if (val != null) {
          fastingGlucose = `${val} mg/dL`;
          vitalsData.glucose.latestValue = `${val} mg/dL`;
          vitalsData.glucose.numericValue = val;
          vitalsData.glucose.date = last.obs_date || null;
          if (val > 130) {
            vitalsData.glucose.statusLabel = "Above target range";
            vitalsData.glucose.trendNote = val > 160 ? "Elevated • Clinical attention recommended" : "Elevated • Monitor fasting diet";
          } else if (val < 70) {
            vitalsData.glucose.statusLabel = "Below target range";
            vitalsData.glucose.trendNote = "Low fasting glucose alert";
          } else {
            vitalsData.glucose.statusLabel = "Within target range";
            vitalsData.glucose.trendNote = "Well-controlled glycemic baseline";
          }
          vitalsData.glucose.history = glucoseRows.slice(-6).map((r) => ({
            value: r.value || 0,
            date: r.obs_date || "",
          }));
        }
      }

      // HbA1c
      const hba1cRows = allObs.filter((o) => o.kind === "hba1c");
      if (hba1cRows.length > 0) {
        const last = hba1cRows[hba1cRows.length - 1];
        const val = last.value != null ? Number(last.value) : null;
        if (val != null) {
          lastHbA1c = `${val}%`;
          vitalsData.hba1c.latestValue = `${val} %`;
          vitalsData.hba1c.numericValue = val;
          vitalsData.hba1c.date = last.obs_date || null;
          if (val > 7.0) {
            vitalsData.hba1c.statusLabel = "Above target range";
            vitalsData.hba1c.trendNote = val > 8.0 ? "High • Requires glycemic review" : "Slightly elevated";
          } else {
            vitalsData.hba1c.statusLabel = "Optimal control";
            vitalsData.hba1c.trendNote = "Well-managed glycemic target";
          }
          vitalsData.hba1c.history = hba1cRows.slice(-6).map((r) => ({
            value: r.value || 0,
            date: r.obs_date || "",
          }));
        }
      }

      // BP
      const bpRows = allObs.filter((o) => o.kind === "bp");
      if (bpRows.length > 0) {
        const last = bpRows[bpRows.length - 1];
        const sys = last.systolic ? Math.round(last.systolic) : null;
        const dia = last.diastolic ? Math.round(last.diastolic) : null;
        if (sys && dia) {
          bloodPressure = `${sys}/${dia} mmHg`;
          vitalsData.bp.latestValue = `${sys} / ${dia}`;
          vitalsData.bp.numericValue = sys;
          vitalsData.bp.date = last.obs_date || null;
          if (sys >= 140 || dia >= 90) {
            vitalsData.bp.statusLabel = "Stage 2 HTN range";
            vitalsData.bp.trendNote = "Needs clinical monitoring";
          } else if (sys >= 130 || dia >= 80) {
            vitalsData.bp.statusLabel = "Stage 1 HTN range";
            vitalsData.bp.trendNote = "Elevated blood pressure";
          } else {
            vitalsData.bp.statusLabel = "Normal BP range";
            vitalsData.bp.trendNote = "Optimal cardiovascular target";
          }
          vitalsData.bp.history = bpRows.slice(-6).map((r) => ({
            value: r.systolic || 0,
            date: r.obs_date || "",
          }));
        }
      }

      // Weight & BMI
      const weightRows = allObs.filter((o) => o.kind === "weight");
      if (weightRows.length > 0) {
        const last = weightRows[weightRows.length - 1];
        const val = last.value != null ? Number(last.value) : null;
        if (val != null) {
          bodyWeight = `${val} kg`;
          const estBmi = (val / (1.75 * 1.75)).toFixed(1);
          vitalsData.weight.latestValue = `${val} kg`;
          vitalsData.weight.numericValue = val;
          vitalsData.weight.date = last.obs_date || null;
          vitalsData.weight.statusLabel = `Stable (BMI ${estBmi})`;
          if (weightRows.length > 1) {
            const prev = weightRows[weightRows.length - 2].value || val;
            const diff = (val - prev).toFixed(1);
            vitalsData.weight.trendNote = Number(diff) < 0 ? `Gradual reduction (${diff} kg)` : Number(diff) > 0 ? `Slight gain (+${diff} kg)` : "Stable trend";
          } else {
            vitalsData.weight.trendNote = "Baseline recorded";
          }
          vitalsData.weight.history = weightRows.slice(-6).map((r) => ({
            value: r.value || 0,
            date: r.obs_date || "",
          }));
        }
      }
    } catch (e) {
      console.warn("Could not query observations:", e);
    }

    // 6. Query Timeline Events & Recorded Medicines from database first
    let timelineEvents: any[] = [];
    let recordedMedicines: any[] = [];
    try {
      timelineEvents = await query(
        `SELECT id, patient_id, user_id, event_date, category, title, description,
                source, reliability, verification_status, facility, doctor, reference_id,
                is_conflicting, conflict_details, created_at
         FROM patient_timeline_events
         WHERE patient_id = ANY($1::text[]) OR user_id = $2
         ORDER BY event_date DESC, id DESC;`,
        [patientIds, user.id]
      );
    } catch (tlErr) {
      console.warn("Could not query patient_timeline_events:", tlErr);
    }

    try {
      recordedMedicines = await query(
        `SELECT id, patient_id, user_id, name, normalized_name, strength, status, indication,
                frequency, route, start_date, expected_end_date, actual_end_date,
                COALESCE(actual_end_date, expected_end_date) AS end_date,
                duration_raw, duration_days, doctor, reference_id,
                reconciliation_category, reconciliation_notes,
                is_conflicting, conflict_details, source, reliability, verification_status, created_at
         FROM patient_medications
         WHERE patient_id = ANY($1::text[]) OR (patient_id IS NULL AND user_id = $2)
         ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, start_date DESC NULLS LAST, id DESC;`,
        [patientIds, user.id]
      );
    } catch (medErr) {
      console.warn("Could not query patient_medications:", medErr);
    }

    // Set of known verified reference IDs from patient_timeline_events
    const verifiedRefIds = new Set<string>();
    timelineEvents.forEach((ev) => {
      if (ev.reference_id) verifiedRefIds.add(String(ev.reference_id).trim().toLowerCase());
    });

    // 7. Track timeline events and medicines directly from documents
    const docTimelineEvents: any[] = [];
    const docMedicines: any[] = [];

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
        timelineEvents.some(
          (ev) =>
            (ev.reference_id === rxRefId || ev.reference_id === refId) &&
            (ev.verification_status === "Prescription Verified" || ev.verification_status === "Hospital Verified")
        );

      if (hasVerifiedEvent && doc.status !== 'CONFIRMED') {
        doc.status = 'CONFIRMED';
      }

      const isConfirmed = doc.status === 'CONFIRMED';

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

      // If patient_timeline_events already contains an event representing this document, skip adding duplicate
      if (hasVerifiedEvent) {
        return;
      }

      docTimelineEvents.push({
        id: `doc-${doc.id}`,
        document_id: doc.id,
        extraction_id: extractionId,
        patient_id: patientCode,
        user_id: user.id,
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

      if (isConfirmed && sr.medicines && Array.isArray(sr.medicines)) {
        sr.medicines.forEach((med: any, idx: number) => {
          if (!med.name) return;
          const medName = med.name.trim();
          const strength = med.strength || med.dose || "";
          const indication = sr.diagnosis || med.indication || (nameLower.includes("hypertension") ? "Hypertension Management" : "Glycemic Control & Metabolic Care");
          const frequency = med.frequency || (med.instructions ? med.instructions : "Once daily");
          const route = med.route || "Oral";

          docMedicines.push({
            id: `doc-med-${doc.id}-${idx}`,
            patient_id: patientCode,
            user_id: user.id,
            name: medName,
            strength,
            status: "ACTIVE",
            indication,
            frequency,
            route,
            start_date: docDate,
            doctor,
            reference_id: refId,
            is_conflicting: false,
            conflict_details: null,
            source: "Prescription Scan",
            reliability: "High",
            verification_status: "Prescription Verified",
            created_at: doc.uploadedAt,
          });
        });
      }
    });

    // Merge & deduplicate timeline events
    const seenTl = new Set<string>();
    const unifiedTimeline: any[] = [];
    [...timelineEvents, ...docTimelineEvents].forEach((item) => {
      const titleDateKey = `${(item.title || '').trim().toLowerCase()}_${item.event_date ? item.event_date.toString().slice(0, 10) : ''}`;
      const refKey = item.reference_id ? `ref_${String(item.reference_id).trim().toLowerCase()}` : '';
      if (!seenTl.has(titleDateKey) && (!refKey || !seenTl.has(refKey))) {
        seenTl.add(titleDateKey);
        if (refKey) seenTl.add(refKey);
        unifiedTimeline.push(item);
      }
    });
    unifiedTimeline.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

    // Merge & deduplicate recorded medicines
    const medMap = new Map<string, any>();
    [...recordedMedicines, ...docMedicines].forEach((m) => {
      const key = (m.name || '').trim().toLowerCase();
      if (!medMap.has(key)) {
        medMap.set(key, m);
      } else {
        const existing = medMap.get(key);
        if (m.is_conflicting || (m.strength && existing.strength && m.strength.toLowerCase() !== existing.strength.toLowerCase())) {
          existing.is_conflicting = true;
          existing.conflict_details = m.conflict_details || existing.conflict_details || `Conflicting dosage: ${existing.strength} vs ${m.strength}`;
        }
      }
    });
    const unifiedMedicines = Array.from(medMap.values());
    unifiedMedicines.sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1));

    const calculatedActiveMeds = unifiedMedicines.filter((m) => m.status === 'ACTIVE').length;
    const totalRecords = documents.length;
    const hospitalVerified = documents.filter((d) => d.status === 'CONFIRMED').length;
    const pendingDocuments = documents.filter((d) => d.status !== 'CONFIRMED' && d.status !== 'DISCARDED');

    const historyCoverage = hospitalVerified > 0 ? `${Math.min(100, Math.round((hospitalVerified / 10) * 100))}%` : "0%";

    const initials = user.name
      ? user.name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : 'RS';

    // 7. Synthesized Longitudinal Summary
    const activeConditionNames = conditions
      .filter((c) => c.status === 'ACTIVE')
      .map((c) => c.condition_name);

    const activeMedNames = unifiedMedicines
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => `${m.name}${m.strength ? ' ' + m.strength : ''}`);

    const longitudinalSummary = {
      diagnoses:
        activeConditionNames.length > 0
          ? `${activeConditionNames.join(' and ')}.`
          : 'No active clinical conditions diagnosed or recorded in health record.',
      glycemicStatus:
        vitalsData.hba1c.numericValue != null || vitalsData.glucose.numericValue != null
          ? `${vitalsData.hba1c.statusLabel} with HbA1c ${vitalsData.hba1c.latestValue} and fasting glucose ${vitalsData.glucose.latestValue}.`
          : 'Glycemic biomarkers not yet documented in laboratory history.',
      regimen:
        activeMedNames.length > 0
          ? `Current active therapy: ${activeMedNames.join(', ')}.`
          : 'No ongoing pharmacotherapy recorded.',
    };

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        patientCode,
        patientId: user.patientId,
        legacyPatientId: user.legacyPatientId || null,
        initials,
        createdAt: user.createdAt,
      },
      metrics: {
        totalRecords: unifiedTimeline.length > 0 ? unifiedTimeline.length : totalRecords,
        hospitalVerified,
        activeMeds: calculatedActiveMeds,
        lastHbA1c,
        bloodPressure,
        historyCoverage,
        activeConditionsCount: conditions.filter((c) => c.status === 'ACTIVE').length,
        recordsToReviewCount: pendingDocuments.length,
      },
      conditions,
      allergies,
      vitals: vitalsData,
      doctorSharing,
      longitudinalSummary,
      timelineEvents: unifiedTimeline,
      recordedMedicines: unifiedMedicines,
      conflictingMedicines: unifiedMedicines.filter((m) => m.is_conflicting || m.status === 'NEEDS_REVIEW'),
      pendingDocuments: pendingDocuments.map((d) => {
        let sr = d.structuredResult;
        if (typeof sr === 'string') {
          try { sr = JSON.parse(sr); } catch (_) { sr = null; }
        }
        const extractionId = d.filePath && d.filePath.startsWith('/extractions/')
          ? d.filePath.replace('/extractions/', '')
          : d.id;
        return {
          id: d.id,
          extractionId,
          filename: d.originalName,
          status: d.status,
          uploadedAt: d.uploadedAt,
          summary: d.summary,
          hospital: sr?.hospital || "External Clinic",
          doctor: typeof sr?.doctor === 'string' ? sr.doctor : sr?.doctor?.name || "Consultant",
          medicinesCount: (sr?.medicines || []).length,
          imageUrl: sr?.image_url || d.filePath || d.storedFilename || "/sample_prescription.png",
        };
      }),
      documents: documents.map((d) => {
        let sr = d.structuredResult;
        if (typeof sr === 'string') {
          try { sr = JSON.parse(sr); } catch (_) { sr = null; }
        }

        let imageUrl: string = "/sample_prescription.png";
        const candidate1 = sr?.image_url;
        if (typeof candidate1 === "string" && candidate1.trim() && candidate1 !== "/sample_prescription.png") {
          imageUrl = candidate1.trim();
        } else if (typeof d.storedFilename === "string" && d.storedFilename.trim() && d.storedFilename !== "/sample_prescription.png") {
          const sf = d.storedFilename.trim();
          if (sf.startsWith("http://") || sf.startsWith("https://") || sf.startsWith("/uploads/")) {
            imageUrl = sf;
          } else if (/\.(jpg|jpeg|png|webp)$/i.test(sf)) {
            imageUrl = `/uploads/${sf}`;
          } else {
            imageUrl = sf;
          }
        } else if (typeof d.filePath === "string" && (d.filePath.startsWith("http://") || d.filePath.startsWith("https://") || d.filePath.startsWith("/uploads/"))) {
          imageUrl = d.filePath.trim();
        }

        return {
          id: d.id,
          filename: d.originalName,
          status: d.status || 'NOT CONFIRMED',
          uploadedAt: d.uploadedAt,
          summary: d.summary || 'Prescription document processed via PaddleOCR pipeline',
          medicines: sr?.medicines || [],
          structuredResult: sr || null,
          filePath: d.filePath || null,
          imageUrl,
        };
      }),
    });
  } catch (error: any) {
    console.error('Dashboard User API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error loading dashboard data' },
      { status: 500 }
    );
  }
}

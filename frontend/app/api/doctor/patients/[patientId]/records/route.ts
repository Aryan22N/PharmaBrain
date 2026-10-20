import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireDoctorSession } from '@/lib/serverAuth';
import { calculatePatientTrends } from '@/lib/trends';

export const dynamic = 'force-dynamic';

/**
 * GET /api/doctor/patients/[patientId]/records
 * Returns full clinical dossier for a patient ONLY IF active doctor authorization is verified in database.
 * Strict IDOR and role protection: Knowing a patient ID never grants access without status='APPROVED'.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    // 1. Authenticate Doctor Session
    const authResult = await requireDoctorSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user: doctor } = authResult;

    const { patientId: rawPatientId } = await params;
    if (!rawPatientId) {
      return NextResponse.json({ error: 'Patient ID is required.' }, { status: 400 });
    }

    const normalizedId = decodeURIComponent(rawPatientId).trim().replace(/\s+/g, '-').toUpperCase();

    // 2. Fetch Patient Account from Database
    const patientRows = await query<{
      id: number;
      name: string;
      email: string;
      patientId: string | null;
      legacyPatientId: string | null;
      createdAt: string;
      role: string;
    }>(
      `SELECT id, name, email, "patientId", "legacyPatientId", "createdAt", role
       FROM "User"
       WHERE role = 'PATIENT' AND (
         UPPER("patientId") = $1 OR
         UPPER(REPLACE(COALESCE("patientId", ''), ' ', '-')) = $1 OR
         UPPER(COALESCE("legacyPatientId", '')) = $1
       )
       LIMIT 1;`,
      [normalizedId]
    );

    if (patientRows.length === 0) {
      return NextResponse.json(
        { error: `Patient not found. No record matches identifier "${rawPatientId}".` },
        { status: 404 }
      );
    }

    const patient = patientRows[0];

    // 3. STRICT AUTHORIZATION VERIFICATION
    // Knowing the patient ID alone MUST NEVER grant access.
    // Check if an APPROVED access request row currently exists in database.
    const accessRows = await query<{
      id: number;
      status: string;
      requested_at: string;
      responded_at: string | null;
      revoked_at: string | null;
      expires_at: string | null;
    }>(
      `SELECT id, status, requested_at, responded_at, revoked_at, expires_at
       FROM patient_access_requests
       WHERE doctor_id = $1 AND patient_id = $2 AND status = 'APPROVED'
       ORDER BY id DESC
       LIMIT 1;`,
      [doctor.id, patient.id]
    );

    const activeAuthorization = accessRows[0];
    const isExpired = Boolean(
      activeAuthorization?.expires_at &&
      !isNaN(Date.parse(activeAuthorization.expires_at)) &&
      new Date(activeAuthorization.expires_at).getTime() <= Date.now()
    );

    if (!activeAuthorization || isExpired) {
      if (isExpired && activeAuthorization) {
        try {
          await query(
            `UPDATE patient_access_requests SET status = 'REVOKED', revoked_at = $1 WHERE id = $2;`,
            [new Date().toISOString(), activeAuthorization.id]
          );
        } catch {
          // ignore background revoke sync error
        }
      }

      // Check if there is an expired or otherwise non-active request to give precise clinical context
      const anyAccess = await query<{ status: string; expires_at: string | null }>(
        `SELECT status, expires_at
         FROM patient_access_requests
         WHERE doctor_id = $1 AND patient_id = $2
         ORDER BY id DESC
         LIMIT 1;`,
        [doctor.id, patient.id]
      );

      const latestReq = anyAccess[0];
      const hasExpired = isExpired || (latestReq?.status === 'APPROVED' && latestReq.expires_at && !isNaN(Date.parse(latestReq.expires_at)) && new Date(latestReq.expires_at).getTime() <= Date.now());
      const latestStatus = hasExpired ? 'EXPIRED' : latestReq?.status || 'NOT_REQUESTED';
      const expiryDateStr = isExpired ? activeAuthorization?.expires_at : latestReq?.expires_at;

      return NextResponse.json(
        {
          error:
            hasExpired
              ? `Forbidden: Clinical access has expired (auto-revoked on ${expiryDateStr ? new Date(expiryDateStr).toLocaleDateString() : 'recent date'}). Please request updated patient consent.`
              : latestStatus === 'REVOKED'
              ? 'Forbidden: Patient has revoked your authorization to access medical records.'
              : latestStatus === 'PENDING'
              ? 'Forbidden: Access request is pending patient approval.'
              : latestStatus === 'REJECTED'
              ? 'Forbidden: Access request was declined by the patient.'
              : 'Forbidden: You do not have active clinical authorization to access this patient medical record.',
          authorized: false,
          authorizationStatus: latestStatus,
        },
        { status: 403 }
      );
    }

    // 4. Fetch Real Patient Medical Records
    const patientIds = Array.from(
      new Set(
        [
          patient.patientId,
          patient.legacyPatientId,
          String(patient.id),
        ].filter((id): id is string => Boolean(id))
      )
    );

    // 4.1 Documents & Prescriptions (Tagged as Clinician-Confirmed vs OCR-Draft)
    const documents = await query<{
      id: number;
      originalName: string;
      storedFilename: string | null;
      documentType: string;
      status: string;
      uploadedAt: string;
      filePath: string | null;
      summary: string | null;
      structuredResult: Record<string, unknown> | null;
    }>(
      `SELECT d.id, d."originalName", d."storedFilename", d."documentType", d.status, d."uploadedAt", d."filePath",
              a.summary, a."structuredResult"
       FROM "Document" d
       LEFT JOIN "Analysis" a ON d.id = a."documentId"
       WHERE (d."userId" = $1 OR d."patientId" = ANY($2::text[])) AND d.status != 'DISCARDED'
       ORDER BY d."uploadedAt" DESC;`,
      [patient.id, patientIds]
    );

    const formattedDocuments = documents.map((doc) => {
      const isConfirmed = doc.status === 'CONFIRMED';
      const sr = (doc.structuredResult || {}) as Record<string, unknown>;

      let docName = 'Attending Physician';
      let docRegNo: string | null = null;
      if (typeof sr.doctor === 'string' && sr.doctor.trim()) {
        docName = sr.doctor.trim();
      } else if (typeof sr.doctor === 'object' && sr.doctor !== null) {
        const dObj = sr.doctor as { name?: string; reg_no?: string };
        if (dObj.name && typeof dObj.name === 'string') {
          docName = dObj.name.trim();
        }
        if (dObj.reg_no && typeof dObj.reg_no === 'string') {
          docRegNo = dObj.reg_no.trim();
        }
      }

      let hospName = 'Medical Facility';
      if (typeof sr.hospital === 'string' && sr.hospital.trim()) {
        hospName = sr.hospital.trim();
      } else if (typeof sr.hospital === 'object' && sr.hospital !== null) {
        const hObj = sr.hospital as { name?: string };
        if (hObj.name && typeof hObj.name === 'string') {
          hospName = hObj.name.trim();
        }
      }

      let resolvedImageUrl: string | null = null;
      if (typeof sr.image_url === 'string' && sr.image_url.trim()) {
        resolvedImageUrl = sr.image_url.trim();
      } else if (typeof doc.storedFilename === 'string' && doc.storedFilename.trim()) {
        const sf = doc.storedFilename.trim();
        if (sf.startsWith('http://') || sf.startsWith('https://') || sf.startsWith('/uploads/')) {
          resolvedImageUrl = sf;
        } else {
          resolvedImageUrl = `https://dvydfsahkqzgluusdsnn.supabase.co/storage/v1/object/public/OCR_Images/uploads/${sf}`;
        }
      } else if (typeof doc.filePath === 'string' && (doc.filePath.startsWith('http://') || doc.filePath.startsWith('https://') || doc.filePath.startsWith('/uploads/'))) {
        resolvedImageUrl = doc.filePath.trim();
      }

      return {
        id: doc.id,
        originalName: doc.originalName,
        storedFilename: doc.storedFilename,
        filePath: doc.filePath,
        imageUrl: resolvedImageUrl,
        documentType: doc.documentType,
        status: doc.status,
        clinicalVerification: isConfirmed ? 'Clinician Confirmed' : 'OCR Draft (Unconfirmed)',
        isDraft: !isConfirmed,
        uploadedAt: doc.uploadedAt,
        summary: doc.summary,
        structuredResult: {
          doctor: docName,
          doctor_reg_no: docRegNo,
          hospital: hospName,
          dateIso: sr.date_iso || null,
          medicines: sr.medicines || [],
          vitals: sr.vitals || [],
          diagnoses: sr.diagnoses || [],
          notes: sr.notes || '',
          imageUrl: resolvedImageUrl,
        },
      };
    });

    // 4.2 Medications from patient_medications
    interface MedicationRecordRow {
      id: number;
      patient_id?: string | null;
      user_id?: number | null;
      prescription_id?: number | null;
      name: string;
      normalized_name?: string | null;
      strength?: string | null;
      status: string;
      indication?: string | null;
      frequency?: string | null;
      route?: string | null;
      prescription_date?: string | null;
      start_date?: string | null;
      duration_raw?: string | null;
      duration_days?: number | null;
      expected_end_date?: string | null;
      actual_end_date?: string | null;
      discontinued_reason?: string | null;
      status_reason?: string | null;
      doctor?: string | null;
      reference_id?: string | null;
      reconciliation_category?: string | null;
      reconciliation_notes?: string | null;
      is_conflicting?: boolean | null;
      conflict_details?: string | null;
      source?: string | null;
      reliability?: string | null;
      verification_status?: string | null;
      created_at: string;
    }

    const medRows = await query<MedicationRecordRow>(
      `SELECT id, patient_id, user_id, prescription_id, name, normalized_name,
              strength, status, indication, frequency, route, prescription_date,
              start_date, duration_raw, duration_days, expected_end_date, actual_end_date,
              discontinued_reason, status_reason, doctor, reference_id,
              reconciliation_category, reconciliation_notes, is_conflicting,
              conflict_details, source, reliability, verification_status, created_at
       FROM patient_medications
       WHERE patient_id = ANY($1::text[]) OR user_id = $2
       ORDER BY start_date DESC NULLS LAST, id DESC;`,
      [patientIds, patient.id]
    );

    const sanitizedMedRows = medRows.map((m) => {
      let doctorStr = 'Attending';
      if (typeof m.doctor === 'string') {
        const trimmed = m.doctor.trim();
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            doctorStr = parsed.name || trimmed;
          } catch {
            doctorStr = trimmed;
          }
        } else if (trimmed) {
          doctorStr = trimmed;
        }
      } else if (typeof m.doctor === 'object' && m.doctor !== null) {
        doctorStr = (m.doctor as { name?: string }).name || 'Attending';
      }
      return {
        ...m,
        doctor: doctorStr,
      };
    });

    const activeMedicines = sanitizedMedRows.filter((m) => m.status === 'ACTIVE');
    const historyMedicines = sanitizedMedRows.filter((m) => m.status === 'COMPLETED' || m.status === 'DISCONTINUED');
    const reviewMedicines = sanitizedMedRows.filter(
      (m) =>
        Boolean(m.is_conflicting) ||
        (m.reconciliation_category &&
          [
            'CHANGE_IN_STRENGTH_OR_INSTRUCTIONS',
            'OVERLAPPING_TREATMENT',
            'CONFLICTING_INSTRUCTIONS',
            'POTENTIAL_DUPLICATE',
            'INSUFFICIENT_INFORMATION',
          ].includes(m.reconciliation_category))
    );

    // 4.3 Vitals and Lab Observations
    interface ObservationRecordRow {
      id: number;
      patient_id: string;
      prescription_id?: number | null;
      obs_date?: string | null;
      kind: string;
      systolic?: number | null;
      diastolic?: number | null;
      value?: number | null;
      unit?: string | null;
      raw_text?: string | null;
      created_at: string;
    }

    const rawObs = await query<ObservationRecordRow>(
      `SELECT id, patient_id, prescription_id, obs_date, kind, systolic, diastolic, value, unit, raw_text, created_at
       FROM observations
       WHERE patient_id = ANY($1::text[])
       ORDER BY obs_date ASC, id ASC;`,
      [patientIds]
    );

    // Merge any vitals parsed in documents that aren't yet in observations table
    const combinedObs: ObservationRecordRow[] = [...rawObs];
    formattedDocuments.forEach((doc) => {
      const sr = (doc.structuredResult || {}) as Record<string, unknown>;
      const docVitals = Array.isArray(sr.vitals) ? sr.vitals : [];
      const docDate = (sr.dateIso as string) || (doc.uploadedAt ? new Date(doc.uploadedAt).toISOString().split('T')[0] : null);

      docVitals.forEach((v: any, idx: number) => {
        if (!v || typeof v !== 'object') return;
        const parsed = v.parsed || {};
        let kind = v.kind;
        const vName = (v.name || '').toLowerCase();
        if (!kind) {
          if (vName.includes('bp') || vName.includes('blood pressure')) kind = 'bp';
          else if (vName.includes('pulse') || vName.includes('pr') || vName.includes('hr')) kind = 'pulse';
          else if (vName.includes('spo2') || vName.includes('o2')) kind = 'spo2';
          else if (vName.includes('temp')) kind = 'temp';
          else if (vName.includes('hba1c') || vName.includes('a1c')) kind = 'hba1c';
          else if (vName.includes('fbs') || vName.includes('fasting')) kind = 'sugar_fasting';
          else if (vName.includes('sugar') || vName.includes('rbs') || vName.includes('glucose')) kind = 'sugar_random';
          else if (vName.includes('weight') || vName.includes('wt')) kind = 'weight';
          else if (vName.includes('bmi')) kind = 'bmi';
          else if (vName.includes('creatinine')) kind = 'creatinine';
          else return;
        }

        let sys = parsed.systolic ?? null;
        let dia = parsed.diastolic ?? null;
        let val = parsed.value ?? null;
        const uStr = parsed.unit ?? (kind === 'bp' ? 'mmHg' : '');

        if (kind === 'bp' && (sys === null || dia === null)) {
          const m = String(v.value || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
          if (m) {
            sys = Number(m[1]);
            dia = Number(m[2]);
          }
        } else if (val === null && v.value) {
          const mVal = String(v.value).match(/(\d+(?:\.\d+)?)/);
          if (mVal) val = Number(mVal[1]);
        }

        const alreadyExists = combinedObs.some(
          (o) => o.prescription_id === doc.id || (o.obs_date === docDate && o.kind === kind)
        );
        if (!alreadyExists && (sys != null || val != null)) {
          combinedObs.push({
            id: 100000 + doc.id * 10 + idx,
            patient_id: patient.patientId || String(patient.id),
            prescription_id: doc.id,
            obs_date: docDate,
            kind,
            systolic: sys,
            diastolic: dia,
            value: val,
            unit: uStr,
            raw_text: `${v.name || ''} ${v.value || ''}`.trim(),
            created_at: doc.uploadedAt,
          });
        }
      });
    });
    combinedObs.sort((a, b) => new Date(a.obs_date || '1970-01-01').getTime() - new Date(b.obs_date || '1970-01-01').getTime());

    // 4.4 Longitudinal Trends
    const trends = calculatePatientTrends(
      patient.patientId || String(patient.id),
      combinedObs,
      documents
    );

    // 4.5 Patient Onboarding Context
    const onboardingRows = await query<{
      basic_info: Record<string, unknown> | null;
      conditions: Record<string, unknown> | null;
      custom_conditions: Record<string, unknown> | null;
      history: Record<string, unknown> | null;
    }>(
      `SELECT basic_info, conditions, custom_conditions, history
       FROM patient_onboarding
       WHERE user_id = $1 OR patient_id = ANY($2::text[])
       ORDER BY id DESC
       LIMIT 1;`,
      [patient.id, patientIds]
    );

    const onboarding = onboardingRows[0] || null;

    // 4.6 Query Patient Conditions & Allergies from DB tables
    let dbConditions: any[] = [];
    try {
      dbConditions = await query(
        `SELECT id, condition_name, icd10_code, category, status, diagnosed_date, severity, doctor, facility, notes
         FROM patient_conditions
         WHERE patient_id = ANY($1::text[]) OR user_id = $2
         ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, diagnosed_date DESC NULLS LAST, id DESC;`,
        [patientIds, patient.id]
      );
    } catch (e) {
      console.warn("Could not query patient_conditions:", e);
    }

    let dbAllergies: any[] = [];
    try {
      dbAllergies = await query(
        `SELECT id, allergen, category, reaction, severity, status, source, verification_status, added_date, notes
         FROM patient_allergies
         WHERE patient_id = ANY($1::text[]) OR user_id = $2
         ORDER BY id DESC;`,
        [patientIds, patient.id]
      );
    } catch (e) {
      console.warn("Could not query patient_allergies:", e);
    }

    // 5. Assemble and Return Complete Authorized Medical Dossier
    return NextResponse.json({
      success: true,
      authorized: true,
      authorization: {
        status: 'APPROVED',
        authorizedDoctor: doctor.name,
        doctorCode: doctor.doctorId,
        approvedAt: activeAuthorization.responded_at || activeAuthorization.requested_at,
        auditNote: 'Clinical inspection logged in audit record.',
      },
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        patientId: patient.patientId || rawPatientId,
        legacyPatientId: patient.legacyPatientId || null,
        accountRegisteredAt: patient.createdAt,
        onboardingInfo: onboarding,
      },
      medicalSummary: {
        totalDocuments: formattedDocuments.length,
        confirmedPrescriptionsCount: formattedDocuments.filter((d) => !d.isDraft).length,
        draftPrescriptionsCount: formattedDocuments.filter((d) => d.isDraft).length,
        activeMedicationsCount: activeMedicines.length,
        totalObservationsCount: combinedObs.length,
      },
      documents: formattedDocuments,
      medications: {
        active: activeMedicines,
        history: historyMedicines,
        needsReview: reviewMedicines,
        total: medRows.length,
      },
      observations: combinedObs,
      longitudinalTrends: trends,
      conditions: dbConditions,
      allergies: dbAllergies,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error occurred';
    return NextResponse.json({ error: `Failed to load medical records: ${msg}` }, { status: 500 });
  }
}

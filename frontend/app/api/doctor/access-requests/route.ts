import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireDoctorSession } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/doctor/access-requests
 * Doctor initiates a clinical access request to a patient using their P-... ID.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireDoctorSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user: doctor } = authResult;

    const body = await req.json().catch(() => null);
    if (!body || typeof body.patientId !== 'string') {
      return NextResponse.json(
        { error: 'Patient ID is required to request clinical records access.' },
        { status: 400 }
      );
    }

    const rawPatientId = body.patientId.trim();
    const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Clinical review and consultation';

    // Format validation
    const pIdRegex = /^P-[A-Za-z0-9_-]{3,32}$/i;
    const legacyNumericRegex = /^[0-9]{8,12}$/;
    const legacyAlnumRegex = /^CCM[0-9]{4,8}$/i;

    if (!pIdRegex.test(rawPatientId) && !legacyNumericRegex.test(rawPatientId) && !legacyAlnumRegex.test(rawPatientId)) {
      return NextResponse.json(
        { error: 'Invalid Patient ID format. Must begin with "P-" (e.g., P-123456789).' },
        { status: 400 }
      );
    }

    // Look up patient in real database
    const normalizedId = rawPatientId.toUpperCase();
    const patientRows = await query<{
      id: number;
      name: string;
      email: string;
      patientId: string | null;
      legacyPatientId: string | null;
      role: string;
    }>(
      `SELECT id, name, email, "patientId", "legacyPatientId", role
       FROM "User"
       WHERE role = 'PATIENT' AND (
         UPPER("patientId") = $1 OR
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
    const canonicalPatientCode = patient.patientId || rawPatientId;
    const doctorCode = doctor.doctorId || `D-${doctor.id}`;

    // Check for existing request between this doctor and this patient
    const existingRequests = await query<{
      id: number;
      status: string;
      requested_at: string;
      responded_at: string | null;
      revoked_at: string | null;
    }>(
      `SELECT id, status, requested_at, responded_at, revoked_at
       FROM patient_access_requests
       WHERE doctor_id = $1 AND patient_id = $2
       ORDER BY id DESC
       LIMIT 1;`,
      [doctor.id, patient.id]
    );

    const now = new Date().toISOString();

    if (existingRequests.length > 0) {
      const existing = existingRequests[0];
      if (existing.status === 'APPROVED') {
        return NextResponse.json({
          success: true,
          status: 'APPROVED',
          requestId: existing.id,
          message: 'Active clinical authorization already exists for this patient.',
          patient: {
            id: patient.id,
            name: patient.name,
            patientId: canonicalPatientCode,
          },
        });
      }

      if (existing.status === 'PENDING') {
        return NextResponse.json({
          success: true,
          status: 'PENDING',
          requestId: existing.id,
          message: 'An access request for this patient is already pending review.',
          patient: {
            id: patient.id,
            name: patient.name,
            patientId: canonicalPatientCode,
          },
        });
      }

      // If previously REJECTED or REVOKED, re-open as PENDING
      await query(
        `UPDATE patient_access_requests
         SET status = 'PENDING',
             reason = $1,
             requested_at = $2,
             responded_at = NULL,
             revoked_at = NULL
         WHERE id = $3;`,
        [reason, now, existing.id]
      );

      return NextResponse.json({
        success: true,
        status: 'PENDING',
        requestId: existing.id,
        message: 'New access request submitted to patient for review.',
        patient: {
          id: patient.id,
          name: patient.name,
          patientId: canonicalPatientCode,
        },
      });
    }

    // Insert new access request
    const inserted = await query<{ id: number }>(
      `INSERT INTO patient_access_requests (
         doctor_id, doctor_code, doctor_name, doctor_specialization, doctor_hospital,
         patient_id, patient_code, patient_name,
         status, reason, requested_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10)
       RETURNING id;`,
      [
        doctor.id,
        doctorCode,
        doctor.name,
        doctor.specialization || 'General Medicine',
        doctor.hospitalAffiliation || 'Affiliated Hospital',
        patient.id,
        canonicalPatientCode,
        patient.name,
        reason,
        now,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        status: 'PENDING',
        requestId: inserted[0].id,
        message: 'Clinical access request submitted. The patient has been notified to review and authorize access.',
        patient: {
          id: patient.id,
          name: patient.name,
          patientId: canonicalPatientCode,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error occurred';
    return NextResponse.json({ error: `Failed to create access request: ${msg}` }, { status: 500 });
  }
}

/**
 * GET /api/doctor/access-requests
 * Doctor retrieves all their access requests with current statuses.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireDoctorSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user: doctor } = authResult;

    const rows = await query<{
      id: number;
      doctor_id: number;
      doctor_code: string;
      doctor_name: string;
      doctor_specialization: string | null;
      doctor_hospital: string | null;
      patient_id: number;
      patient_code: string;
      patient_name: string;
      status: string;
      reason: string | null;
      requested_at: string;
      responded_at: string | null;
      revoked_at: string | null;
    }>(
      `SELECT id, doctor_id, doctor_code, doctor_name, doctor_specialization, doctor_hospital,
              patient_id, patient_code, patient_name, status, reason, requested_at, responded_at, revoked_at
       FROM patient_access_requests
       WHERE doctor_id = $1
       ORDER BY id DESC;`,
      [doctor.id]
    );

    return NextResponse.json({
      success: true,
      requests: rows.map((r) => ({
        id: r.id,
        doctorId: r.doctor_id,
        doctorCode: r.doctor_code,
        doctorName: r.doctor_name,
        doctorSpecialization: r.doctor_specialization,
        doctorHospital: r.doctor_hospital,
        patientId: r.patient_id,
        patientCode: r.patient_code,
        patientName: r.patient_name,
        status: r.status,
        reason: r.reason,
        requestedAt: r.requested_at,
        respondedAt: r.responded_at,
        revokedAt: r.revoked_at,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error occurred';
    return NextResponse.json({ error: `Failed to fetch access requests: ${msg}` }, { status: 500 });
  }
}

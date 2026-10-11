import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireDoctorSession } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce authenticated Doctor session (server-side RBAC)
    const authResult = await requireDoctorSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user: doctorUser } = authResult;

    // 2. Parse request payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body.patientId !== 'string') {
      return NextResponse.json(
        { error: 'Patient ID is required. Please provide a valid patient identifier.' },
        { status: 400 }
      );
    }

    const rawPatientId = body.patientId.trim();

    // 3. Strict Patient ID format validation (must begin with 'P-' or be valid legacy ID)
    const pIdRegex = /^P-[A-Za-z0-9_-]{3,32}$/i;
    const legacyNumericRegex = /^[0-9]{8,12}$/;
    const legacyAlnumRegex = /^CCM[0-9]{4,8}$/i;

    const isValidFormat =
      pIdRegex.test(rawPatientId) ||
      legacyNumericRegex.test(rawPatientId) ||
      legacyAlnumRegex.test(rawPatientId);

    if (!isValidFormat) {
      return NextResponse.json(
        {
          error:
            'Invalid Patient ID format. Patient ID must begin with "P-" followed by the patient identifier (e.g., P-123456789).',
          code: 'INVALID_PATIENT_ID_FORMAT',
        },
        { status: 400 }
      );
    }

    // 4. Query real database for patient account (no fake/mock records)
    const normalizedId = rawPatientId.toUpperCase();
    const rows = await query<{
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
         UPPER(COALESCE("legacyPatientId", '')) = $1
       )
       LIMIT 1;`,
      [normalizedId]
    );

    // 5. Handle patient not found
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: `Patient not found. No registered patient record exists with ID "${rawPatientId}".`,
          code: 'PATIENT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const patient = rows[0];

    // 6. Return verified identity with medical records locked pending authorization
    // In strict compliance with healthcare safety rules: medical records are kept hidden
    // until doctor-to-patient access consent is explicitly established.
    return NextResponse.json({
      success: true,
      doctor: {
        id: doctorUser.id,
        doctorId: doctorUser.doctorId,
        name: doctorUser.name,
      },
      patient: {
        id: patient.id,
        name: patient.name,
        patientId: patient.patientId || rawPatientId,
        legacyPatientId: patient.legacyPatientId || null,
        accountRegisteredAt: patient.createdAt,
        status: 'REGISTERED_IN_DIRECTORY',
      },
      authorization: {
        hasClinicalAccess: false,
        status: 'LOCKED_PENDING_PATIENT_CONSENT',
        message:
          'Patient identity verified in hospital registry. Full medical history, active prescriptions, and health trends are protected and remain locked until patient consent or transfer authorization is confirmed.',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error occurred';
    return NextResponse.json(
      { error: `Patient lookup failed: ${message}` },
      { status: 500 }
    );
  }
}

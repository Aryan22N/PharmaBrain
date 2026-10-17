import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePatientSession } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/patient/access-requests
 * Patient fetches all doctor access requests sent to them (pending, approved, history).
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user: patient } = authResult;

    // Ensure schema columns exist for auto-revoke
    try {
      await query(`ALTER TABLE patient_access_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;`);
      await query(`ALTER TABLE patient_access_requests ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 8;`);
      // Auto-revoke any active access requests whose expiration timestamp has elapsed
      await query(
        `UPDATE patient_access_requests
         SET status = 'REVOKED',
             revoked_at = NOW()
         WHERE patient_id = $1 
           AND status = 'APPROVED' 
           AND expires_at IS NOT NULL 
           AND expires_at <= NOW();`,
        [patient.id]
      );
    } catch {
      // Ignore schema setup errors if columns exist
    }

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
      expires_at: string | null;
      duration_days: number | null;
    }>(
      `SELECT id, doctor_id, doctor_code, doctor_name, doctor_specialization, doctor_hospital,
              patient_id, patient_code, patient_name, status, reason, requested_at, responded_at, revoked_at,
              expires_at, duration_days
       FROM patient_access_requests
       WHERE patient_id = $1
       ORDER BY requested_at DESC, id DESC;`,
      [patient.id]
    );

    const requests = rows.map((r) => ({
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
      expiresAt: r.expires_at,
      durationDays: r.duration_days,
    }));

    return NextResponse.json({
      success: true,
      requests,
      pendingCount: requests.filter((r) => r.status === 'PENDING').length,
      approvedCount: requests.filter((r) => r.status === 'APPROVED').length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error occurred';
    return NextResponse.json({ error: `Failed to fetch access requests: ${msg}` }, { status: 500 });
  }
}

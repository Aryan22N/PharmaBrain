import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePatientSession } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patient/access-requests/[id]/revoke
 * Patient revokes previously granted medical records access from a doctor.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user: patient } = authResult;

    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: 'Invalid access request ID.' }, { status: 400 });
    }

    // Verify request exists and belongs to this patient (IDOR protection)
    const existing = await query<{
      id: number;
      doctor_id: number;
      doctor_name: string;
      patient_id: number;
      status: string;
    }>(
      `SELECT id, doctor_id, doctor_name, patient_id, status
       FROM patient_access_requests
       WHERE id = $1 AND patient_id = $2
       LIMIT 1;`,
      [requestId, patient.id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Access request not found or does not belong to your account.' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const updated = await query<{
      id: number;
      doctor_id: number;
      doctor_name: string;
      doctor_code: string;
      status: string;
      revoked_at: string;
    }>(
      `UPDATE patient_access_requests
       SET status = 'REVOKED',
           revoked_at = $1
       WHERE id = $2 AND patient_id = $3
       RETURNING id, doctor_id, doctor_name, doctor_code, status, revoked_at;`,
      [now, requestId, patient.id]
    );

    return NextResponse.json({
      success: true,
      message: `Clinical access for ${existing[0].doctor_name} has been revoked. The doctor can no longer view your medical records.`,
      request: updated[0],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error occurred';
    return NextResponse.json({ error: `Failed to revoke access: ${msg}` }, { status: 500 });
  }
}

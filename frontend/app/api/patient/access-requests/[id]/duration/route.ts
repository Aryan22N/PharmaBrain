import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePatientSession } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patient/access-requests/[id]/duration
 * Patient adjusts the auto-revoke duration / expiry date for an active authorization.
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

    const body = await req.json().catch(() => null);
    if (!body || !body.durationDays) {
      return NextResponse.json(
        { error: 'durationDays parameter is required (e.g. 3, 8, or 30).' },
        { status: 400 }
      );
    }

    const parsedDays = Number(body.durationDays);
    const durationDays = [3, 8, 30].includes(parsedDays) ? parsedDays : parsedDays > 0 ? parsedDays : 8;

    const existing = await query<{
      id: number;
      doctor_id: number;
      doctor_name: string;
      patient_id: number;
      status: string;
    }>(
      `SELECT id, doctor_id, doctor_name, patient_id, status
       FROM patient_access_requests
       WHERE id = $1 AND patient_id = $2 AND status = 'APPROVED'
       LIMIT 1;`,
      [requestId, patient.id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Active access request not found or not currently approved.' },
        { status: 404 }
      );
    }

    const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const expiresAtIso = expiryDate.toISOString();

    const updated = await query<{
      id: number;
      doctor_name: string;
      status: string;
      expires_at: string;
      duration_days: number;
    }>(
      `UPDATE patient_access_requests
       SET expires_at = $1,
           duration_days = $2
       WHERE id = $3 AND patient_id = $4
       RETURNING id, doctor_name, status, expires_at, duration_days;`,
      [expiresAtIso, durationDays, requestId, patient.id]
    );

    return NextResponse.json({
      success: true,
      message: `Auto-revoke updated: Doctor ${existing[0].doctor_name}'s access will now auto-revoke in ${durationDays} days (${expiryDate.toLocaleDateString()}).`,
      request: updated[0],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error occurred';
    return NextResponse.json({ error: `Failed to update auto-revoke duration: ${msg}` }, { status: 500 });
  }
}

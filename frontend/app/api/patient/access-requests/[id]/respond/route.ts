import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePatientSession } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patient/access-requests/[id]/respond
 * Patient approves or rejects an incoming doctor access request.
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
    if (!body || typeof body.decision !== 'string') {
      return NextResponse.json(
        { error: 'Decision parameter is required ("APPROVE" or "REJECT").' },
        { status: 400 }
      );
    }

    const decision = body.decision.toUpperCase().trim();
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return NextResponse.json(
        { error: 'Invalid decision. Must be "APPROVE" or "REJECT".' },
        { status: 400 }
      );
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

    const targetStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const now = new Date().toISOString();

    const updated = await query<{
      id: number;
      doctor_id: number;
      doctor_name: string;
      doctor_code: string;
      status: string;
      responded_at: string;
    }>(
      `UPDATE patient_access_requests
       SET status = $1,
           responded_at = $2
       WHERE id = $3 AND patient_id = $4
       RETURNING id, doctor_id, doctor_name, doctor_code, status, responded_at;`,
      [targetStatus, now, requestId, patient.id]
    );

    return NextResponse.json({
      success: true,
      message:
        decision === 'APPROVE'
          ? `Access granted to ${existing[0].doctor_name}. The doctor is now authorized to review your medical dossier.`
          : `Access request from ${existing[0].doctor_name} was declined.`,
      request: updated[0],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error occurred';
    return NextResponse.json({ error: `Failed to update access request: ${msg}` }, { status: 500 });
  }
}

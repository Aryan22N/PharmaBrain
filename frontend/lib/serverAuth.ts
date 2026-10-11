import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, type JWTPayload } from '@/lib/auth';
import { query } from '@/lib/db';
import type { UserAccount } from '@/lib/types';

export interface AuthSuccess {
  ok: true;
  user: UserAccount;
  payload: JWTPayload;
}

export interface AuthFailure {
  ok: false;
  response: NextResponse;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Extracts authentication token from either Authorization header or cookies
 */
export async function getAuthToken(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (token) return token;
  } catch {
    // If running in a context where cookies() is unavailable, fallback gracefully
  }

  return null;
}

/**
 * Server-side verification for Patient-only API operations.
 * Validates token signature, expiration, active database record, and enforces role === 'PATIENT'.
 */
export async function requirePatientSession(request: Request): Promise<AuthResult> {
  const token = await getAuthToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Authentication required. Please sign in.' },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Invalid or expired session token.' },
        { status: 401 }
      ),
    };
  }

  // Deep database verification (never trust client payload alone)
  const users = await query<UserAccount>(
    `SELECT id, name, email, role, "patientId", "legacyPatientId", "doctorId", "doctorVerificationStatus", "createdAt"
     FROM "User"
     WHERE id = $1
     LIMIT 1;`,
    [payload.userId]
  );

  if (users.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      ),
    };
  }

  const user = users[0];

  if (user.role !== 'PATIENT') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: Doctor accounts cannot access patient portal endpoints as a patient.' },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user,
    payload,
  };
}

/**
 * Server-side verification for Doctor-only API operations.
 * Validates token signature, expiration, active database record, and enforces role === 'DOCTOR'.
 */
export async function requireDoctorSession(request: Request): Promise<AuthResult> {
  const token = await getAuthToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Authentication required. Please sign in.' },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Invalid or expired session token.' },
        { status: 401 }
      ),
    };
  }

  // Deep database verification
  const users = await query<UserAccount>(
    `SELECT id, name, email, role, "patientId", "legacyPatientId", "doctorId", "doctorVerificationStatus",
            "medicalLicenseNumber", "specialization", "hospitalAffiliation", "createdAt"
     FROM "User"
     WHERE id = $1
     LIMIT 1;`,
    [payload.userId]
  );

  if (users.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Doctor profile not found.' },
        { status: 404 }
      ),
    };
  }

  const user = users[0];

  if (user.role !== 'DOCTOR') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: Access restricted to registered medical doctors.' },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user,
    payload,
  };
}

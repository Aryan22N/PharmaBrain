import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { email, password, role: requestedRole } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const users = await query(
      `SELECT id, name, email, "passwordHash", "patientId", "legacyPatientId", 
              role, "doctorId", "doctorVerificationStatus", 
              "medicalLicenseNumber", "specialization", "hospitalAffiliation"
       FROM "User" 
       WHERE LOWER(email) = LOWER($1) 
       LIMIT 1;`,
      [trimmedEmail]
    );

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email address or password' },
        { status: 401 }
      );
    }

    const user = users[0];
    const userRole = user.role || 'PATIENT';

    // Verify role matches portal: reject doctor accounts attempting patient portal login
    if (userRole === 'DOCTOR' && (!requestedRole || requestedRole.toUpperCase() === 'PATIENT')) {
      return NextResponse.json(
        { error: 'This account is registered as a Doctor. Please sign in through the Doctor Portal.' },
        { status: 403 }
      );
    }
    if (requestedRole && requestedRole.toUpperCase() === 'DOCTOR' && userRole === 'PATIENT') {
      return NextResponse.json(
        { error: 'This account is registered as a Patient. Please sign in through the Patient Portal.' },
        { status: 403 }
      );
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email address or password' },
        { status: 401 }
      );
    }

    // For patients, ensure valid patient ID
    let patientId = user.patientId;
    if (userRole === 'PATIENT' && !patientId) {
      const { generatePatientId } = await import('@/lib/auth');
      patientId = generatePatientId();
      await query(
        `UPDATE "User" SET "patientId" = $1 WHERE id = $2;`,
        [patientId, user.id]
      );
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: userRole,
      patientId: userRole === 'PATIENT' ? patientId : null,
      doctorId: userRole === 'DOCTOR' ? user.doctorId : null,
      doctorVerificationStatus: userRole === 'DOCTOR' ? user.doctorVerificationStatus : null,
    });

    const response = NextResponse.json(
      {
        message: 'Signed in successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: userRole,
          patientId: userRole === 'PATIENT' ? patientId : null,
          legacyPatientId: user.legacyPatientId || null,
          doctorId: userRole === 'DOCTOR' ? user.doctorId : null,
          doctorVerificationStatus: userRole === 'DOCTOR' ? user.doctorVerificationStatus : null,
          medicalLicenseNumber: userRole === 'DOCTOR' ? user.medicalLicenseNumber : null,
          specialization: userRole === 'DOCTOR' ? user.specialization : null,
          hospitalAffiliation: userRole === 'DOCTOR' ? user.hospitalAffiliation : null,
        },
        token,
      },
      { status: 200 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    console.error('Login API Error:', error);
    const message = error instanceof Error ? error.message : 'Server error during login';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

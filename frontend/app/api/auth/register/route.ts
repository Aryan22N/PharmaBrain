import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const {
      name,
      email,
      password,
      role: rawRole,
      medicalLicenseNumber,
      specialization,
      hospitalAffiliation,
    } = body;

    // Validate role (default to PATIENT, prevent arbitrary roles)
    let role: 'PATIENT' | 'DOCTOR' = 'PATIENT';
    if (rawRole) {
      const normalized = String(rawRole).trim().toUpperCase();
      if (normalized === 'DOCTOR') {
        role = 'DOCTOR';
      } else if (normalized === 'PATIENT') {
        role = 'PATIENT';
      } else {
        return NextResponse.json(
          { error: 'Invalid user role requested. Allowed roles: PATIENT or DOCTOR.' },
          { status: 400 }
        );
      }
    }

    // 1. Strict server-side validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Valid full name is required (minimum 2 characters)' },
        { status: 400 }
      );
    }

    const trimmedEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Doctor credential validation
    if (role === 'DOCTOR') {
      if (!medicalLicenseNumber || typeof medicalLicenseNumber !== 'string' || medicalLicenseNumber.trim().length < 3) {
        return NextResponse.json(
          { error: 'Valid Medical License / Registration Number is required for doctor accounts.' },
          { status: 400 }
        );
      }
    }

    // 2. Prevent duplicate accounts
    const existingUsers = await query(
      `SELECT id FROM "User" WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
      [trimmedEmail]
    );

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in.' },
        { status: 409 }
      );
    }

    interface RegisteredUser {
      id: number;
      name: string;
      email: string;
      role: 'PATIENT' | 'DOCTOR';
      patientId?: string | null;
      doctorId?: string | null;
      doctorVerificationStatus?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
      medicalLicenseNumber?: string | null;
      specialization?: string | null;
      hospitalAffiliation?: string | null;
      createdAt: string;
    }
    let user: RegisteredUser;

    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();

    if (role === 'DOCTOR') {
      // 3a. Generate unique Doctor ID (D- prefix) with collision check
      const { generateDoctorId } = await import('@/lib/auth');
      let uniqueDoctorId = '';
      const maxAttempts = 10;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidateId = generateDoctorId();
        const collisionCheck = await query(
          `SELECT id FROM "User" WHERE "doctorId" = $1 LIMIT 1;`,
          [candidateId]
        );
        if (collisionCheck.length === 0) {
          uniqueDoctorId = candidateId;
          break;
        }
      }

      if (!uniqueDoctorId) {
        return NextResponse.json(
          { error: 'Could not allocate a unique doctor ID. Please try again.' },
          { status: 500 }
        );
      }

      const newUsers = await query(
        `INSERT INTO "User" (
           name, email, "passwordHash", role, "doctorId", "doctorVerificationStatus",
           "medicalLicenseNumber", "specialization", "hospitalAffiliation", "createdAt"
         ) 
         VALUES ($1, $2, $3, 'DOCTOR', $4, 'PENDING', $5, $6, $7, $8) 
         RETURNING id, name, email, role, "doctorId", "doctorVerificationStatus", 
                   "medicalLicenseNumber", "specialization", "hospitalAffiliation", "createdAt";`,
        [
          name.trim(),
          trimmedEmail,
          hashedPassword,
          uniqueDoctorId,
          medicalLicenseNumber.trim(),
          specialization ? String(specialization).trim() : null,
          hospitalAffiliation ? String(hospitalAffiliation).trim() : null,
          now,
        ]
      );
      user = newUsers[0];
    } else {
      // 3b. Generate unique Patient ID (P- prefix) with collision check
      const { generatePatientId } = await import('@/lib/auth');
      let uniquePatientId = '';
      const maxAttempts = 10;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidateId = generatePatientId();
        const collisionCheck = await query(
          `SELECT id FROM "User" WHERE "patientId" = $1 LIMIT 1;`,
          [candidateId]
        );
        if (collisionCheck.length === 0) {
          uniquePatientId = candidateId;
          break;
        }
      }

      if (!uniquePatientId) {
        return NextResponse.json(
          { error: 'Could not allocate a unique patient ID. Please try again.' },
          { status: 500 }
        );
      }

      const newUsers = await query(
        `INSERT INTO "User" (name, email, "passwordHash", role, "patientId", "doctorVerificationStatus", "createdAt") 
         VALUES ($1, $2, $3, 'PATIENT', $4, 'NOT_REQUIRED', $5) 
         RETURNING id, name, email, role, "patientId", "doctorVerificationStatus", "createdAt";`,
        [name.trim(), trimmedEmail, hashedPassword, uniquePatientId, now]
      );
      user = newUsers[0];
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      patientId: user.patientId || null,
      doctorId: user.doctorId || null,
      doctorVerificationStatus: user.doctorVerificationStatus || null,
    });

    const response = NextResponse.json(
      {
        message:
          role === 'DOCTOR'
            ? 'Doctor registration successful. Your clinical credentials are pending administrative verification.'
            : 'Patient account created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          patientId: user.patientId || null,
          doctorId: user.doctorId || null,
          doctorVerificationStatus: user.doctorVerificationStatus,
          medicalLicenseNumber: user.medicalLicenseNumber || null,
          specialization: user.specialization || null,
          hospitalAffiliation: user.hospitalAffiliation || null,
        },
        token,
      },
      { status: 201 }
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
    console.error('Registration API Error:', error);
    const message = error instanceof Error ? error.message : 'Server error during registration';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

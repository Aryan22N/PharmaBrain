import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, generateToken, generateDoctorId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const name = (body.name || body.fullName || '').toString();
    const {
      email,
      password,
      medicalLicenseNumber,
      specialization,
      hospitalAffiliation,
    } = body;

    // 1. Strict Server-side Validation
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

    if (
      !medicalLicenseNumber ||
      typeof medicalLicenseNumber !== 'string' ||
      medicalLicenseNumber.trim().length < 3
    ) {
      return NextResponse.json(
        { error: 'Medical Registration / Council License Number is required (minimum 3 characters).' },
        { status: 400 }
      );
    }

    // 2. Prevent duplicate accounts (enforce unique email)
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

    // 3. Generate unique Doctor ID beginning with 'D-' on the server with collision check
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

    // 4. Secure password hash (never store plaintext)
    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();

    // 5. Server forces role = 'DOCTOR' (never trusts client-supplied role)
    // Verification status is initialized strictly to 'PENDING'
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
        specialization && typeof specialization === 'string' ? specialization.trim() : null,
        hospitalAffiliation && typeof hospitalAffiliation === 'string' ? hospitalAffiliation.trim() : null,
        now,
      ]
    );

    const user = newUsers[0];

    // 6. Sign secure 7-day JWT token containing doctor credentials
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'DOCTOR',
      doctorId: user.doctorId,
      doctorVerificationStatus: user.doctorVerificationStatus,
      patientId: null,
    });

    const response = NextResponse.json(
      {
        message: 'Doctor account registered successfully. Verification status is pending clinical credentials review.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'DOCTOR',
          doctorId: user.doctorId,
          doctorVerificationStatus: user.doctorVerificationStatus,
          medicalLicenseNumber: user.medicalLicenseNumber,
          specialization: user.specialization,
          hospitalAffiliation: user.hospitalAffiliation,
          createdAt: user.createdAt,
        },
        token,
      },
      { status: 201 }
    );

    // 7. Set secure HTTP-only session cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    console.error('Doctor Registration API Error:', error);
    const message = error instanceof Error ? error.message : 'Server error during doctor registration';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

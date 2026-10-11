import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, generateToken, generateDoctorId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Query User by email
    const users = await query(
      `SELECT id, name, email, "passwordHash", role, "doctorId", "doctorVerificationStatus",
              "medicalLicenseNumber", "specialization", "hospitalAffiliation", "createdAt"
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

    // Enforce role separation server-side: reject patient accounts attempting doctor login
    if (user.role !== 'DOCTOR') {
      return NextResponse.json(
        { error: 'This account is registered as a Patient. Please use the Patient Sign In portal.' },
        { status: 403 }
      );
    }

    // Verify password hash securely
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email address or password' },
        { status: 401 }
      );
    }

    // Ensure doctor has a valid D- doctor ID permanently stored
    let doctorId = user.doctorId;
    if (!doctorId) {
      doctorId = generateDoctorId();
      await query(
        `UPDATE "User" SET "doctorId" = $1 WHERE id = $2;`,
        [doctorId, user.id]
      );
    }

    // Sign secure 7-day JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'DOCTOR',
      doctorId,
      doctorVerificationStatus: user.doctorVerificationStatus || 'PENDING',
      patientId: null,
    });

    const response = NextResponse.json(
      {
        message: 'Signed in successfully as Doctor',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'DOCTOR',
          doctorId,
          doctorVerificationStatus: user.doctorVerificationStatus || 'PENDING',
          medicalLicenseNumber: user.medicalLicenseNumber || null,
          specialization: user.specialization || null,
          hospitalAffiliation: user.hospitalAffiliation || null,
          createdAt: user.createdAt,
        },
        token,
      },
      { status: 200 }
    );

    // Set secure HTTP-only session cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    console.error('Doctor Login API Error:', error);
    const message = error instanceof Error ? error.message : 'Server error during doctor login';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

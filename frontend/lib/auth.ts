import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'pharma_brain_patient_dmr_jwt_secret_key_2026_super_secure!';

export type UserRole = 'PATIENT' | 'DOCTOR';
export type DoctorVerificationStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface JWTPayload {
  userId: number;
  email: string;
  name: string;
  role?: UserRole;
  patientId?: string | null;
  doctorId?: string | null;
  doctorVerificationStatus?: DoctorVerificationStatus | null;
}

/**
 * Generate a JWT token containing authenticated user details
 */
export function generateToken(payload: JWTPayload): string {
  const normalizedPayload: JWTPayload = {
    ...payload,
    role: payload.role || 'PATIENT',
  };
  return jwt.sign(normalizedPayload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify and decode an incoming JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Hash patient/doctor account password securely
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain password against stored bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a cryptographically strong, non-sequential Patient ID with 'P-' prefix.
 * Returns a string formatted as "P-XXXXXXXXX" (e.g. "P-483027156").
 */
export function generatePatientId(): string {
  const min = 100000000;
  const max = 999999999;
  const range = max - min + 1;
  const randomBuffer = crypto.randomBytes(4);
  const randomUInt = randomBuffer.readUInt32BE(0);
  const patientNum = min + (randomUInt % range);
  return `P-${patientNum}`;
}

/**
 * Generates a cryptographically strong, non-sequential Doctor ID with 'D-' prefix.
 * Returns a string formatted as "D-XXXXXXXXX" (e.g. "D-739201845").
 */
export function generateDoctorId(): string {
  const min = 100000000;
  const max = 999999999;
  const range = max - min + 1;
  const randomBuffer = crypto.randomBytes(4);
  const randomUInt = randomBuffer.readUInt32BE(0);
  const doctorNum = min + (randomUInt % range);
  return `D-${doctorNum}`;
}

/**
 * Backward compatibility helper for existing legacy 9-digit patient ID generation.
 */
export function generate9DigitPatientId(): string {
  const min = 100000000;
  const max = 999999999;
  const range = max - min + 1;
  const randomBuffer = crypto.randomBytes(4);
  const randomUInt = randomBuffer.readUInt32BE(0);
  const patientNum = min + (randomUInt % range);
  return patientNum.toString();
}

/**
 * Validates that a requested role is strictly one of the permitted system roles.
 */
export function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (role === 'PATIENT' || role === 'DOCTOR');
}


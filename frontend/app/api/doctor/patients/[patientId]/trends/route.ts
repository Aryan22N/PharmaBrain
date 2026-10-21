import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireDoctorSession } from "@/lib/serverAuth";
import { getPatientLongitudinalTrends } from "@/lib/trendsService";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/patients/[patientId]/trends
 * Returns full longitudinal trends, eligibility progress, and AI synthesis
 * for a patient ONLY IF active doctor authorization is verified in database.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    // 1. Authenticate Doctor Session
    const authResult = await requireDoctorSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user: doctor } = authResult;

    const { patientId: rawPatientId } = await params;
    if (!rawPatientId) {
      return NextResponse.json({ error: "Patient ID is required." }, { status: 400 });
    }

    const normalizedId = decodeURIComponent(rawPatientId).trim().replace(/\s+/g, "-").toUpperCase();

    // 2. Fetch Patient Account from Database
    const patientRows = await query<{
      id: number;
      name: string;
      email: string;
      patientId: string | null;
      legacyPatientId: string | null;
      createdAt: string;
      role: string;
    }>(
      `SELECT id, name, email, "patientId", "legacyPatientId", "createdAt", role
       FROM "User"
       WHERE role = 'PATIENT' AND (
         UPPER("patientId") = $1 OR
         UPPER(REPLACE(COALESCE("patientId", ''), ' ', '-')) = $1 OR
         UPPER(COALESCE("legacyPatientId", '')) = $1
       )
       LIMIT 1;`,
      [normalizedId]
    );

    if (patientRows.length === 0) {
      return NextResponse.json(
        { error: `Patient not found. No record matches identifier "${rawPatientId}".` },
        { status: 404 }
      );
    }

    const patient = patientRows[0];

    // 3. Strict Authorization Check
    const accessRows = await query<{
      id: number;
      status: string;
      requested_at: string;
      responded_at: string | null;
      revoked_at: string | null;
      expires_at: string | null;
    }>(
      `SELECT id, status, requested_at, responded_at, revoked_at, expires_at
       FROM patient_access_requests
       WHERE doctor_id = $1 AND patient_id = $2 AND status = 'APPROVED'
       ORDER BY id DESC
       LIMIT 1;`,
      [doctor.id, patient.id]
    );

    const activeAuthorization = accessRows[0];
    const isExpired = Boolean(
      activeAuthorization?.expires_at &&
      !isNaN(Date.parse(activeAuthorization.expires_at)) &&
      new Date(activeAuthorization.expires_at).getTime() <= Date.now()
    );

    if (!activeAuthorization || isExpired) {
      return NextResponse.json(
        {
          error: isExpired
            ? "Forbidden: Clinical authorization has expired."
            : "Forbidden: You do not possess active clinical authorization for this patient.",
          authorized: false,
        },
        { status: 403 }
      );
    }

    const forceRefresh =
      req.nextUrl.searchParams.get("force") === "true" ||
      req.nextUrl.searchParams.get("refresh") === "true";
    const generateAi = req.nextUrl.searchParams.get("generate") === "true";

    const result = await getPatientLongitudinalTrends(patient, {
      forceRefresh,
      generateAi,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Doctor Patient Trends API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load clinical trends for patient" },
      { status: 500 }
    );
  }
}

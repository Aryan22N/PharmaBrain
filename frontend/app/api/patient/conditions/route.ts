import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePatientSession } from "@/lib/serverAuth";
import { getPatientIds, getPrimaryPatientId } from "@/lib/patientScope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const patientIds = getPatientIds(user);

    const rows = await query(
      `SELECT id, condition_name, icd10_code, category, status, diagnosed_date, severity, doctor, facility, source, verification_status, notes, created_at
       FROM patient_conditions
       WHERE patient_id = ANY($1::text[]) OR user_id = $2
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, diagnosed_date DESC NULLS LAST, id DESC;`,
      [patientIds, user.id]
    );

    return NextResponse.json({
      success: true,
      conditions: rows,
      total: rows.length,
      activeCount: rows.filter((r) => r.status === "ACTIVE").length,
    });
  } catch (error: any) {
    console.error("Fetch Conditions Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch conditions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const patientId = getPrimaryPatientId(user) || user.patientId;

    const body = await req.json().catch(() => ({}));
    const {
      condition_name,
      icd10_code = "",
      category = "Chronic",
      status = "ACTIVE",
      diagnosed_date = new Date().toISOString().split("T")[0],
      severity = "Moderate",
      doctor = "Consulting Physician",
      facility = "Clinical Care Facility",
      notes = "",
    } = body;

    if (!condition_name || !condition_name.trim()) {
      return NextResponse.json(
        { error: "Condition name is required" },
        { status: 400 }
      );
    }

    const inserted = await query(
      `INSERT INTO patient_conditions
       (patient_id, user_id, condition_name, icd10_code, category, status, diagnosed_date, severity, doctor, facility, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *;`,
      [
        patientId,
        user.id,
        condition_name.trim(),
        icd10_code.trim() || null,
        category,
        status,
        diagnosed_date,
        severity,
        doctor.trim() || null,
        facility.trim() || null,
        notes.trim() || null,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        condition: inserted[0],
        message: "Condition added successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create Condition Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add condition" },
      { status: 500 }
    );
  }
}

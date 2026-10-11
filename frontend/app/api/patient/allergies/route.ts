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
      `SELECT id, allergen, category, reaction, severity, status, source, verification_status, added_date, notes, created_at
       FROM patient_allergies
       WHERE patient_id = ANY($1::text[]) OR user_id = $2
       ORDER BY id DESC;`,
      [patientIds, user.id]
    );

    return NextResponse.json({
      success: true,
      allergies: rows,
      total: rows.length,
    });
  } catch (error: any) {
    console.error("Fetch Allergies Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch allergies" },
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
      allergen,
      category = "Medication",
      reaction = "Not documented",
      severity = "Moderate",
      status = "Patient Reported",
      source = "Patient Portal",
      verification_status = "Patient Reported",
      added_date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      notes = "",
    } = body;

    if (!allergen || !allergen.trim()) {
      return NextResponse.json(
        { error: "Allergen name is required" },
        { status: 400 }
      );
    }

    const inserted = await query(
      `INSERT INTO patient_allergies
       (patient_id, user_id, allergen, category, reaction, severity, status, source, verification_status, added_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *;`,
      [
        patientId,
        user.id,
        allergen.trim(),
        category,
        reaction.trim(),
        severity,
        status,
        source,
        verification_status,
        added_date,
        notes.trim() || null,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        allergy: inserted[0],
        message: "Allergy recorded successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create Allergy Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record allergy" },
      { status: 500 }
    );
  }
}

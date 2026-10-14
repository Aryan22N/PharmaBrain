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

    await query(`
      CREATE TABLE IF NOT EXISTS patient_allergies (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(64),
        user_id INTEGER,
        allergen VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Medication',
        reaction TEXT,
        severity VARCHAR(50) DEFAULT 'Moderate',
        status VARCHAR(100) DEFAULT 'Patient Reported',
        source VARCHAR(100) DEFAULT 'Patient Portal',
        verification_status VARCHAR(100) DEFAULT 'Patient Reported',
        added_date VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON patient_allergies(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_allergies_user ON patient_allergies(user_id);
      ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
    `);

    const rows = await query(
      `SELECT id, allergen, category, reaction, severity, status, source, verification_status, added_date, notes, created_at
       FROM patient_allergies
       WHERE (patient_id = ANY($1::text[]) OR user_id = $2)
         AND (is_deleted IS NULL OR is_deleted = FALSE)
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

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;
    const patientIds = getPatientIds(user);

    const body = await req.json().catch(() => ({}));
    const { id, allergen, category, reaction, severity, status, notes } = body;
    const allergyId = parseInt(id, 10);
    if (isNaN(allergyId)) {
      return NextResponse.json({ error: "Allergy ID is required" }, { status: 400 });
    }

    const updated = await query(
      `UPDATE patient_allergies
       SET allergen = COALESCE($1, allergen),
           category = COALESCE($2, category),
           reaction = COALESCE($3, reaction),
           severity = COALESCE($4, severity),
           status = COALESCE($5, status),
           notes = COALESCE($6, notes)
       WHERE id = $7 AND (patient_id = ANY($8::text[]) OR user_id = $9)
       RETURNING *;`,
      [
        allergen !== undefined ? allergen.trim() : null,
        category !== undefined ? category.trim() : null,
        reaction !== undefined ? reaction.trim() : null,
        severity !== undefined ? severity.trim() : null,
        status !== undefined ? status.trim() : null,
        notes !== undefined ? notes.trim() : null,
        allergyId,
        patientIds,
        user.id,
      ]
    );

    if (updated.length === 0) {
      return NextResponse.json({ error: "Allergy record not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      allergy: updated[0],
      message: "Allergy updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update allergy" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;
    const patientIds = getPatientIds(user);

    const url = new URL(req.url);
    const idFromQuery = url.searchParams.get("id");
    const body = req.method === "DELETE" ? await req.json().catch(() => ({})) : {};
    const id = idFromQuery || body.id;
    const allergyId = parseInt(id, 10);

    if (isNaN(allergyId)) {
      return NextResponse.json({ error: "Allergy ID is required" }, { status: 400 });
    }

    await query(`ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);

    const deleted = await query(
      `UPDATE patient_allergies 
       SET is_deleted = TRUE 
       WHERE id = $1 AND (patient_id = ANY($2::text[]) OR user_id = $3)
       RETURNING id;`,
      [allergyId, patientIds, user.id]
    );

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Allergy record not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Allergy deleted successfully",
      id: allergyId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete allergy" }, { status: 500 });
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

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePatientSession } from "@/lib/serverAuth";
import { getPatientIds } from "@/lib/patientScope";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/patient/allergies/[id]
 * Updates an existing allergy record.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const patientIds = getPatientIds(user);

    const { id } = await params;
    const allergyId = parseInt(id, 10);
    if (isNaN(allergyId)) {
      return NextResponse.json({ error: "Invalid allergy ID" }, { status: 400 });
    }

    // Verify existing record ownership
    const existing = await query(
      `SELECT * FROM patient_allergies 
       WHERE id = $1 AND (patient_id = ANY($2::text[]) OR user_id = $3);`,
      [allergyId, patientIds, user.id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Allergy record not found or unauthorized" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      allergen,
      category,
      reaction,
      severity,
      status,
      notes,
    } = body;

    const updated = await query(
      `UPDATE patient_allergies
       SET allergen = COALESCE($1, allergen),
           category = COALESCE($2, category),
           reaction = COALESCE($3, reaction),
           severity = COALESCE($4, severity),
           status = COALESCE($5, status),
           notes = COALESCE($6, notes)
       WHERE id = $7
       RETURNING *;`,
      [
        allergen !== undefined ? allergen.trim() : null,
        category !== undefined ? category.trim() : null,
        reaction !== undefined ? reaction.trim() : null,
        severity !== undefined ? severity.trim() : null,
        status !== undefined ? status.trim() : null,
        notes !== undefined ? notes.trim() : null,
        allergyId,
      ]
    );

    return NextResponse.json({
      success: true,
      allergy: updated[0],
      message: "Allergy updated successfully",
    });
  } catch (error: any) {
    console.error("Update Allergy Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update allergy record" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patient/allergies/[id]
 * Deletes or archives an allergy record.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;
    const patientIds = getPatientIds(user);

    const { id } = await params;
    const allergyId = parseInt(id, 10);
    if (isNaN(allergyId)) {
      return NextResponse.json({ error: "Invalid allergy ID" }, { status: 400 });
    }

    // Ensure is_deleted column exists
    await query(`ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);

    // Verify ownership
    const existing = await query(
      `SELECT * FROM patient_allergies 
       WHERE id = $1 AND (patient_id = ANY($2::text[]) OR user_id = $3);`,
      [allergyId, patientIds, user.id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Allergy record not found or unauthorized" },
        { status: 404 }
      );
    }

    // Mark as deleted so it is removed from active views and does not resurrect
    await query(
      `UPDATE patient_allergies 
       SET is_deleted = TRUE 
       WHERE id = $1;`,
      [allergyId]
    );

    return NextResponse.json({
      success: true,
      message: "Allergy record deleted successfully",
      id: allergyId,
    });
  } catch (error: any) {
    console.error("Delete Allergy Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete allergy record" },
      { status: 500 }
    );
  }
}

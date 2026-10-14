import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePatientSession } from "@/lib/serverAuth";
import { getPatientIds } from "@/lib/patientScope";
import {
  MedicationLifecycleStatus,
  validateStatusTransition,
} from "@/lib/medicationLifecycle";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/patient/medicines/[id]
 * Updates medication lifecycle status, duration, or instructions with clinical audit trail.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const medId = parseInt(id, 10);
    if (isNaN(medId)) {
      return NextResponse.json({ error: "Invalid medication ID" }, { status: 400 });
    }

    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user, payload } = authResult;

    const patientIds = getPatientIds(user);
    if (patientIds.length === 0) {
      return NextResponse.json(
        { error: "Patient identity is not configured for this account" },
        { status: 403 }
      );
    }

    // Fetch existing medication record
    const existingRows = await query(
      `SELECT * FROM patient_medications WHERE id = $1;`,
      [medId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Medication record not found" }, { status: 404 });
    }

    const existing = existingRows[0];

    // Security Check: Verify patient ownership against only this account's
    // canonical and legacy patient identifiers.
    const isOwner =
      existing.user_id === payload.userId ||
      patientIds.includes(existing.patient_id);

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to modify this medication record" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      status: targetStatus,
      discontinuedReason,
      reason,
      statusReason,
      frequency,
      strength,
      isConflicting,
      conflictDetails,
      reconciliationNotes,
    } = body;

    const todayStr = new Date().toISOString().split("T")[0];
    let newStatus: MedicationLifecycleStatus = existing.status;
    let actualEndDate = existing.actual_end_date;
    let discReason = existing.discontinued_reason;
    const effectiveReason = (reason || statusReason || discontinuedReason || "").trim();
    let statusReasonVal = existing.status_reason;
    let auditAction = "UPDATED";

    // Validate lifecycle status transition if status is being updated
    if (targetStatus && targetStatus !== existing.status) {
      const transition = validateStatusTransition(
        existing.status as MedicationLifecycleStatus,
        targetStatus as MedicationLifecycleStatus,
        effectiveReason || discontinuedReason
      );

      if (!transition.allowed) {
        return NextResponse.json(
          { error: transition.error || "Disallowed lifecycle transition" },
          { status: 422 }
        );
      }

      newStatus = targetStatus;
      auditAction = "STATUS_CHANGE";

      if (targetStatus === "COMPLETED") {
        actualEndDate = todayStr;
        statusReasonVal = effectiveReason || "Course completed by patient";
        auditAction = "COMPLETED";
      } else if (targetStatus === "DISCONTINUED") {
        actualEndDate = todayStr;
        discReason = effectiveReason || "Discontinued by clinician/patient";
        statusReasonVal = effectiveReason || "Discontinued by clinician/patient";
        auditAction = "DISCONTINUED";
      } else if (targetStatus === "ON_HOLD") {
        statusReasonVal = effectiveReason || "Treatment put on hold";
        auditAction = "ON_HOLD";
      } else if (targetStatus === "ACTIVE") {
        statusReasonVal = effectiveReason || "Treatment resumed";
        auditAction = "RESUMED";
      }
    }

    // Resolve conflict or review flag if explicitly requested
    const updatedIsConflicting =
      isConflicting !== undefined ? Boolean(isConflicting) : existing.is_conflicting;
    const updatedConflictDetails =
      conflictDetails !== undefined ? conflictDetails : existing.conflict_details;
    const updatedReconNotes =
      reconciliationNotes !== undefined ? reconciliationNotes : existing.reconciliation_notes;
    const updatedFreq = frequency || existing.frequency;
    const updatedStrength = strength || existing.strength;

    // Update medication record
    const updatedRows = await query(
      `UPDATE patient_medications
       SET status = $1,
           actual_end_date = $2,
           discontinued_reason = $3,
           status_reason = $4,
           frequency = $5,
           strength = $6,
           is_conflicting = $7,
           conflict_details = $8,
           reconciliation_notes = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *;`,
      [
        newStatus,
        actualEndDate,
        discReason,
        statusReasonVal,
        updatedFreq,
        updatedStrength,
        updatedIsConflicting,
        updatedConflictDetails,
        updatedReconNotes,
        medId,
      ]
    );

    const updated = updatedRows[0];

    // Record audit trail
    await query(
      `INSERT INTO patient_medication_audit (
        medication_id, patient_id, user_id, action, previous_status, new_status, reason, actor
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        medId,
        existing.patient_id,
        payload.userId,
        auditAction,
        existing.status,
        newStatus,
        effectiveReason || discReason || statusReasonVal || "Record updated",
        payload.name || "Patient/Clinician",
      ]
    );

    // If marked DISCONTINUED due to an allergy or adverse reaction, automatically record in patient_allergies
    let allergyRecord: any = null;
    const isAllergy =
      newStatus === "DISCONTINUED" &&
      (Boolean(body.isAllergy) ||
        body.reasonCategory === "ALLERGY" ||
        /allerg|alergy/i.test(effectiveReason || "") ||
        /allerg|alergy/i.test(discReason || "") ||
        /allerg|alergy/i.test(body.allergyReaction || ""));

    if (isAllergy) {
      try {
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
            source VARCHAR(100) DEFAULT 'Medication Discontinuation',
            verification_status VARCHAR(100) DEFAULT 'Patient Reported',
            added_date VARCHAR(100),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON patient_allergies(patient_id);
          CREATE INDEX IF NOT EXISTS idx_patient_allergies_user ON patient_allergies(user_id);
        `);

        const allergenName = (existing.name || "Medication").trim();
        const primaryPatientId = existing.patient_id || patientIds[0];
        const allergyReaction = (body.allergyReaction || effectiveReason || "Adverse allergic reaction").trim();
        const allergySeverity = body.allergySeverity || "Moderate";
        const todayFormatted = new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const allergyNotes =
          body.notes ||
          `Discontinued medication on ${todayFormatted} due to reported allergy / adverse reaction: ${effectiveReason || allergyReaction}`;

        const existingAllergy = await query(
          `SELECT id FROM patient_allergies
           WHERE (patient_id = ANY($1::text[]) OR user_id = $2)
             AND LOWER(TRIM(allergen)) = LOWER(TRIM($3))
           LIMIT 1;`,
          [patientIds, payload.userId, allergenName]
        );

        if (existingAllergy.length > 0) {
          const updatedAllergy = await query(
            `UPDATE patient_allergies
             SET reaction = $1,
                 severity = $2,
                 status = 'Patient Reported',
                 source = 'Medication Discontinuation',
                 notes = $3
             WHERE id = $4
             RETURNING *;`,
            [allergyReaction, allergySeverity, allergyNotes, existingAllergy[0].id]
          );
          allergyRecord = updatedAllergy[0];
        } else {
          const insertedAllergy = await query(
            `INSERT INTO patient_allergies
             (patient_id, user_id, allergen, category, reaction, severity, status, source, verification_status, added_date, notes)
             VALUES ($1, $2, $3, 'Medication', $4, $5, 'Patient Reported', 'Medication Discontinuation', 'Patient Reported', $6, $7)
             RETURNING *;`,
            [
              primaryPatientId,
              payload.userId,
              allergenName,
              allergyReaction,
              allergySeverity,
              todayFormatted,
              allergyNotes,
            ]
          );
          allergyRecord = insertedAllergy[0];
        }
      } catch (allergyErr) {
        console.error("Could not sync discontinued medication to patient_allergies:", allergyErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Medication status updated to ${newStatus}${isAllergy ? " and added to your Allergies list" : ""}`,
      medication: updated,
      allergyAdded: Boolean(allergyRecord),
      allergy: allergyRecord,
    });
  } catch (error: any) {
    console.error("Update Medication Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update medication record" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patient/medicines/[id]
 * Soft-discontinues or deletes a patient medication entry.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const medId = parseInt(id, 10);
    if (isNaN(medId)) {
      return NextResponse.json({ error: "Invalid medication ID" }, { status: 400 });
    }

    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user, payload } = authResult;

    const patientIds = getPatientIds(user);
    if (patientIds.length === 0) {
      return NextResponse.json(
        { error: "Patient identity is not configured for this account" },
        { status: 403 }
      );
    }

    const existingRows = await query(
      `SELECT * FROM patient_medications WHERE id = $1;`,
      [medId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const existing = existingRows[0];

    const isOwner =
      existing.user_id === payload.userId ||
      patientIds.includes(existing.patient_id);

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to delete this record" },
        { status: 403 }
      );
    }
    // Set to DISCONTINUED with audit log instead of destroying clinical history
    const todayStr = new Date().toISOString().split("T")[0];
    await query(
      `UPDATE patient_medications
       SET status = 'DISCONTINUED',
           actual_end_date = $1,
           discontinued_reason = 'Discontinued by patient request',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2;`,
      [todayStr, medId]
    );

    await query(
      `INSERT INTO patient_medication_audit (
        medication_id, patient_id, user_id, action, previous_status, new_status, reason, actor
      ) VALUES ($1, $2, $3, 'DISCONTINUED', $4, 'DISCONTINUED', 'Discontinued by user action', $5);`,
      [medId, existing.patient_id, payload.userId, existing.status, payload.name || "Patient"]
    );

    return NextResponse.json({
      success: true,
      message: "Medication successfully moved to Discontinued history",
    });
  } catch (error: any) {
    console.error("Delete Medication Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove medication" },
      { status: 500 }
    );
  }
}

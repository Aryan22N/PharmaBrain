import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePatientSession } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/** Ensures the patient_demographics table exists with all needed columns. */
async function ensureTable() {
  // Use a separate table so it never conflicts with existing patient_onboarding
  await query(`
    CREATE TABLE IF NOT EXISTS patient_demographics (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER UNIQUE NOT NULL,
      patient_id      VARCHAR(64),
      name            VARCHAR(255),
      email           VARCHAR(255),
      age             INTEGER,
      gender          VARCHAR(50),
      blood_group     VARCHAR(20),
      dob             VARCHAR(50),
      occupation      VARCHAR(255),
      marital_status  VARCHAR(100),
      nationality     VARCHAR(100),
      phone           VARCHAR(50),
      emergency_name  VARCHAR(255),
      emergency_phone VARCHAR(50),
      address         TEXT,
      city            VARCHAR(100),
      state           VARCHAR(100),
      pincode         VARCHAR(20),
      conditions      JSONB,
      custom_conditions JSONB,
      history         JSONB,
      default_auto_revoke_days INTEGER DEFAULT 8,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  try {
    await query(`ALTER TABLE patient_demographics ADD COLUMN IF NOT EXISTS default_auto_revoke_days INTEGER DEFAULT 8;`);
  } catch {
    // Column already exists
  }
}

/** GET /api/user/profile */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) return authResult.response;

    const { user, payload } = authResult;
    const userId = payload.userId;
    const patientIds = [user.patientId, user.legacyPatientId].filter(Boolean) as string[];
    const safePatientIds = patientIds.length > 0 ? patientIds : ["__none__"];

    await ensureTable();

    // Fetch demographics row
    const rows = await query(
      `SELECT * FROM patient_demographics WHERE user_id = $1 LIMIT 1;`,
      [userId]
    );

    // Fetch onboarding row to guarantee sync with initial onboarding data
    let onbRow: any = null;
    try {
      const onb = await query(
        `SELECT basic_info, conditions, custom_conditions, history FROM patient_onboarding WHERE user_id = $1 LIMIT 1;`,
        [userId]
      );
      if (onb.length > 0) {
        onbRow = onb[0];
      }
    } catch (e) {
      console.warn("Could not query patient_onboarding:", e);
    }

    const row = rows.length > 0 ? rows[0] : null;
    const basicInfo = (onbRow?.basic_info as Record<string, any>) || {};
    const onbConditions = (onbRow?.conditions as Record<string, any>) || null;
    const onbCustomConditions = onbRow?.custom_conditions || null;
    const onbHistory = onbRow?.history || null;

    // Automatically sync/backfill patient_demographics if it was missing or had empty fields
    if (!row && onbRow) {
      try {
        await query(
          `INSERT INTO patient_demographics (
            user_id, patient_id, name, email, age, gender, blood_group, dob,
            occupation, marital_status, nationality, phone, emergency_name, emergency_phone,
            address, city, state, pincode, conditions, custom_conditions, history, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW())
          ON CONFLICT (user_id) DO NOTHING;`,
          [
            userId,
            user.patientId || "",
            basicInfo.name || user.name || "",
            basicInfo.email || user.email || "",
            basicInfo.age ? parseInt(String(basicInfo.age), 10) : null,
            basicInfo.gender || "Male",
            basicInfo.bloodGroup || "",
            basicInfo.dob || "",
            basicInfo.occupation || "",
            basicInfo.maritalStatus || "",
            basicInfo.nationality || "Indian",
            basicInfo.phone || "",
            basicInfo.emergencyName || "",
            basicInfo.emergencyPhone || "",
            basicInfo.address || "",
            basicInfo.city || "",
            basicInfo.state || "",
            basicInfo.pincode || "",
            JSON.stringify(onbConditions || {}),
            JSON.stringify(onbCustomConditions || []),
            JSON.stringify(onbHistory || {}),
          ]
        );
      } catch (e) {
        console.warn("Auto backfill patient_demographics failed:", e);
      }
    }

    // Fetch recent visits from Document + Analysis
    let visits: any[] = [];
    try {
      const recentDocs = await query(
        `SELECT d.id, d."originalName", d."documentType", d.status, d."uploadedAt",
                a.summary, a."structuredResult"
         FROM "Document" d
         LEFT JOIN "Analysis" a ON d.id = a."documentId"
         WHERE (d."userId" = $1 OR d."patientId" = ANY($2::text[]))
           AND d.status != 'DISCARDED'
         ORDER BY d."uploadedAt" DESC
         LIMIT 15;`,
        [userId, safePatientIds]
      );
      visits = recentDocs.map((d: any) => {
        let sr = d.structuredResult;
        if (typeof sr === "string") { try { sr = JSON.parse(sr); } catch { sr = null; } }
        return {
          id: d.id,
          date: d.uploadedAt,
          hospital: sr?.hospital || "External Clinic",
          doctor: typeof sr?.doctor === "string" ? sr.doctor : (sr?.doctor?.name || "Consultant"),
          documentType: d.documentType || "Prescription",
          status: d.status,
          summary: d.summary || "",
        };
      });
    } catch (e) {
      console.warn("Could not fetch visits:", e);
    }

    const effectiveAge = (row?.age !== null && row?.age !== undefined && row?.age !== "")
      ? row.age
      : (basicInfo.age || "");
    const effectiveBloodGroup = row?.blood_group || basicInfo.bloodGroup || "";
    const effectiveGender = row?.gender || basicInfo.gender || "Male";

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: row?.name || basicInfo.name || user.name,
        email: row?.email || basicInfo.email || user.email,
        patientId: user.patientId,
        legacyPatientId: user.legacyPatientId,
        age: effectiveAge,
        gender: effectiveGender,
        bloodGroup: effectiveBloodGroup,
      },
      demographics: {
        name: row?.name || basicInfo.name || user.name || "",
        email: row?.email || basicInfo.email || user.email || "",
        age: effectiveAge,
        gender: effectiveGender,
        bloodGroup: effectiveBloodGroup,
        dob: row?.dob || basicInfo.dob || "",
        occupation: row?.occupation || basicInfo.occupation || "",
        maritalStatus: row?.marital_status || basicInfo.maritalStatus || "",
        nationality: row?.nationality || basicInfo.nationality || "Indian",
        phone: row?.phone || basicInfo.phone || "",
        emergencyName: row?.emergency_name || basicInfo.emergencyName || "",
        emergencyPhone: row?.emergency_phone || basicInfo.emergencyPhone || "",
        address: row?.address || basicInfo.address || "",
        city: row?.city || basicInfo.city || "",
        state: row?.state || basicInfo.state || "",
        pincode: row?.pincode || basicInfo.pincode || "",
      },
      conditions: (row?.conditions && Object.keys(row.conditions).length > 0)
        ? row.conditions
        : onbConditions || {
            hasDiabetes: false, diabetesType: "", diabetesYear: "", currentHba1c: "",
            hasHypertension: false, hypertensionYear: "", currentBp: "", hasDyslipidemia: false,
          },
      customConditions: (Array.isArray(row?.custom_conditions) && row.custom_conditions.length > 0)
        ? row.custom_conditions
        : Array.isArray(onbCustomConditions)
        ? onbCustomConditions
        : [],
      history: (row?.history && Object.keys(row.history).length > 0)
        ? row.history
        : onbHistory || { surgeries: "", allergies: "", smoking: "", alcohol: "", familyHistory: "" },
      defaultAutoRevokeDays: row?.default_auto_revoke_days || 8,
      visits,
    });
  } catch (err: any) {
    console.error("Profile GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/user/profile */
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) return authResult.response;

    const { user, payload } = authResult;
    const userId = payload.userId;
    const patientId = user.patientId || "";

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

    await ensureTable();

    // Partial update: only defaultAutoRevokeDays
    if (body.defaultAutoRevokeDays !== undefined && !body.demographics) {
      const parsedDays = Number(body.defaultAutoRevokeDays);
      const safeDays = [3, 8, 30].includes(parsedDays) ? parsedDays : 8;
      await query(
        `INSERT INTO patient_demographics (user_id, patient_id, default_auto_revoke_days, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           default_auto_revoke_days = EXCLUDED.default_auto_revoke_days,
           updated_at = NOW();`,
        [userId, patientId, safeDays]
      );
      return NextResponse.json({ success: true, message: `Auto-revoke default updated to ${safeDays} days.` });
    }

    const { demographics, conditions, customConditions, history, defaultAutoRevokeDays } = body;
    const safeRevokeDays = defaultAutoRevokeDays ? Number(defaultAutoRevokeDays) : null;

    await query(
      `INSERT INTO patient_demographics (
        user_id, patient_id, name, email, age, gender, blood_group, dob,
        occupation, marital_status, nationality,
        phone, emergency_name, emergency_phone,
        address, city, state, pincode,
        conditions, custom_conditions, history, default_auto_revoke_days, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,COALESCE($22, 8),NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        patient_id      = EXCLUDED.patient_id,
        name            = EXCLUDED.name,
        email           = EXCLUDED.email,
        age             = EXCLUDED.age,
        gender          = EXCLUDED.gender,
        blood_group     = EXCLUDED.blood_group,
        dob             = EXCLUDED.dob,
        occupation      = EXCLUDED.occupation,
        marital_status  = EXCLUDED.marital_status,
        nationality     = EXCLUDED.nationality,
        phone           = EXCLUDED.phone,
        emergency_name  = EXCLUDED.emergency_name,
        emergency_phone = EXCLUDED.emergency_phone,
        address         = EXCLUDED.address,
        city            = EXCLUDED.city,
        state           = EXCLUDED.state,
        pincode         = EXCLUDED.pincode,
        conditions      = EXCLUDED.conditions,
        custom_conditions = EXCLUDED.custom_conditions,
        history         = EXCLUDED.history,
        default_auto_revoke_days = COALESCE(EXCLUDED.default_auto_revoke_days, patient_demographics.default_auto_revoke_days, 8),
        updated_at      = NOW();`,
      [
        userId,
        patientId,
        demographics?.name || "",
        demographics?.email || "",
        demographics?.age ? parseInt(String(demographics.age), 10) : null,
        demographics?.gender || "Male",
        demographics?.bloodGroup || "",
        demographics?.dob || "",
        demographics?.occupation || "",
        demographics?.maritalStatus || "",
        demographics?.nationality || "Indian",
        demographics?.phone || "",
        demographics?.emergencyName || "",
        demographics?.emergencyPhone || "",
        demographics?.address || "",
        demographics?.city || "",
        demographics?.state || "",
        demographics?.pincode || "",
        JSON.stringify(conditions || {}),
        JSON.stringify(customConditions || []),
        JSON.stringify(history || {}),
        safeRevokeDays,
      ]
    );

    // Also update User table name
    if (demographics?.name?.trim()) {
      await query(`UPDATE "User" SET name = $1 WHERE id = $2;`, [
        demographics.name.trim(),
        userId,
      ]);
    }

    // Keep patient_onboarding table in complete synchronization
    try {
      await query(
        `INSERT INTO patient_onboarding (user_id, patient_id, basic_info, conditions, custom_conditions, history, is_completed, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           patient_id = EXCLUDED.patient_id,
           basic_info = EXCLUDED.basic_info,
           conditions = EXCLUDED.conditions,
           custom_conditions = EXCLUDED.custom_conditions,
           history = EXCLUDED.history,
           updated_at = NOW();`,
        [
          userId,
          patientId,
          JSON.stringify({
            name: demographics?.name || "",
            email: demographics?.email || "",
            age: demographics?.age || "",
            gender: demographics?.gender || "Male",
            bloodGroup: demographics?.bloodGroup || "",
            dob: demographics?.dob || "",
            occupation: demographics?.occupation || "",
            maritalStatus: demographics?.maritalStatus || "",
            nationality: demographics?.nationality || "Indian",
            phone: demographics?.phone || "",
            emergencyName: demographics?.emergencyName || "",
            emergencyPhone: demographics?.emergencyPhone || "",
            address: demographics?.address || "",
            city: demographics?.city || "",
            state: demographics?.state || "",
            pincode: demographics?.pincode || "",
          }),
          JSON.stringify(conditions || {}),
          JSON.stringify(customConditions || []),
          JSON.stringify(history || {}),
        ]
      );
    } catch (onbSyncErr) {
      console.warn("Sync to patient_onboarding warning:", onbSyncErr);
    }

    return NextResponse.json({ success: true, message: "Profile saved successfully." });
  } catch (err: any) {
    console.error("Profile PUT error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

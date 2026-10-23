import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePatientSession } from "@/lib/serverAuth";
import { syncConditionsFromProfile } from "@/lib/patientConditions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { payload } = authResult;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request payload." }, { status: 400 });
    }

    const { basicInfo, conditions, customConditions, history } = body;
    const userId = payload.userId;
    const patientId = payload.patientId || "960183477";

    // 1. Ensure table patient_onboarding exists in Supabase PostgreSQL
    await query(`
      CREATE TABLE IF NOT EXISTS patient_onboarding (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        patient_id VARCHAR(64) NOT NULL,
        basic_info JSONB,
        conditions JSONB,
        custom_conditions JSONB,
        history JSONB,
        is_completed BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Save or update onboarding profile in PostgreSQL
    await query(
      `INSERT INTO patient_onboarding (user_id, patient_id, basic_info, conditions, custom_conditions, history, is_completed, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         patient_id = EXCLUDED.patient_id,
         basic_info = EXCLUDED.basic_info,
         conditions = EXCLUDED.conditions,
         custom_conditions = EXCLUDED.custom_conditions,
         history = EXCLUDED.history,
         is_completed = TRUE,
         updated_at = NOW();`,
      [
        userId,
        patientId,
        JSON.stringify(basicInfo || {}),
        JSON.stringify(conditions || {}),
        JSON.stringify(customConditions || []),
        JSON.stringify(history || {}),
      ]
    );

    // 3. Update User table name if provided
    if (basicInfo?.name) {
      await query(`UPDATE "User" SET name = $1 WHERE id = $2;`, [basicInfo.name.trim(), userId]);
    }

    // 3b. Keep patient_demographics table in complete synchronization
    try {
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

      await query(
        `INSERT INTO patient_demographics (
          user_id, patient_id, name, email, age, gender, blood_group, dob,
          occupation, marital_status, nationality, phone, emergency_name, emergency_phone,
          address, city, state, pincode, conditions, custom_conditions, history, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          patient_id      = EXCLUDED.patient_id,
          name            = EXCLUDED.name,
          email           = COALESCE(NULLIF(EXCLUDED.email, ''), patient_demographics.email),
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
          updated_at      = NOW();`,
        [
          userId,
          patientId,
          basicInfo?.name || "",
          basicInfo?.email || "",
          basicInfo?.age ? parseInt(String(basicInfo.age), 10) : null,
          basicInfo?.gender || "Male",
          basicInfo?.bloodGroup || "",
          basicInfo?.dob || "",
          basicInfo?.occupation || "",
          basicInfo?.maritalStatus || "",
          basicInfo?.nationality || "Indian",
          basicInfo?.phone || "",
          basicInfo?.emergencyName || "",
          basicInfo?.emergencyPhone || "",
          basicInfo?.address || "",
          basicInfo?.city || "",
          basicInfo?.state || "",
          basicInfo?.pincode || "",
          JSON.stringify(conditions || {}),
          JSON.stringify(customConditions || []),
          JSON.stringify(history || {}),
        ]
      );
    } catch (demoSyncErr) {
      console.warn("Failed to sync patient_demographics from onboarding:", demoSyncErr);
    }

    // 4. Synchronize diagnosed conditions into patient_conditions & starter medications
    try {
      await syncConditionsFromProfile({
        patientId,
        userId,
        conditions,
        customConditions,
      });
    } catch (syncErr) {
      console.warn("Conditions sync from onboarding warning:", syncErr);
    }

    return NextResponse.json({
      success: true,
      message: "Patient initial health context saved to database.",
      patientId,
      isOnboarded: true,
    });
  } catch (error: any) {
    console.error("Onboarding API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save onboarding health context." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { payload } = authResult;

    const rows = await query(
      `SELECT basic_info, conditions, custom_conditions, history, is_completed 
       FROM patient_onboarding 
       WHERE user_id = $1 
       LIMIT 1;`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ isOnboarded: false, profile: null });
    }

    return NextResponse.json({
      isOnboarded: rows[0].is_completed ?? true,
      profile: {
        basicInfo: rows[0].basic_info,
        conditions: rows[0].conditions,
        customConditions: rows[0].custom_conditions,
        history: rows[0].history,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ isOnboarded: false, error: err.message }, { status: 500 });
  }
}

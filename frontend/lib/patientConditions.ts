import { query } from "@/lib/db";

/**
 * Ensures the `patient_conditions` and `observations` tables exist in PostgreSQL/Supabase.
 */
export async function ensurePatientConditionsTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS patient_conditions (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(64),
        user_id INTEGER,
        condition_name VARCHAR(255) NOT NULL,
        icd10_code VARCHAR(50),
        category VARCHAR(100) DEFAULT 'Chronic',
        status VARCHAR(50) DEFAULT 'ACTIVE',
        diagnosed_date VARCHAR(50),
        severity VARCHAR(50) DEFAULT 'Moderate',
        doctor VARCHAR(255),
        facility VARCHAR(255),
        source VARCHAR(100) DEFAULT 'Patient Reported',
        verification_status VARCHAR(100) DEFAULT 'Patient Reported',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient ON patient_conditions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_conditions_user ON patient_conditions(user_id);

      CREATE TABLE IF NOT EXISTS observations (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(64) NOT NULL,
        kind VARCHAR(50) NOT NULL,
        systolic NUMERIC,
        diastolic NUMERIC,
        value NUMERIC,
        unit VARCHAR(50),
        obs_date VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_observations_patient ON observations(patient_id);
    `);
  } catch (err) {
    console.warn("ensurePatientConditionsTable error:", err);
  }
}

export interface SyncConditionsParams {
  patientId?: string | null;
  userId: number;
  conditions?: Record<string, any> | null;
  customConditions?: Array<{
    id?: string;
    name?: string;
    year?: string;
    details?: string;
  }> | null;
}

/**
 * Synchronizes structured conditions from onboarding/profile JSON into relational `patient_conditions`.
 */
export async function syncConditionsFromProfile({
  patientId,
  userId,
  conditions,
  customConditions,
}: SyncConditionsParams): Promise<void> {
  await ensurePatientConditionsTable();

  const safePatientId = (patientId && typeof patientId === "string" && patientId.trim())
    ? patientId.trim()
    : String(userId);
  const cond = conditions || {};
  const currentYear = new Date().getFullYear().toString();
  const todayIso = new Date().toISOString().split("T")[0];

  // 1. Diabetes Mellitus
  if (cond.hasDiabetes) {
    try {
      const existing = await query(
        `SELECT id FROM patient_conditions 
         WHERE (patient_id = $1 OR user_id = $2) 
           AND condition_name ILIKE '%Diabetes%' 
         LIMIT 1;`,
        [safePatientId, userId]
      );

      const rawType = (cond.diabetesType || "").trim();
      let conditionName = "Type 2 Diabetes Mellitus";
      if (rawType) {
        conditionName = rawType.toLowerCase().includes("diabetes")
          ? rawType
          : `${rawType} Diabetes Mellitus`;
      }
      const icd10 = conditionName.toLowerCase().includes("type 1") ? "E10.9" : "E11.9";
      const diagDate = cond.diabetesYear ? `${cond.diabetesYear}-01-01` : `${currentYear}-01-01`;
      const notes = cond.currentHba1c
        ? `Baseline HbA1c reported at ${cond.currentHba1c}% during initial onboarding.`
        : "Diagnosed condition reported during initial onboarding.";

      if (existing.length === 0) {
        await query(
          `INSERT INTO patient_conditions 
           (patient_id, user_id, condition_name, icd10_code, category, status, diagnosed_date, severity, doctor, facility, source, verification_status, notes)
           VALUES ($1, $2, $3, $4, 'Endocrine', 'ACTIVE', $5, 'Moderate', 'Attending Physician', 'Patient Intake Portal', 'Patient Reported', 'Patient Confirmed', $6);`,
          [safePatientId, userId, conditionName, icd10, diagDate, notes]
        );
      }

      // Ensure starter medication Metformin is safely logged in patient_medications
      const existingMed = await query(
        `SELECT id FROM patient_medications 
         WHERE (patient_id = $1 OR user_id = $2) 
           AND name ILIKE '%Metformin%' 
         LIMIT 1;`,
        [safePatientId, userId]
      );
      if (existingMed.length === 0) {
        await query(
          `INSERT INTO patient_medications (patient_id, user_id, name, strength, status, indication, frequency, route, start_date, doctor, source, reliability, verification_status)
           VALUES ($1, $2, 'Metformin', '500 mg', 'ACTIVE', 'Type 2 Diabetes Mellitus', '1-0-1', 'Oral', $3, 'Attending Physician', 'Patient Entry', 'Medium', 'Patient Confirmed')
           ON CONFLICT DO NOTHING;`,
          [safePatientId, userId, diagDate]
        );
      }

      // Record HbA1c in observations if provided
      if (cond.currentHba1c) {
        const val = parseFloat(String(cond.currentHba1c).replace("%", "").trim());
        if (!isNaN(val) && val > 0) {
          const obsExists = await query(
            `SELECT id FROM observations WHERE patient_id = $1 AND kind = 'hba1c' LIMIT 1;`,
            [safePatientId]
          );
          if (obsExists.length === 0) {
            await query(
              `INSERT INTO observations (patient_id, kind, value, unit, obs_date)
               VALUES ($1, 'hba1c', $2, '%', $3);`,
              [safePatientId, val, todayIso]
            );
          }
        }
      }
    } catch (err) {
      console.warn("Failed to sync Diabetes condition:", err);
    }
  }

  // 2. Hypertension
  if (cond.hasHypertension) {
    try {
      const existing = await query(
        `SELECT id FROM patient_conditions 
         WHERE (patient_id = $1 OR user_id = $2) 
           AND condition_name ILIKE '%Hypertension%' 
         LIMIT 1;`,
        [safePatientId, userId]
      );

      const diagDate = cond.hypertensionYear ? `${cond.hypertensionYear}-01-01` : `${currentYear}-01-01`;
      const notes = cond.currentBp
        ? `Baseline Blood Pressure reported at ${cond.currentBp} mmHg.`
        : "Diagnosed cardiovascular condition reported during initial onboarding.";

      if (existing.length === 0) {
        await query(
          `INSERT INTO patient_conditions 
           (patient_id, user_id, condition_name, icd10_code, category, status, diagnosed_date, severity, doctor, facility, source, verification_status, notes)
           VALUES ($1, $2, 'Essential (Primary) Hypertension', 'I10', 'Cardiovascular', 'ACTIVE', $3, 'Moderate', 'Attending Physician', 'Patient Intake Portal', 'Patient Reported', 'Patient Confirmed', $4);`,
          [safePatientId, userId, diagDate, notes]
        );
      }

      // Record Blood Pressure in observations if provided (e.g. "130/85")
      if (cond.currentBp) {
        const bpMatch = String(cond.currentBp).match(/(\d{2,3})\s*[\/\-]\s*(\d{2,3})/);
        if (bpMatch) {
          const sys = parseInt(bpMatch[1], 10);
          const dia = parseInt(bpMatch[2], 10);
          const obsExists = await query(
            `SELECT id FROM observations WHERE patient_id = $1 AND kind = 'bp' LIMIT 1;`,
            [safePatientId]
          );
          if (obsExists.length === 0) {
            await query(
              `INSERT INTO observations (patient_id, kind, systolic, diastolic, unit, obs_date)
               VALUES ($1, 'bp', $2, $3, 'mmHg', $4);`,
              [safePatientId, sys, dia, todayIso]
            );
          }
        }
      }
    } catch (err) {
      console.warn("Failed to sync Hypertension condition:", err);
    }
  }

  // 3. Dyslipidemia / Hyperlipidemia
  if (cond.hasDyslipidemia) {
    try {
      const existing = await query(
        `SELECT id FROM patient_conditions 
         WHERE (patient_id = $1 OR user_id = $2) 
           AND (condition_name ILIKE '%Dyslipidemia%' OR condition_name ILIKE '%Hyperlipidemia%') 
         LIMIT 1;`,
        [safePatientId, userId]
      );

      if (existing.length === 0) {
        await query(
          `INSERT INTO patient_conditions 
           (patient_id, user_id, condition_name, icd10_code, category, status, diagnosed_date, severity, doctor, facility, source, verification_status, notes)
           VALUES ($1, $2, 'Dyslipidemia / Hyperlipidemia', 'E78.5', 'Endocrine', 'ACTIVE', $3, 'Moderate', 'Attending Physician', 'Patient Intake Portal', 'Patient Reported', 'Patient Confirmed', 'Diagnosed lipid disorder reported during initial onboarding.');`,
          [safePatientId, userId, `${currentYear}-01-01`]
        );
      }
    } catch (err) {
      console.warn("Failed to sync Dyslipidemia condition:", err);
    }
  }

  // 4. Custom Additional Conditions
  if (Array.isArray(customConditions)) {
    for (const c of customConditions) {
      if (!c || !c.name || !c.name.trim()) continue;
      const cleanName = c.name.trim();
      try {
        const existing = await query(
          `SELECT id FROM patient_conditions 
           WHERE (patient_id = $1 OR user_id = $2) 
             AND LOWER(TRIM(condition_name)) = LOWER(TRIM($3)) 
           LIMIT 1;`,
          [safePatientId, userId, cleanName]
        );

        if (existing.length === 0) {
          const diagDate = c.year ? `${c.year}-01-01` : todayIso;
          const notes = c.details || "Custom condition reported by patient during profile setup.";
          await query(
            `INSERT INTO patient_conditions 
             (patient_id, user_id, condition_name, icd10_code, category, status, diagnosed_date, severity, doctor, facility, source, verification_status, notes)
             VALUES ($1, $2, $3, NULL, 'Chronic', 'ACTIVE', $4, 'Moderate', 'Consulting Physician', 'Patient Intake Portal', 'Patient Reported', 'Patient Confirmed', $5);`,
            [safePatientId, userId, cleanName, diagDate, notes]
          );
        }
      } catch (err) {
        console.warn(`Failed to sync custom condition "${cleanName}":`, err);
      }
    }
  }
}

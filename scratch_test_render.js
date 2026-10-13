const crypto = require('crypto');
const secret = process.env.JWT_SECRET || 'pharma_brain_patient_dmr_jwt_secret_key_2026_super_secure!';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const fullPayload = { ...payload, exp };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function testRender() {
  const docToken = createToken({ userId: 61, role: 'DOCTOR', email: 'aryan_2@gmail.com', name: 'Dr.Aryan' });
  const res = await fetch('http://localhost:3000/api/doctor/patients/P-675323412/records', {
    headers: { Authorization: `Bearer ${docToken}` }
  });
  const dossier = await res.json();
  console.log('Got dossier keys:', Object.keys(dossier));

  // Now test each property access in page.tsx
  const {
    patient,
    medicalSummary,
    documents,
    medications,
    observations,
    longitudinalTrends,
    authorization,
    conditions: dbConditions,
    allergies: dbAllergies,
  } = dossier;

  console.log('Testing step 1: metadata derivation');
  const basicInfo = patient.onboardingInfo?.basic_info || {};
  const patientAge = basicInfo.age ? `${basicInfo.age} y/o` : "Adult";
  const patientGender = basicInfo.gender ? String(basicInfo.gender) : "Patient";
  const patientDob = basicInfo.dob ? String(basicInfo.dob) : null;
  const conditionsList = Array.isArray(patient.onboardingInfo?.conditions)
    ? (patient.onboardingInfo?.conditions)
    : [];
  const customConditionsList = Array.isArray(patient.onboardingInfo?.custom_conditions)
    ? (patient.onboardingInfo?.custom_conditions)
    : [];
  const dbCondNames = (dbConditions || []).map((c) => c.condition_name).filter(Boolean);
  const allConditions = Array.from(new Set([...dbCondNames, ...conditionsList, ...customConditionsList]));

  const dbAllergyNames = (dbAllergies || []).map((a) => a.allergen).filter(Boolean);
  const patientAllergies =
    dbAllergyNames.length > 0
      ? dbAllergyNames.join(", ")
      : patient.onboardingInfo?.history?.allergies || null;

  console.log('Testing step 2: observations derivation');
  const bpObs = observations.filter((o) => o.kind === "bp" || o.kind === "blood_pressure");
  const latestBp = bpObs[bpObs.length - 1] || null;

  const glucoseObs = observations.filter(
    (o) =>
      o.kind === "glucose" ||
      o.kind === "sugar_fasting" ||
      o.kind === "sugar_random" ||
      o.kind === "sugar_post_meal" ||
      o.kind.includes("glucose") ||
      o.kind.includes("sugar")
  );
  const latestGlucose = glucoseObs[glucoseObs.length - 1] || null;

  const hba1cObs = observations.filter(
    (o) => o.kind === "hba1c" || o.kind.includes("hba1c") || o.kind.includes("a1c")
  );
  const latestHba1c = hba1cObs[hba1cObs.length - 1] || null;

  const hrObs = observations.filter(
    (o) => o.kind === "heart_rate" || o.kind === "pulse" || o.kind === "hr" || o.kind === "pr"
  );
  const latestHr = hrObs[hrObs.length - 1] || null;

  const spo2Obs = observations.filter(
    (o) => o.kind === "spo2" || o.kind.includes("spo2") || o.kind.includes("oxygen") || o.kind.includes("o2")
  );
  const latestSpo2 = spo2Obs[spo2Obs.length - 1] || null;

  console.log('Testing step 3: Sparkline / history derivation');
  const bpHistory = bpObs
    .map((o) => ({
      systolic: o.systolic ?? (typeof o.value === "number" ? Math.round(o.value) : null),
      diastolic: o.diastolic ?? null,
      date: (o.obs_date || "").toString().slice(0, 10),
    }))
    .filter((p) => p.systolic != null);

  const glucoseHistory = glucoseObs
    .map((o) => ({
      value: o.value != null ? Math.round(Number(o.value)) : 0,
      date: (o.obs_date || "").toString().slice(0, 10),
    }))
    .filter((p) => p.value > 0);

  const hba1cHistory = hba1cObs
    .map((o) => ({
      value: o.value != null ? Number(Number(o.value).toFixed(1)) : 0,
      date: (o.obs_date || "").toString().slice(0, 10),
    }))
    .filter((p) => p.value > 0);

  console.log('Testing step 4: Header & Initials');
  console.log('authorizedDoctor:', authorization.authorizedDoctor);
  const docChar = authorization.authorizedDoctor.charAt(0).toUpperCase();
  console.log('docChar:', docChar);

  const initials = patient.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  console.log('initials:', initials);

  console.log('SUCCESS so far! Let us check further down in page.tsx');
}

testRender().catch(console.error);

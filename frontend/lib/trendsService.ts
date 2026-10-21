import { query } from "@/lib/db";
import {
  calculatePatientTrends,
  PatientLongitudinalTrends,
  PatientEligibilityInfo,
  EligiblePrescriptionItem,
} from "@/lib/trends";
import crypto from "crypto";

const ALGORITHM_VERSION = "v1.2";
const PROMPT_VERSION = "v1.1";

export interface CachedSummaryEntry {
  hash: string;
  summary: any;
  cachedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __patientTrendsMemoryCache: Map<string, CachedSummaryEntry> | undefined;
}

const memoryCache: Map<string, CachedSummaryEntry> =
  global.__patientTrendsMemoryCache || new Map<string, CachedSummaryEntry>();

if (process.env.NODE_ENV !== "production") {
  global.__patientTrendsMemoryCache = memoryCache;
}

export interface GeminiTrendsResponse {
  narrative: string;
  keyHighlights: string[];
  questionsForDoctor: string[];
  safetyDisclaimer: string;
}

export function validateGeminiResponse(obj: any): GeminiTrendsResponse | null {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.narrative !== "string" || obj.narrative.trim().length === 0) return null;
  if (!Array.isArray(obj.keyHighlights) || obj.keyHighlights.length === 0) return null;
  if (!Array.isArray(obj.questionsForDoctor) || obj.questionsForDoctor.length === 0) return null;
  if (typeof obj.safetyDisclaimer !== "string" || obj.safetyDisclaimer.trim().length === 0) return null;

  return {
    narrative: obj.narrative.trim(),
    keyHighlights: obj.keyHighlights.map((s: any) => String(s).trim()).filter(Boolean),
    questionsForDoctor: obj.questionsForDoctor.map((s: any) => String(s).trim()).filter(Boolean),
    safetyDisclaimer: obj.safetyDisclaimer.trim(),
  };
}

export function isValidIsoDate(str: any): boolean {
  if (typeof str !== "string") return false;
  const trimmed = str.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const d = new Date(trimmed);
  return !isNaN(d.getTime());
}

export function parseSR(rawSR: any): any {
  if (!rawSR) return {};
  if (typeof rawSR === "string") {
    try {
      return JSON.parse(rawSR);
    } catch {
      return {};
    }
  }
  return rawSR;
}

export function extractClinicalDate(doc: any): string | null {
  const sr = parseSR(doc.structuredResult);
  if (isValidIsoDate(sr.date_iso)) return sr.date_iso.trim().slice(0, 10);
  if (isValidIsoDate(sr.rx_date)) return sr.rx_date.trim().slice(0, 10);
  if (isValidIsoDate(sr.date)) return sr.date.trim().slice(0, 10);

  if (typeof doc.originalName === "string") {
    const match = doc.originalName.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (match && isValidIsoDate(match[1])) return match[1];
  }

  if (typeof sr.date_raw === "string") {
    const match = sr.date_raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (match && isValidIsoDate(match[1])) return match[1];
  }

  return null;
}

export function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str).trim().toLowerCase();
}

export function computeCacheFingerprint(
  patientCode: string,
  distinctDates: string[],
  prescriptions: EligiblePrescriptionItem[],
  observations: any[]
): string {
  const rxSig = prescriptions
    .map((p) => `${p.id}:${p.date}:${normalizeStr(p.doctor)}:${normalizeStr(p.hospital)}`)
    .sort()
    .join("|");

  const obsSig = observations
    .map(
      (o) =>
        `${(o.obs_date || o.date || "").slice(0, 10)}:${o.kind}:${o.systolic ?? ""}:${
          o.diastolic ?? ""
        }:${o.value ?? ""}:${o.unit ?? ""}`
    )
    .sort()
    .join("|");

  const datesSig = distinctDates.join(",");

  return crypto
    .createHash("sha256")
    .update(
      `${patientCode}::algo=${ALGORITHM_VERSION}::prompt=${PROMPT_VERSION}::dates=[${datesSig}]::rx=[${rxSig}]::obs=[${obsSig}]`
    )
    .digest("hex");
}

export async function verifyPrescriptionEligibility(user: any, patientIds: string[]) {
  const documents = await query(
    `SELECT d.id, d."originalName", d."storedFilename", d."documentType", d.status, d."uploadedAt", d."filePath",
            a.summary, a."structuredResult"
     FROM "Document" d
     LEFT JOIN "Analysis" a ON d.id = a."documentId"
     WHERE (d."userId" = $1 OR d."patientId" = ANY($2::text[]))
     ORDER BY d.id ASC;`,
    [user.id, patientIds]
  );

  let confirmedPrescriptionsRows: any[] = [];
  try {
    confirmedPrescriptionsRows = await query(
      `SELECT cp.id, cp.extraction_id, cp.patient_id, cp.rx_date, cp.hospital, cp.doctor, cp.doctor_reg_no, cp.data_json, cp.confirmed_at
       FROM confirmed_prescriptions cp
       WHERE cp.patient_id = ANY($1::text[])
       ORDER BY cp.id ASC;`,
      [patientIds]
    );

    try {
      const extraConfirmed = await query(
        `SELECT cp.id, cp.extraction_id, cp.patient_id, cp.rx_date, cp.hospital, cp.doctor, cp.doctor_reg_no, cp.data_json, cp.confirmed_at
         FROM confirmed_prescriptions cp
         JOIN extractions ex ON ex.id = cp.extraction_id
         JOIN raw_ocr ro ON ro.id = ex.raw_ocr_id
         WHERE ro.patient_id::text = ANY($1::text[])
         ORDER BY cp.id ASC;`,
        [patientIds]
      );
      const knownPrescriptionIds = new Set(confirmedPrescriptionsRows.map((row) => String(row.id)));
      confirmedPrescriptionsRows.push(
        ...extraConfirmed.filter((row) => !knownPrescriptionIds.has(String(row.id)))
      );
    } catch (joinErr) {
      console.warn("[Trends] Extraction-linked prescription lookup failed:", joinErr);
    }
  } catch (err) {
    console.warn("[Trends] Error querying confirmed_prescriptions:", err);
  }

  const extractionToDocMap = new Map<number, any>();
  documents.forEach((d: any) => {
    const structuredResult = parseSR(d.structuredResult);
    let extId: number | null = null;
    if (d.filePath) {
      const m = d.filePath.match(/\/extractions\/(\d+)/);
      if (m) extId = parseInt(m[1], 10);
    }
    if (!extId && structuredResult.reference_id) {
      const m = String(structuredResult.reference_id).match(/(\d+)/);
      if (m) extId = parseInt(m[1], 10);
    }
    if (extId) extractionToDocMap.set(extId, d);
  });

  const prescriptMap = new Map<string, EligiblePrescriptionItem>();

  for (const cp of confirmedPrescriptionsRows) {
    const rxDate = (cp.rx_date || "").toString().slice(0, 10);
    if (!isValidIsoDate(rxDate)) continue;

    let dataJson: any = {};
    if (cp.data_json) {
      dataJson = typeof cp.data_json === "string" ? JSON.parse(cp.data_json) : cp.data_json;
    }

    const linkedDoc = cp.extraction_id ? extractionToDocMap.get(cp.extraction_id) : null;
    const docName = linkedDoc?.originalName || `${cp.hospital || "Prescription"} - ${rxDate}`;
    const hosp = cp.hospital || dataJson.hospital || linkedDoc?.structuredResult?.hospital || null;
    const doc = cp.doctor || (typeof dataJson.doctor === "string" ? dataJson.doctor : dataJson.doctor?.name) || null;
    const imgUrl = linkedDoc?.storedFilename || dataJson.image_url || null;

    const dedupKey = cp.extraction_id
      ? `ext_${cp.extraction_id}`
      : `date_${rxDate}_${normalizeStr(hosp)}_${normalizeStr(doc)}`;

    if (!prescriptMap.has(dedupKey)) {
      prescriptMap.set(dedupKey, {
        id: cp.id,
        documentId: linkedDoc?.id || null,
        extractionId: cp.extraction_id || null,
        date: rxDate,
        hospital: hosp,
        doctor: doc,
        documentName: docName,
        filePath: linkedDoc?.filePath || (cp.extraction_id ? `/extractions/${cp.extraction_id}` : null),
        imageUrl: imgUrl,
      });
    }
  }

  for (const d of documents) {
    if (d.status !== "CONFIRMED") continue;
    const rxDate = extractClinicalDate(d);
    if (!rxDate || !isValidIsoDate(rxDate)) continue;

    const sr = parseSR(d.structuredResult);
    let extId: number | null = null;
    if (d.filePath) {
      const m = d.filePath.match(/\/extractions\/(\d+)/);
      if (m) extId = parseInt(m[1], 10);
    }
    if (!extId && sr.reference_id) {
      const m = String(sr.reference_id).match(/(\d+)/);
      if (m) extId = parseInt(m[1], 10);
    }

    const hosp = sr.hospital || null;
    const doc = typeof sr.doctor === "string" ? sr.doctor : sr.doctor?.name || null;
    const dedupKey = extId
      ? `ext_${extId}`
      : `date_${rxDate}_${normalizeStr(hosp)}_${normalizeStr(doc)}`;

    if (!prescriptMap.has(dedupKey)) {
      prescriptMap.set(dedupKey, {
        id: d.id,
        documentId: d.id,
        extractionId: extId,
        date: rxDate,
        hospital: hosp,
        doctor: doc,
        documentName: d.originalName || `${hosp || "Prescription"} - ${rxDate}`,
        filePath: d.filePath || (extId ? `/extractions/${extId}` : null),
        imageUrl: sr.image_url || d.storedFilename || null,
      });
    } else {
      const existing = prescriptMap.get(dedupKey)!;
      if (!existing.documentId) existing.documentId = d.id;
      if (!existing.documentName) existing.documentName = d.originalName;
      if (!existing.imageUrl) existing.imageUrl = sr.image_url || d.storedFilename;
    }
  }

  try {
    const verifiedTimelineRows = await query(
      `SELECT id, event_date, facility, doctor, reference_id
       FROM patient_timeline_events
       WHERE patient_id = ANY($1::text[])
         AND verification_status = 'Prescription Verified'
         AND reference_id LIKE 'HMS-RX-%'
       ORDER BY event_date ASC, id ASC;`,
      [patientIds]
    );

    for (const event of verifiedTimelineRows) {
      const rxDate = typeof event.event_date === "string"
        ? event.event_date.slice(0, 10)
        : event.event_date instanceof Date
          ? event.event_date.toISOString().slice(0, 10)
          : "";
      if (!isValidIsoDate(rxDate)) continue;

      const referenceMatch = String(event.reference_id || "").match(/^HMS-RX-(\d+)$/i);
      const extractionId = referenceMatch ? Number(referenceMatch[1]) : null;
      const dedupKey = extractionId
        ? `ext_${extractionId}`
        : `date_${rxDate}_${normalizeStr(event.facility)}_${normalizeStr(event.doctor)}`;
      if (prescriptMap.has(dedupKey)) continue;

      const linkedDoc = extractionId ? extractionToDocMap.get(extractionId) : null;
      prescriptMap.set(dedupKey, {
        id: event.id,
        documentId: linkedDoc?.id || null,
        extractionId,
        date: rxDate,
        hospital: event.facility || null,
        doctor: event.doctor || null,
        documentName: linkedDoc?.originalName || `Prescription - ${rxDate}`,
        filePath: linkedDoc?.filePath || (extractionId ? `/extractions/${extractionId}` : null),
        imageUrl: linkedDoc?.storedFilename || null,
      });
    }
  } catch (timelineErr) {
    console.warn("[Trends] Verified prescription timeline lookup failed:", timelineErr);
  }

  const eligiblePrescriptions = Array.from(prescriptMap.values()).sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const distinctDates = Array.from(new Set(eligiblePrescriptions.map((p) => p.date))).sort();
  const distinctDatesCount = distinctDates.length;
  const isEligible = distinctDatesCount >= 5;
  const progressPercentage = Math.min(100, Math.round((distinctDatesCount / 5) * 100));

  const message = isEligible
    ? `Longitudinal clinical threshold met (${distinctDatesCount} distinct clinical dates).`
    : `${distinctDatesCount} of 5 eligible clinical dates recorded. At least 5 confirmed prescriptions across distinct dates are required for full longitudinal trend analysis.`;

  const eligibility: PatientEligibilityInfo = {
    isEligible,
    distinctDatesCount,
    requiredCount: 5,
    distinctDates,
    eligiblePrescriptions,
    progressPercentage,
    message,
  };

  return {
    eligibility,
    documents,
  };
}

export function generateDeterministicFallbackSummary(
  trends: PatientLongitudinalTrends,
  userName: string
): GeminiTrendsResponse {
  const bp = trends.metrics.bp;
  const gl = trends.metrics.glucose;
  const hba1c = trends.metrics.hba1c;

  let bpComment = "Blood pressure readings are currently within clinical monitoring targets.";
  if (bp.latest) {
    if (bp.overallTrend === "improving") {
      bpComment = `Your blood pressure shows an encouraging downward trend, moving to ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage}).`;
    } else if (bp.sustainedRiseWarning) {
      bpComment = `Your blood pressure has shown an upward shift over recent visits, currently recorded at ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage}).`;
    } else {
      bpComment = `Your latest recorded blood pressure is ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage}).`;
    }
  }

  let glycemicComment = "Glycemic parameters are stable across recent clinical visits.";
  if (hba1c.latest) {
    glycemicComment = `Your latest HbA1c is ${hba1c.latest.value}%, classified in the ${hba1c.latest.stage} range.`;
  } else if (gl.latest) {
    glycemicComment = `Your latest blood sugar is ${gl.latest.value} ${gl.latest.unit} (${gl.latest.stage}).`;
  }

  const narrative = `Hello ${userName || "Patient"}, reviewing your health trajectory across ${
    trends.totalEncounters
  } recorded visits indicates an overall ${trends.clinicalSummary.overallRiskTier.toLowerCase()} profile. ${bpComment} ${glycemicComment} Consistent monitoring between encounters gives your medical team actionable insight into how your wellness and therapeutic plans are working.`;

  const keyHighlights: string[] = [];
  if (bp.latest) {
    keyHighlights.push(`Latest BP: ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage})`);
  }
  if (bp.totalDeltaSystolic != null && bp.totalDeltaSystolic !== 0) {
    keyHighlights.push(
      `Systolic trajectory change: ${bp.totalDeltaSystolic > 0 ? "+" : ""}${bp.totalDeltaSystolic} mmHg from initial baseline`
    );
  }
  if (hba1c.latest) {
    keyHighlights.push(`HbA1c glycemic control: ${hba1c.latest.value}% (${hba1c.latest.stage})`);
  }
  if (trends.metrics.pulse.latest) {
    keyHighlights.push(`Resting heart rate stable at ${trends.metrics.pulse.latest.value} bpm`);
  }

  return {
    narrative,
    keyHighlights: keyHighlights.slice(0, 4),
    questionsForDoctor: [
      `How do my blood pressure readings (${
        bp.latest ? `${bp.latest.systolic}/${bp.latest.diastolic} mmHg` : "recent values"
      }) align with our long-term cardiovascular goals?`,
      `Are there any adjustments needed for my daily nutrition, physical activity, or current medications?`,
      `What target ranges should we establish for my next follow-up examination?`,
    ],
    safetyDisclaimer:
      "Informational health analysis only. All clinical treatment decisions, drug dosages, and diagnosis must be confirmed directly with your licensed physician.",
  };
}

export async function generateGeminiPatientSummary(
  trends: PatientLongitudinalTrends,
  userName: string
): Promise<{ summary: GeminiTrendsResponse | null; error?: { code: string; message: string } }> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    const fallback = generateDeterministicFallbackSummary(trends, userName);
    return { summary: fallback };
  }

  const prompt = `You are an empathetic, clinical-intelligence communication specialist.
Generate a patient-facing longitudinal health review based STRICTLY on the deterministic clinical guidelines metrics below.

PATIENT NAME: ${userName}
CLINICAL FINDINGS:
- Overall Risk Tier: ${trends.clinicalSummary.overallRiskTier}
- Blood Pressure: ${trends.clinicalSummary.hypertensionStatus} (Baseline: ${
    trends.metrics.bp.baseline
      ? `${trends.metrics.bp.baseline.systolic}/${trends.metrics.bp.baseline.diastolic} mmHg`
      : "N/A"
  }, Latest: ${
    trends.metrics.bp.latest
      ? `${trends.metrics.bp.latest.systolic}/${trends.metrics.bp.latest.diastolic} mmHg`
      : "N/A"
  }, Overall Change: ${
    trends.metrics.bp.totalDeltaSystolic != null
      ? `${trends.metrics.bp.totalDeltaSystolic > 0 ? "+" : ""}${trends.metrics.bp.totalDeltaSystolic} mmHg`
      : "N/A"
  })
- Blood Sugar: Latest Fasting/Random ${
    trends.metrics.glucose.latest
      ? `${trends.metrics.glucose.latest.value} ${trends.metrics.glucose.latest.unit}`
      : "N/A"
  } (Trend: ${trends.metrics.glucose.overallTrend})
- HbA1c Glycemic Marker: Latest ${
    trends.metrics.hba1c.latest
      ? `${trends.metrics.hba1c.latest.value}% (${trends.metrics.hba1c.latest.stage})`
      : "N/A"
  }
- Resting Heart Rate: ${trends.metrics.pulse.latest ? `${trends.metrics.pulse.latest.value} bpm` : "N/A"}
- Oxygen Saturation (SpO2): ${trends.metrics.spo2.latest ? `${trends.metrics.spo2.latest.value}%` : "N/A"}
- Body Weight Trend: ${
    trends.metrics.weight.latest
      ? `${trends.metrics.weight.latest.value} kg (Change: ${
          trends.metrics.weight.overallDelta != null
            ? `${trends.metrics.weight.overallDelta > 0 ? "+" : ""}${trends.metrics.weight.overallDelta} kg`
            : "N/A"
        })`
      : "N/A"
  }
- Sustained Rise Flag: ${trends.metrics.bp.sustainedRiseWarning ? "YES (Warning: Sustained BP Rise Detected)" : "None"}
- Active Clinical Alerts: ${trends.allAlerts.length > 0 ? trends.allAlerts.join("; ") : "None"}

RULES FOR GENERATION:
1. Empathy & Clarity: Write in simple, reassuring, plain English suitable for patients without medical degrees.
2. Non-diagnostic phrasing: All statements are observational and informational drafts. Never declare a formal diagnosis or prescribe changes in medication dosage.
3. Positivity & Milestones: Explicitly celebrate positive trajectories (e.g. lowering BP, stable SpO2, weight loss).
4. Actionable Doctor Questions: Provide 3 specific, high-yield questions the patient can ask their doctor during their next appointment.
5. Return ONLY a valid JSON object matching this schema:
{
  "narrative": "A warm, cohesive 2-paragraph overview explaining what their multi-visit numbers show.",
  "keyHighlights": [
    "Short bullet 1 (e.g. Blood pressure decreased by 22 mmHg since April)",
    "Short bullet 2 (e.g. HbA1c improved from 7.8% towards 6.9%)",
    "Short bullet 3"
  ],
  "questionsForDoctor": [
    "Question 1 for doctor",
    "Question 2 for doctor",
    "Question 3 for doctor"
  ],
  "safetyDisclaimer": "Informational health analysis only. All clinical treatment decisions, drug dosages, and diagnosis must be confirmed directly with your licensed physician."
}`;

  const candidateModels = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];
  let lastError: { code: string; message: string } | null = null;

  for (const modelName of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`Gemini (${modelName}) API error:`, res.status, errText);
        if (res.status === 429) {
          return {
            summary: null,
            error: {
              code: "QUOTA_EXCEEDED",
              message: "Gemini API quota exhausted (HTTP 429). Deterministic clinical metrics remain active.",
            },
          };
        }
        lastError = {
          code: "GEMINI_ERROR",
          message: `Gemini service returned HTTP ${res.status}.`,
        };
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        try {
          const parsed = JSON.parse(text);
          const validated = validateGeminiResponse(parsed);
          if (validated) {
            return { summary: validated };
          }
        } catch (parseErr) {
          console.warn("Error parsing Gemini JSON:", parseErr);
        }
      }
    } catch (err: any) {
      console.warn(`Failed calling Gemini (${modelName}):`, err);
      const isTimeout = err?.name === "TimeoutError" || String(err).includes("timeout");
      lastError = {
        code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
        message: isTimeout
          ? "Gemini request timed out (20s limit). Please retry."
          : "Network error connecting to Gemini API.",
      };
      continue;
    }
  }

  return {
    summary: null,
    error: lastError || {
      code: "INVALID_RESPONSE",
      message: "Gemini response did not match expected clinical format.",
    },
  };
}

export interface TrendsServiceResult {
  success: boolean;
  isEligible: boolean;
  eligibility: PatientEligibilityInfo;
  cached: boolean;
  isStale: boolean;
  staleReason?: string | null;
  hasCachedSummary?: boolean;
  cachedAt?: string | null;
  hash: string;
  user: {
    id: number;
    name: string;
    patientCode: string;
  };
  trends: PatientLongitudinalTrends;
  aiSummary: any | null;
  aiError?: { code: string; message: string } | null;
}

export async function getPatientLongitudinalTrends(
  patientUser: { id: number; name: string; patientId: string | null; legacyPatientId?: string | null },
  options: { forceRefresh?: boolean; generateAi?: boolean } = {}
): Promise<TrendsServiceResult> {
  const { forceRefresh = false, generateAi = false } = options;

  let patientCode = patientUser.patientId;
  if (!patientCode) {
    const { generatePatientId } = await import("@/lib/auth");
    patientCode = generatePatientId();
    await query(`UPDATE "User" SET "patientId" = $1 WHERE id = $2;`, [patientCode, patientUser.id]);
    patientUser.patientId = patientCode;
  }

  const patientIds: string[] = [patientUser.patientId, patientUser.legacyPatientId, String(patientUser.id)].filter(
    (id): id is string => Boolean(id)
  );

  const { eligibility, documents } = await verifyPrescriptionEligibility(patientUser, patientIds);

  let rawObs: any[] = [];
  try {
    rawObs = await query(
      `SELECT id, patient_id, prescription_id, obs_date, kind, systolic, diastolic, value, unit, raw_text, created_at
       FROM observations
       WHERE patient_id = ANY($1::text[])
       ORDER BY obs_date ASC, id ASC;`,
      [patientIds]
    );
  } catch (e) {
    console.warn("Query observations error:", e);
  }

  const existingObsKeys = new Set(
    rawObs.map((o) => `${(o.obs_date || "").slice(0, 10)}_${o.kind}`)
  );

  documents.forEach((doc: any) => {
    if (doc.status !== "CONFIRMED") return;
    const sr = parseSR(doc.structuredResult);
    const dateStr = extractClinicalDate(doc);
    if (!dateStr) return;
    const vitals = sr.vitals || [];

    if (Array.isArray(vitals)) {
      vitals.forEach((v: any, idx: number) => {
        const kind = v.kind || (v.name?.toLowerCase().includes("bp") ? "bp" : null);
        if (!kind) return;
        const key = `${dateStr}_${kind}`;
        if (!existingObsKeys.has(key)) {
          existingObsKeys.add(key);
          const parsed = v.parsed || {};
          rawObs.push({
            id: `doc-obs-${doc.id}-${idx}`,
            patient_id: patientCode,
            prescription_id: doc.id,
            obs_date: dateStr,
            kind,
            systolic: parsed.systolic || null,
            diastolic: parsed.diastolic || null,
            value: parsed.value || null,
            unit: parsed.unit || (kind === "bp" ? "mmHg" : ""),
            raw_text: `${v.name || ""} ${v.value || ""}`.trim(),
            created_at: doc.uploadedAt,
            isFromDocument: true,
            documentId: doc.id,
          });
        }
      });
    }
  });

  const dedupedObsMap = new Map<string, any>();
  rawObs.forEach((o) => {
    const dateStr = (o.obs_date || o.date || "").slice(0, 10);
    const key = `${dateStr}_${o.kind}`;
    if (!dedupedObsMap.has(key)) {
      dedupedObsMap.set(key, o);
    } else {
      const existing = dedupedObsMap.get(key);
      if (
        (o.systolic != null || o.value != null) &&
        existing.systolic == null &&
        existing.value == null
      ) {
        dedupedObsMap.set(key, o);
      }
    }
  });
  const uniqueObs = Array.from(dedupedObsMap.values());

  const trends = calculatePatientTrends(patientCode, uniqueObs, documents, eligibility);

  const cacheFingerprint = computeCacheFingerprint(
    patientCode,
    eligibility.distinctDates,
    eligibility.eligiblePrescriptions,
    uniqueObs
  );

  if (!eligibility.isEligible) {
    return {
      success: true,
      isEligible: false,
      eligibility,
      cached: false,
      isStale: false,
      cachedAt: null,
      hash: cacheFingerprint.slice(0, 12),
      user: {
        id: patientUser.id,
        name: patientUser.name,
        patientCode,
      },
      trends,
      aiSummary: null,
    };
  }

  let cachedEntry: CachedSummaryEntry | null = null;
  const memHit = memoryCache.get(patientCode);
  if (memHit && memHit.summary) {
    cachedEntry = memHit;
  } else {
    try {
      const cacheRows = await query(
        `SELECT obs_hash, ai_summary, updated_at
         FROM patient_trends_cache
         WHERE patient_id = $1
         LIMIT 1;`,
        [patientCode]
      );
      if (cacheRows.length > 0 && cacheRows[0].ai_summary) {
        let dbSummary = cacheRows[0].ai_summary;
        if (typeof dbSummary === "string") {
          try {
            dbSummary = JSON.parse(dbSummary);
          } catch (_) {}
        }
        cachedEntry = {
          hash: cacheRows[0].obs_hash,
          summary: dbSummary,
          cachedAt: cacheRows[0].updated_at
            ? new Date(cacheRows[0].updated_at).toISOString()
            : new Date().toISOString(),
        };
        memoryCache.set(patientCode, cachedEntry);
      }
    } catch (dbErr) {
      console.warn("[Trends/Cache] DB cache lookup error:", dbErr);
    }
  }

  if (!forceRefresh && !generateAi) {
    if (cachedEntry) {
      const isMatch = cachedEntry.hash === cacheFingerprint;
      return {
        success: true,
        isEligible: true,
        eligibility,
        cached: true,
        isStale: !isMatch,
        staleReason: !isMatch ? "New clinical records detected since last AI summary" : null,
        cachedAt: cachedEntry.cachedAt,
        hash: cacheFingerprint.slice(0, 12),
        user: {
          id: patientUser.id,
          name: patientUser.name,
          patientCode,
        },
        trends,
        aiSummary: cachedEntry.summary,
      };
    }

    return {
      success: true,
      isEligible: true,
      eligibility,
      cached: false,
      isStale: false,
      hasCachedSummary: false,
      cachedAt: null,
      hash: cacheFingerprint.slice(0, 12),
      user: {
        id: patientUser.id,
        name: patientUser.name,
        patientCode,
      },
      trends,
      aiSummary: null,
    };
  }

  const { summary: freshSummary, error: aiError } = await generateGeminiPatientSummary(
    trends,
    patientUser.name
  );

  if (freshSummary) {
    const nowIso = new Date().toISOString();
    const newEntry: CachedSummaryEntry = {
      hash: cacheFingerprint,
      summary: freshSummary,
      cachedAt: nowIso,
    };

    memoryCache.set(patientCode, newEntry);

    try {
      await query(
        `INSERT INTO patient_trends_cache (patient_id, obs_hash, ai_summary, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (patient_id)
         DO UPDATE SET obs_hash = EXCLUDED.obs_hash, ai_summary = EXCLUDED.ai_summary, updated_at = NOW();`,
        [patientCode, cacheFingerprint, JSON.stringify(freshSummary)]
      );
    } catch (dbSaveErr) {
      console.warn("[Trends/Cache] Could not persist trends cache to DB:", dbSaveErr);
    }

    return {
      success: true,
      isEligible: true,
      eligibility,
      cached: false,
      isStale: false,
      cachedAt: nowIso,
      hash: cacheFingerprint.slice(0, 12),
      user: {
        id: patientUser.id,
        name: patientUser.name,
        patientCode,
      },
      trends,
      aiSummary: freshSummary,
    };
  }

  return {
    success: true,
    isEligible: true,
    eligibility,
    cached: false,
    isStale: false,
    aiError: aiError || { code: "ERROR", message: "Failed to generate AI summary" },
    cachedAt: null,
    hash: cacheFingerprint.slice(0, 12),
    user: {
      id: patientUser.id,
      name: patientUser.name,
      patientCode,
    },
    trends,
    aiSummary: null,
  };
}

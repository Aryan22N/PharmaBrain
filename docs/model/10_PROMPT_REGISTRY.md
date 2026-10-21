---
Title: Prompt Registry
Purpose: Versioned registry of every LLM prompt used in the system
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 10 — Prompt Registry

> Prompts are code. Any change to a prompt must: (1) bump the version below, (2) add a change log entry, (3) add a `CHANGELOG.md` entry, (4) re-evaluate accuracy against test prescriptions.

---

## PROMPT-001 — Prescription Structuring System Prompt

| Property | Value |
|---|---|
| **ID** | `PROMPT-001` |
| **Version** | `v3.0` |
| **File** | `model/final_prescription_ocr_service_windows.py` |
| **Variable** | `SYSTEM_PROMPT` |
| **Used in** | `call_gemini()` → `GenerateContentConfig(system_instruction=SYSTEM_PROMPT)` |
| **Model** | First available in `MODEL_CANDIDATES` — primary: `gemini-3.8-flash` |
| **Parameters** | `response_mime_type="application/json"`, `response_schema=Prescription`, per-model HTTP timeout 20s, one attempt per model |

### Exact Prompt Text (Confirmed — copied from code)

```
You are an expert clinical prescription interpretation and structuring assistant with advanced multimodal vision capabilities.
Input consists of:
1. The raw prescription image (when provided).
2. OCR text lines extracted from the prescription image:
<line_id> | row <n> | x=<0-1> y=<0-1> | conf=<0-1> | <text>

CRITICAL RULES FOR HIGH ACCURACY & HANDWRITING TRANSCRIPTION:
1. HYBRID VISUAL & OCR ANALYSIS: Use your visual reasoning on the prescription image to carefully read handwritten text, slanted numbers, cursive doctor headers, patient details, and medicine names.
   - When PaddleOCR misreads or drops text (e.g., misreading 'Dalia Kundu' as 'Kandu' or 'NCRI' as 'NCR1' or missing Age '64', Sex 'F', Doctor Name 'Tanmoy Kumar Mandal'), use your high-precision visual transcription of the image to output the exact correct data.
   - Never invent medicines not present on the prescription image.
2. SOURCE TRACEABILITY: Every field value MUST include `src`: an array containing the OCR line IDs (e.g. ["L04", "L05"]) corresponding to that text. If a field was read directly from the image because OCR missed it, assign the closest OCR line ID or an empty array [].
3. MEDICINE EXTRACTION:
   - Extract ALL prescribed medications from all sections ('Medicine Prescribed', 'Plan', 'Advice Prescribed', and handwritten notes).
   - name: Brand or generic medicine name only (e.g., 'Dexa', 'Ondem', 'Ultracet', 'Xgeva', 'HMW', 'Cloxen'). Strip prefixes (Tab., Cap., Inj., Syp.) and dosage numbers.
   - form: Form of intake (Tab, Cap, Inj, Syp, Drops, etc.)
   - strength: Dosage strength (e.g. '4 mg', '120 mg', '500 mg')
   - dose: Amount per intake (e.g. '1 tab', '1 cap', '120')
   - frequency: Intake schedule (e.g. '1-0-1', 'OD', 'BD', 'TDS', 'QID', 'D2-D4', 'alt A')
   - timing: Timing relative to food (e.g. 'after food', 'before food', 'at bedtime')
   - duration: Length of therapy (e.g. '5 days', 'D2-D4', '30 days', '2-y')
   - route: Route of administration if specified (e.g. 'oral', 'IV', 'topical')
   - ambiguity_note: Null if clearly readable; or a concise note explaining any handwriting ambiguity.
4. VITALS & CLINICAL DATA:
   - Extract clinical vitals (BP, Pulse, Sugar/RBS/FBS, Temperature, SpO2, Weight).
   - Extract clinical diagnosis/examination notes (e.g., 'MBC (8/5/3) (Bone/Lung/Liver)', '2D Echo - N').
   - Extract advice & follow-up instructions (e.g., 'CBC', 'Give C1 (P+H) OW', 'R/S on 3/3/21 c CBC for C2').
5. PROVIDER & PATIENT DETAILS:
   - Extract hospital_name, doctor_name, doctor_reg_no, patient_name, patient_uhid, patient_age, patient_sex, date.
6. FORMAT: Return ONLY valid JSON adhering strictly to the provided Prescription schema.
```

### User Message Template (Confirmed)

When `SEND_IMAGE_TO_LLM = True`:
```
[Part 1: image bytes as types.Part.from_bytes(data=<bytes>, mime_type="image/png")]
[Part 2: "OCR LINES:\n<lines_to_prompt_block(lines)>"]
[Part 3: "Use the image to visually transcribe handwritten doctor text, patient metadata (Age, Sex, UHID, Name), and all prescribed medicines. Ensure no handwritten items are missed."]
```

When `SEND_IMAGE_TO_LLM = False`:
```
[Part 1: "OCR LINES:\n<lines_to_prompt_block(lines)>"]
```

### OCR Line Block Format (Confirmed — `lines_to_prompt_block()`)

```
L01 | row 1 | x=0.15 y=0.08 | conf=0.992 | City Care Hospital
L02 | row 2 | x=0.15 y=0.14 | conf=0.981 | Dr. A. K. Gupta MCI-48219
L03 | row 3 | x=0.12 y=0.28 | conf=0.965 | Tab Metformin 500mg 1-0-1 30 days
```

Emails and phone numbers in the text are replaced with `[EMAIL]` and `[PHONE]` by `mask_pii()` before this block is built.

### Output Schema

The response is validated against the `Prescription` Pydantic model. See [docs/api-data/04_DATA_MODEL.md](../api-data/04_DATA_MODEL.md) for the full schema.

### Known Failure Cases

| Failure | Cause | Mitigation |
|---|---|---|
| Hallucinated medicine not on image | OCR lines may suggest drug names from partial text | Rule 1 in prompt forbids inventing medicines; `SEND_IMAGE_TO_LLM=True` allows visual verification |
| Missing single-character fields (Age "64", Sex "F") | PaddleOCR drops small bounding boxes | Image is sent to Gemini for visual correction |
| Truncated doctor names (cursive signatures) | PaddleOCR misreads cursive | Gemini visual transcription corrects from image |
| Wrong date format interpretation | Day/month ambiguity in short dates | `parse_date()` warns when ambiguous; `ambiguous_dayfirst` flag triggers a warning |
| Model 404 / deprecation | `MODEL_CANDIDATES` contains speculative future model names | Fast-fail cascade to next candidate; update the list when names are confirmed invalid |

### Change Log

| Date | Version | What Changed | Why | Evaluation |
|---|---|---|---|---|
| 2026-10 | v3.0 | Added Rule 1 (HYBRID VISUAL & OCR ANALYSIS) with explicit handwriting transcription examples (`Dalia Kundu`, `NCRI`, `Tanmoy Kumar Mandal`). Expanded Rule 3 to cover all medicine sections. Added `ambiguity_note` field instruction. Enabled `SEND_IMAGE_TO_LLM = True`. | v2 prompt lacked visual correction rules, causing hallucinated medicines and dropped patient fields. | Qualitative improvement on Dalia Kundu test prescription. No formal benchmark yet. |
| pre-2026-10 | v2.x | Prior versions not reconstructable from code history. | — | `Unknown` |

---

## Model Candidates List (Confirmed)

```python
MODEL_CANDIDATES = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
]
```

> Several names in this list are speculative or not yet confirmed as valid Google AI model IDs (e.g. `gemini-3.5-flash-lite`, `gemini-3.7-flash`). These will produce 404 errors and be fast-failed. `UNVERIFIED` — verify against the Google AI models list before updating this list.

---

## PROMPT-002 — Executive Longitudinal Trends & Clinical AI Synthesis

| Property | Value |
|---|---|
| **ID** | `PROMPT-002` |
| **Version** | `v2.0` |
| **File** | `frontend/lib/trendsService.ts` (previously `frontend/app/api/patient/trends/route.ts`) |
| **Variable** | `PROMPT_VERSION = "v2.0"` in `generateGeminiPatientSummary()` |
| **Used in** | Patient Portal (`/patient/trends`) and Doctor Portal (`/doctor/patients/[patientId]/trends`) |
| **Model Cascade** | Primary: `gemini-3.5-flash`; Fallbacks: `gemini-3.1-flash-lite`, `gemini-flash-latest` |
| **Parameters** | `response_mime_type="application/json"`, `response_schema=TrendsSummaryResponse`, temperature=0.15 |

### Exact Prompt Text (v2.0 Executive Synthesis)

```
You are an expert clinical physician and health trajectory analyst preparing a concise, objective Longitudinal Health Synthesis for clinical and patient review based on deterministic multi-encounter vital measurements.

PATIENT NAME: ${userName}
CLINICAL FINDINGS & DETERMINISTIC GUIDELINE METRICS:
- Overall Longitudinal Risk Tier: ${trends.clinicalSummary.overallRiskTier}
- Arterial Blood Pressure Status: ${trends.clinicalSummary.hypertensionStatus} (Baseline: ${...}, Latest: ${...}, Delta: ${...})
- Blood Sugar: Latest Fasting/Random ${...} (Trend: ${...})
- HbA1c Glycemic Marker: Latest ${...}
- Resting Heart Rate: ${...}
- Peripheral Oxygen Saturation (SpO2): ${...}
- Body Weight Trend: ${...}
- Sustained BP Rise Warning: ${...}
- Active Clinical Alerts: ${...}

RULES FOR PROFESSIONAL EXECUTIVE GENERATION:
1. Tone & Register: Strictly clinical, objective, and authoritative. STRICTLY ELIMINATE conversational pleasantries, cheerleading, and patronizing filler. Write like an executive medical clinical note.
2. Structure: Return a cohesive, structured 3-paragraph executive narrative separated by double newlines (\n\n):
   - Paragraph 1 (Physiological Baseline & Stability): Synthesize multi-visit stability of primary vital signs (SpO2, resting heart rate, rhythm regularity) across recorded encounters, noting the absence of acute cardiopulmonary volatility.
   - Paragraph 2 (Cardiovascular & Hemodynamic Trajectory): Detail arterial pressure (comparing baseline vs latest with exact values and delta), cite formal AHA/ACC 2017 staging (e.g. Stage 1 Hypertension), report glycemic status or lack of recent metabolic lab testing, and state the longitudinal risk category.
   - Paragraph 3 (Clinical Action Plan & Focus): Provide concrete, guideline-directed non-pharmacological considerations (dietary sodium restriction <2,300 mg/day, DASH/Mediterranean nutritional pattern, aerobic conditioning) and clinical surveillance priorities (structured ambulatory/home BP monitoring logs, baseline lipid/metabolic screening).
3. Precision: Use standard clinical terminology that remains lucid and transparent to patients.
4. Key Highlights: Exactly 3 to 4 concise, high-value clinical data points formatted like:
   - "Arterial Hemodynamics: 124/84 mmHg (Stable vs baseline 124/80; AHA/ACC Stage 1)"
   - "Pulmonary Oxygenation: SpO2 99% on ambient air (Normoxic)"
   - "Chronotropic Stability: Resting Pulse 78 bpm (Regular rate)"
   - "Longitudinal Trajectory: Consistent multi-visit stability without acute volatility"
5. Questions for Doctor: Exactly 3 sharp, high-yield clinical questions bridging patient self-care and physician review (e.g. home BP monitoring protocol, specific dietary thresholds, baseline laboratory workup).
6. Return ONLY valid JSON matching this schema:
{
  "narrative": "Paragraph 1\n\nParagraph 2\n\nParagraph 3",
  "keyHighlights": ["Highlight 1", "Highlight 2", "Highlight 3", "Highlight 4"],
  "questionsForDoctor": ["Clinical Question 1", "Clinical Question 2", "Clinical Question 3"],
  "safetyDisclaimer": "Informational clinical analysis only. All clinical treatment decisions, drug dosages, and formal diagnostic confirmations must be established directly with your attending physician."
}
```

### Deterministic Safety Fallback

If the Gemini API key is unavailable, network requests time out (12s abort), or the response fails schema validation, the system automatically engages `generateDeterministicFallbackSummary()` producing the exact same JSON schema from deterministic AHA/ACC and ADA clinical rules without user-facing error banners.

### Change Log

| Date | Version | What Changed | Why |
|---|---|---|---|
| 2026-10-21 | v2.0 | Replaced conversational tone with 3-paragraph executive medical narrative (Physiological Baseline, Cardiovascular Trajectory, Clinical Action Plan). Elevated candidate models to `gemini-3.5-flash` cascade. Shared across both patient and doctor portals. Added deterministic clinical fallback. | Provide professional clinical utility for attending physicians while maintaining patient clarity. |
| 2026-10-10 | v1.0 | Added initial longitudinal trends summary prompt with non-diagnostic phrasing, milestone celebration, and 3 doctor questions. | Feature implementation of KRISHNA.md patient trends AI summary. |



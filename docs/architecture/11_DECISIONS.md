---
Title: Architecture Decision Records
Purpose: Why key technical decisions were made
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 11 — Architecture Decisions

---

## ADR-001 — PaddleOCR as the OCR Engine

**Date:** Unknown (pre-2026-10)  
**Status:** Accepted

**Context:**  
The system needs to extract text from prescription images, including handwritten doctor entries. Multiple OCR engines were candidates: Tesseract, Google Vision API, PaddleOCR.

**Decision:**  
Use PaddleOCR (PaddlePaddle framework) as the primary OCR engine. The codebase also supports `PaddleOCR-VL` via the `OCR_ENGINE_TYPE` environment variable.

**Evidence:** Confirmed — `model/final_prescription_ocr_service_windows.py` → `run_ocr()`, `import paddle`, `from paddleocr import PaddleOCR`.

**Alternatives considered:** `Unknown` — no record of alternatives considered.

**Consequences:**
- PaddleOCR is CPU-only by default, giving 5–15 s inference per image on CPU.
- PaddlePaddle 3.x has a MKL-DNN and PIR execution engine bug requiring workarounds (`FLAGS_use_mkldnn=0`, `FLAGS_enable_pir_api=0`).
- GPU support requires CUDA setup and `use_gpu=True`.
- Model weights are downloaded on first use (~200 MB, cached in `/root/.paddlex`).

---

## ADR-002 — Google Gemini as the LLM for Structuring

**Date:** Unknown (pre-2026-10)  
**Status:** Accepted

**Context:**  
After OCR, the raw text lines need to be structured into clinical fields. A schema-constrained LLM approach was chosen over classical NLP (regex, NER).

**Decision:**  
Use Google Gemini API (`google-genai` SDK) with `response_schema=Prescription` enforced JSON output. A cascade of model candidates is used to handle model deprecations and availability.

**Evidence:** Confirmed — `model/final_prescription_ocr_service_windows.py` → `call_gemini()`, `client = genai.Client(api_key=GEMINI_API_KEY)`.

**Alternatives considered:** `Unknown` — no record.

**Consequences:**
- Gemini API calls have per-call cost.
- Patient clinical data (including names and diagnoses) is sent to Google's API. Data processing agreement required.
- Model cascade (`MODEL_CANDIDATES`) handles availability but may include invalid model names.
- `SEND_IMAGE_TO_LLM = True` sends image bytes to Gemini — enables visual handwriting transcription but increases data sent to third party.

---

## ADR-003 — Human-in-the-Loop Before Record Commit

**Date:** Unknown  
**Status:** Accepted

**Context:**  
Given the clinical safety risk of medication errors, automated commit of LLM-extracted prescriptions to patient records is not acceptable.

**Decision:**  
Every extraction has status `PENDING_USER_CONFIRMATION`. No auto-confirm path exists. Confirmation requires explicit `POST /confirm/{id}` with a confirmed record payload.

**Evidence:** Confirmed — `extractions.status`, `api_confirm()`, `require_key()` in `model/final_prescription_ocr_service_windows.py`.

**Consequences:**
- Adds a manual review step for every prescription.
- `edits_json` preserves the diff between machine output and human confirmation.
- Clinician review time is the primary throughput bottleneck at scale.

---

## ADR-004 — RapidFuzz String Matching for Medicine Lookup (Current)

**Date:** Unknown  
**Status:** Accepted (interim — to be superseded by ADR-005)

**Context:**  
Medicine names from OCR are often misspelled or abbreviated. A simple exact match would miss most drugs.

**Decision:**  
Use `rapidfuzz.process.extractOne` with `fuzz.ratio` scorer and a threshold of 85 for near-match detection, against an in-memory dict built from `medicine_master`.

**Evidence:** Confirmed — `model/final_prescription_ocr_service_windows.py` → `lookup_medicine()`.

**Consequences:**
- Fast (in-memory lookup, O(n) scan for fuzzy).
- Near matches are flagged, never auto-accepted.
- Short names (< 5 chars) are excluded from fuzzy matching to avoid cross-drug confusion.
- Does not scale well beyond ~500k records in memory.

---

## ADR-005 — Hybrid SQL + pgvector Medicine Matching (PLANNED)

**Date:** Proposed (not yet implemented)  
**Status:** Proposed

**Context:**  
The current RapidFuzz approach scans the full in-memory index for every fuzzy lookup, does not support trigram-based pre-filtering, and does not leverage semantic similarity.

**Decision:**  
Replace with: (1) SQL trigram index (`pg_trgm`) for fast candidate retrieval; (2) `pgvector` embeddings as fallback for semantically similar names; (3) relational SQL as sole source of truth for verified facts.

**Evidence:** Documented in `Doc/model.md` §10, `Doc/system_design.md` §17. Not in production code.

**Consequences:**
- Requires PostgreSQL with `pg_trgm` and `pgvector` extensions.
- More complex query logic.
- Better accuracy and scale for large medicine databases.
- The LLM must still never generate drug facts — only retrieve from SQL.

---

## ADR-006 — SQLAlchemy Core for Python DB Access

**Date:** Unknown  
**Status:** Accepted

**Context:**  
Python DB access needed to be explicit and debuggable. ORM abstractions can hide query issues.

**Decision:**  
Use SQLAlchemy Core (Table/Column definitions, explicit `select()`, `insert()`, `update()`) with `psycopg2-binary` driver for PostgreSQL. SQLite supported as fallback.

**Evidence:** Confirmed — `md_ = MetaData()`, `Table(...)` definitions in `model/final_prescription_ocr_service_windows.py`.

**Consequences:**
- No migration framework (Alembic) — schema managed via `create_all()` and manual SQL scripts.
- Explicit SQL means changes are visible and auditable.
- Changing the schema requires manually writing `ALTER TABLE` SQL.

---

## ADR-007 — Next.js App Router + pg Pool for Frontend

**Date:** Unknown  
**Status:** Accepted

**Context:**  
The frontend needs both server-rendered UI and serverless API routes that can query the database and proxy to the Python service.

**Decision:**  
Use Next.js 16 App Router. Frontend API routes use `pg.Pool` directly via `frontend/lib/db.ts` for queries against `"User"`, `"Document"`, `"Analysis"` tables. Python service manages its own tables via SQLAlchemy.

**Evidence:** Confirmed — `frontend/package.json`, `frontend/lib/db.ts`.

**Consequences:**
- Two separate DB access patterns in the same Supabase database (Next.js via `pg` pool, Python via SQLAlchemy).
- Table naming conventions differ: PascalCase quoted (Next.js) vs snake_case unquoted (Python).
- This dual-namespace design is a known technical debt item. See [docs/operations/13_KNOWN_ISSUES.md](../operations/13_KNOWN_ISSUES.md).

---

## ADR-008 — SHA-256 Image Deduplication per Patient

**Date:** Unknown  
**Status:** Accepted

**Context:**  
If a user uploads the same prescription image twice, it should not create duplicate OCR or extraction records. A retry after failed structuring must remain recoverable.

**Decision:**  
Compute SHA-256 of the raw image bytes and scope the lookup to the patient. If a non-discarded extraction already exists for the matching raw OCR, return it. If only the raw OCR exists (or its prior extraction was discarded), reuse the saved OCR lines and retry structuring with the re-uploaded image.

**Evidence:** Confirmed — `process_image()` in `model/final_prescription_ocr_service_windows.py` → `sha = hashlib.sha256(data).hexdigest()`.

**Consequences:**
- Deduplication is per-patient (same image for a different patient is processed fresh).
- A discarded extraction does not prevent re-processing the same image.
- Failed Gemini structuring can recover from the saved raw OCR without creating another raw OCR row.

---

## ADR-009 — Supabase Cloud Storage with Resilient Dual-Upload Engine

**Date:** 2026-10-10  
**Status:** Accepted

**Context:**  
Prescription document images were initially saved directly to local disk (`frontend/public/uploads/`). In containerized deployments (Docker), local storage is ephemeral, unscalable, and presents permission issues across user boundaries (`USER nextjs`). Furthermore, client-facing dashboards require secure, fast CDN access to prescription scans.

**Decision:**  
Use Supabase Storage Cloud Bucket (`OCR_Images/uploads/`) with public CDN URLs as primary image storage:
1. Bucket ACL is set to `public: true` to enable direct browser viewing on patient dashboards without per-request signed token bottlenecks.
2. `frontend/lib/supabaseStorage.ts` implements a dual-upload pipeline: attempts `@supabase/supabase-js` first, with automatic fallback to native HTTP `fetch` REST API (`POST /storage/v1/object/...`) if client libraries encounter runtime issues.
3. Fallback to `/app/public/uploads` is preserved for offline dev environments, with Docker runner permissions explicitly granted (`chown -R nextjs:nodejs /app/public`).
4. `Document.storedFilename` and `Analysis.structuredResult.image_url` store the canonical public Supabase URL.

**Evidence:** Confirmed — `frontend/lib/supabaseStorage.ts`, `docker-compose.yml`, `frontend/Dockerfile`, `frontend/app/api/user/dashboard/route.ts`.

**Consequences:**
- Images scale independently of application containers and are served over Cloudflare CDN edge caching.
- Eliminates ephemeral file loss during Docker container recreation.
- Medical document images are publicly accessible via their cryptographic random-timestamped URL; access policies can be tightened to private signed tokens if regulatory posture changes.

---

## ADR-010 — Real-Time Database Synthesis for Longitudinal Clinical Summaries

**Date:** 2026-10-11  
**Status:** Accepted

**Context:**  
The Clinical Overview dashboard (`/patient/overview`) displays a prominent "Longitudinal Health Summary" card highlighting Diagnoses, Glycemic Status, and Ongoing Regimen. There was ambiguity about whether these summaries were hardcoded mock text or backed by real health data.

**Decision:**  
All fields in the Longitudinal Health Summary are synthesized in real-time on every request in `frontend/app/api/user/dashboard/route.ts` directly from active PostgreSQL tables:
1. **Diagnoses:** Queried from `conditions` table where `status = 'ACTIVE'`. If empty, returns `"No active clinical conditions diagnosed or recorded in health record."`
2. **Glycemic Status:** Calculated from latest `observations` table entries for `hba1c` and `sugar_fasting`/`sugar_random`. If biomarkers are absent, returns `"Glycemic biomarkers not yet documented in laboratory history."`
3. **Ongoing Regimen:** Synthesized from `recordedMedicines` where `status = 'ACTIVE'`. If empty, returns `"No ongoing pharmacotherapy recorded."`

**Evidence:** Confirmed — `frontend/app/api/user/dashboard/route.ts` lines 435–458.

**Consequences:**
- Eliminates hardcoded placeholder text entirely.
- Real patient data immediately updates the overview upon prescription confirmation or status change.
- Safe, non-diagnostic clinical fallback statements are preserved when records are sparse.

---

## ADR-011 — Patient Prescription Draft Discard & Review Recovery Lifecycle

**Date:** 2026-10-11  
**Status:** Accepted

**Context:**  
When patients uploaded prescriptions, PaddleOCR and Gemini immediately produced drafts stored in `"Document"` and `"Analysis"`. If the patient navigated away (e.g. clicking "Health Timeline" in the sidebar) before confirming, the extraction was orphaned as an unconfirmed draft. On the timeline, it appeared as an ordinary clinical encounter with no draft indicator or recovery action, and patients could not discard it. Furthermore, if the Python backend in-memory cache cleared, opening the review page caused 404 errors.

**Decision:**  
Implement an explicit, resilient draft review and discard lifecycle:
1. **Timeline Demarcation:** Unconfirmed drafts are visibly badged on `/patient/timeline` as `Awaiting Review` / `Unsaved Draft` with a dedicated top notification banner.
2. **Inline Patient Actions:** Each draft timeline event displays actionable **"Discard Draft"** and **"Review & Submit"** buttons.
3. **Cascade Discard API (`POST /api/discard/[id]`):** Completely removes the discarded extraction from PostgreSQL (`"Document"`, `"Analysis"`, and unconfirmed `patient_timeline_events`), preventing phantom drafts from lingering on the dashboard or timeline.
4. **Resilient Extractions Fallback (`GET /api/extractions/[id]`):** If the Python backend in-memory cache has expired, the route queries PostgreSQL `"Document"` and `"Analysis"` to reconstruct the extraction record, preventing review page 404 failures.

**Evidence:** Confirmed — `frontend/app/api/discard/[id]/route.ts`, `frontend/app/api/extractions/[id]/route.ts`, `frontend/app/patient/timeline/page.tsx`, `frontend/app/patient/documents/[id]/page.tsx`.

**Consequences:**
- Patients have complete control over draft lifecycles.
- Accidental navigation away from review is fully recoverable.
- Database remains clean and free of orphaned unconfirmed drafts.

---

## ADR-012 — Strict Demarcation of Scanned Prescriptions vs Direct Hospital HMS Provenance

**Date:** 2026-10-11  
**Status:** Accepted

**Context:**  
Confirmed prescriptions scanned or uploaded by patients were previously inserted into the timeline with `source = 'Hospital HMS'` and `verification_status = 'Hospital Verified'`. This misrepresented patient-uploaded paper scans as authentic, direct hospital electronic health management system integrations.

**Decision:**  
Enforce strict provenance attribution across all API routes, database records, and UI displays:
1. Confirmed prescriptions scanned by patients are labeled `source = 'Prescription Scan'` and `verification_status = 'Prescription Verified'`.
2. Unconfirmed drafts are labeled `source = 'Uploaded Document'` and `verification_status = 'Awaiting Review'`.
3. The `Hospital HMS` source and `Hospital Verified` status are strictly reserved for authentic hospital EHR/HMS system integrations.

**Evidence:** Confirmed — `frontend/app/api/confirm/[id]/route.ts`, `frontend/app/api/user/dashboard/route.ts`, `frontend/app/api/patient/timeline/route.ts`.

**Consequences:**
- Clinicians and patients can reliably distinguish between hospital-integrated records and patient-scanned physical documents.
- Protects clinical audit integrity.

---

## ADR-013 — Unified Longitudinal Trends Engine & Reusable Dashboard Component

**Date:** 2026-10-21  
**Status:** Accepted

**Context:**  
Longitudinal biomarker trend calculations, eligibility gating ($\ge 5$ distinct clinical dates), dual-layer cache fingerprinting, and Gemini AI synthesis were previously tightly coupled to `/api/patient/trends/route.ts` and `/patient/trends/page.tsx`. Clinicians navigating to the Doctor Portal (`/doctor/patients/[patientId]`) lacked access to the longitudinal health trends and risk prediction suite, resulting in code duplication and architectural fragmentation.

**Decision:**  
1. Extract all trend evaluation, deterministic clinical staging (AHA/ACC BP and ADA glycemia), cache management, and AI prompt generation into a core server library: `frontend/lib/trendsService.ts`.
2. Construct a unified, presentationally decoupled component `frontend/components/trends/LongitudinalTrendsDashboard.tsx` parameterized via `isDoctorView` prop, serving both `/patient/trends` and `/doctor/patients/[patientId]`.
3. Create doctor-specific endpoint `GET /api/doctor/patients/[patientId]/trends` protected by `requireDoctorSession` and verified patient consent checks in `patient_access_requests`.
4. Implement Executive AI Synthesis v2.0 (`PROMPT_VERSION = "v2.0"`) with a structured 3-paragraph executive synopsis and deterministic rule fallback for guaranteed availability.

**Evidence:** Confirmed — `frontend/lib/trendsService.ts`, `frontend/components/trends/LongitudinalTrendsDashboard.tsx`, `frontend/app/api/doctor/patients/[patientId]/trends/route.ts`.

**Consequences:**
- Single source of truth for all clinical trajectory and risk prediction logic.
- Zero duplication of SVG charting, reference band styling, or state machine handling.
- Doctors and patients view identical, synchronized longitudinal biomarker trajectories.

---

## ADR-014 — Authoritative Clinical Reference Dictionary for Conditions and Biomarkers

**Date:** 2026-10-21  
**Status:** Accepted

**Context:**  
The clinical dossier on `/doctor/patients/[patientId]` displayed diagnoses, active conditions, and vitals as raw text strings without standardized normal reference ranges, physiological interpretation guidance, or clinical significance context for junior clinicians or multi-disciplinary care teams.

**Decision:**  
Build a standardized clinical reference dictionary in `frontend/lib/medicalDescriptions.ts`:
1. Comprehensive coverage for 6 primary vitals (BP, Heart Rate, SpO2, Temperature, Respiratory Rate, BMI).
2. Quantitative reference ranges and interpretation for 13 essential laboratory biomarkers (HbA1c, Fasting Blood Glucose, Postprandial Glucose, Total Cholesterol, LDL, HDL, Triglycerides, Serum Creatinine, eGFR, ALT, AST, Hemoglobin, Platelets).
3. Diagnostic criteria and pathophysiology for 10 common chronic conditions (Type 2 Diabetes, Hypertension, Coronary Artery Disease, Dyslipidemia, Hypothyroidism, COPD/Asthma, CKD, GERD, Osteoarthritis, Migraine).
4. Interactive clinical reference drawers and tooltips in `/doctor/patients/[patientId]/page.tsx`.

**Evidence:** Confirmed — `frontend/lib/medicalDescriptions.ts`, `frontend/app/doctor/patients/[patientId]/page.tsx`.

**Consequences:**
- Clinicians have immediate, in-context reference criteria during consultations.
- Standardized terminology aligns with international clinical guidelines.

---

## ADR-015 — Time-Bound Doctor Access & Automatic Revocation Engine

**Date:** 2026-10-17  
**Status:** Accepted

**Context:**  
Under digital healthcare privacy standards (e.g. DPDPA 2023), indefinite doctor access to patient health records poses a substantial privacy risk. Patients require granular control to grant time-limited consultation access that expires automatically.

**Decision:**  
1. Enhance `patient_access_requests` table with `duration_days` (3, 8, 30 days) and `expires_at` timestamp columns.
2. Enforce auto-revocation on read queries: any `APPROVED` request where `expires_at <= NOW()` is proactively updated to `REVOKED`.
3. Guard both `GET /api/doctor/patients/[patientId]/records` and `GET /api/doctor/patients/[patientId]/trends` with strict checks: if access is expired or revoked, return `403 Forbidden` (`authorized: false`).
4. Provide patients with dynamic in-flight duration adjustments (`PATCH /api/patient/access-requests/[id]/duration`) and instant one-click revocation.

**Evidence:** Confirmed — `frontend/app/api/patient/access-requests/route.ts`, `frontend/app/api/doctor/patients/[patientId]/records/route.ts`, `frontend/app/api/doctor/patients/[patientId]/trends/route.ts`.

**Consequences:**
- Protects patient privacy with automatic expiration.
- Eliminates perpetual unauthorized clinical record access.



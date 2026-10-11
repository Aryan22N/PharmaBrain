---
Title: Known Issues
Purpose: Bugs, security gaps, technical debt, and doc gaps
Last verified against code: 2026-10-08
Code version: a100256
Owner: TBD
---

# 13 — Known Issues

---

## Bugs and Risks

### [KI-01] Hardcoded JWT secret fallback — 🔴 Critical

**Evidence:** `frontend/lib/auth.ts` → `const JWT_SECRET = process.env.JWT_SECRET || 'pharma_brain_patient_dmr_jwt_secret_key_2026_super_secure!'`  
**Impact:** If `JWT_SECRET` is not set in production, a known public string is used — any JWT can be forged.  
**Fix:** Always set `JWT_SECRET` in the frontend production environment. Remove or fail-hard on the fallback.

---

### [KI-02] CORS open to all origins — 🟠 High

**Evidence:** `model/final_prescription_ocr_service_windows.py` → `CORSMiddleware(allow_origins=["*"])`  
**Impact:** Any web page can make authenticated requests to the Python API (with the API key).  
**Fix:** Set `allow_origins=[FRONTEND_ORIGIN]` in production. The `FRONTEND_ORIGIN` env var is already plumbed.

---

### [KI-03] No rate limiting on `POST /ocr` — 🟠 High

**Evidence:** `api_ocr()` — no rate limit middleware.  
**Impact:** Unauthenticated `/api/ocr` endpoint and authenticated `/ocr` endpoint can be called repeatedly, consuming Gemini API credits and compute.  
**Fix:** Add `slowapi` or similar FastAPI rate-limiting middleware.

---

### [KI-04] Patient data sent to Google Gemini API without masking — 🔴 Critical

**Evidence:** `call_gemini()` — only emails/phones masked; patient name, UHID, diagnosis, medicines sent.  
**Impact:** Compliance risk under DPDPA 2023 (India); possibly GDPR if patients are in EU.  
**Fix:** Obtain legal opinion; consider de-identifying or pseudonymising patient identifiers before the LLM call; get data processing agreement with Google.

---

### [KI-05] No TLS between Docker services — 🟠 High

**Evidence:** `docker-compose.yml` — `PYTHON_API_URL=http://python-ocr:8000` (plain HTTP).  
**Impact:** Internal Docker traffic is unencrypted. Within a private network this is lower risk, but should be addressed for cloud deployment.  
**Fix:** Use a TLS-terminating reverse proxy (nginx/traefik) for the Docker network.

---

### [KI-06] Starter medicine set is too small for production — 🟠 High

**Evidence:** `model/final_prescription_ocr_service_windows.py` → `STARTER` list — 27 drugs.  
**Impact:** Most medicine names on real prescriptions will not be found in the database, generating `unverified` warnings. Fuzzy matching is limited.  
**Fix:** Import a licensed, pharmacist-verified Indian medicine dataset. See [docs/model/06_MEDICINE_KNOWLEDGE_BASE.md](../model/06_MEDICINE_KNOWLEDGE_BASE.md) and [docs/architecture/12_ROADMAP.md](../architecture/12_ROADMAP.md) R-06.

---

### [KI-07] No evaluation benchmark exists — 🟠 High

**Evidence:** `docs/model/07_EVALUATION.md` — "No evaluation has been run against a formal test set."  
**Impact:** Accuracy claims (> 95%) are unverified engineering targets.  
**Fix:** Build annotated test set, run evaluation, publish results. See R-07, R-08 in roadmap.

---

### [KI-08] `MODEL_CANDIDATES` contains speculative model names — 🟡 Medium

**Evidence:** `MODEL_CANDIDATES` includes names like `gemini-3.5-flash-lite`, `gemini-3.7-flash`, `gemini-3.1-flash-lite` that are not confirmed valid Google AI model IDs.  
**Impact:** These produce 404 fast-fails on every request, adding latency before falling back to a valid model.  
**Fix:** Verify valid model names against Google AI API; remove invalid names from the list.

---

### [KI-09] Medicine matching does not scale beyond ~500k in-memory — 🟡 Medium

**Evidence:** `load_med_index()` builds `MED_INDEX` dict entirely in RAM; `lookup_medicine()` uses `process.extractOne` which scans all keys.  
**Impact:** Memory usage and fuzzy lookup time grow linearly with database size.  
**Fix:** Replace with PostgreSQL `pg_trgm` + `pgvector` (ADR-005, Roadmap R-10, R-11).

---

### [KI-10] Flat `medicine_master` cannot represent multi-ingredient drugs — 🟡 Medium

**Evidence:** `composition` column is a free-text string (e.g. `"Tramadol + Paracetamol"`).  
**Impact:** Cannot check total daily dosage of paracetamol across combination products; cannot link to ATC codes.  
**Fix:** Normalise to `medicines` + `ingredients` schema (ADR-005, Roadmap R-12).

---

### [KI-11] CPU-only OCR is slow — 🟡 Medium

**Evidence:** `PADDLEOCR_DEVICE=cpu` in `docker-compose.yml`. Comments in old docs mention "5–15 s per page on CPU".  
**Impact:** User waits 10–20 s for each prescription (OCR + Gemini).  
**Fix:** Enable GPU acceleration (Roadmap R-13).

---

### [KI-12] Prescription images stored unencrypted on local disk & placeholder fallback bug — ✅ RESOLVED

**Evidence:**
- Previously, prescription uploads stored files in local `frontend/public/uploads/` plain file directory.
- Migrated to Supabase Storage Cloud Bucket (`OCR_Images/uploads/`).
- On 2026-10-10, identified and resolved a subsequent runtime bug where prescription uploads were defaulting to `/sample_prescription.png` because:
  1. The Supabase Storage bucket `OCR_Images` was initialized with `public: false`, blocking browser rendering without auth headers.
  2. `docker-compose.yml` did not pass `SUPABASE_SERVICE_ROLE_KEY` and bucket variables to the frontend container.
  3. `frontend/app/api/user/dashboard/route.ts` prepended `/uploads/` to full URLs, corrupting the image source.
  4. The container's `/app/public/uploads` directory lacked write permissions for `USER nextjs`.

**Fix:**
- Updated bucket `OCR_Images` ACL to `public: true` and enabled MIME types (`image/png`, `image/jpeg`, `image/webp`).
- Injected all Supabase configuration keys into `docker-compose.yml` for the frontend service.
- Implemented dual-engine upload in `frontend/lib/supabaseStorage.ts` (Supabase JS SDK + direct REST API fallback) with guaranteed credential fallbacks.
- Corrected URL resolution in `frontend/app/api/user/dashboard/route.ts` to respect Supabase CDN URLs.
- Fixed `frontend/Dockerfile` permissions (`chown nextjs:nodejs /app/public/uploads`).
- Backfilled all existing database records with verified Supabase Storage URLs. All images now render correctly on `/patient/overview`.

---

### [KI-13] No database migration framework — 🟡 Medium

**Evidence:** Python service uses `MetaData.create_all(engine)` only; schema changes require manual `ALTER TABLE` SQL.  
**Impact:** Risk of schema drift between environments; no rollback capability.  
**Fix:** Add Alembic (Roadmap R-17).

---

### [KI-14] Dual table namespace in same database — 🟡 Medium

**Evidence:** Next.js uses `"User"`, `"Document"`, `"Analysis"` (PascalCase, pg pool); Python uses `raw_ocr`, `extractions`, etc. (snake_case, SQLAlchemy). No FK relationship across the boundary.  
**Impact:** No referential integrity between the frontend EHR records and the backend extraction records. The `Document.status` field is not updated when the Python service confirms an extraction.  
**Fix:** Unify under a single schema manager (Roadmap R-18).

---

### [KI-15] `date_iso` defaults to today if absent — 🟡 Medium

**Evidence:** `api_confirm()` → `if not date_iso: date_iso = datetime.date.today().isoformat()`  
**Impact:** If the prescription date cannot be parsed, the confirmation silently uses today's date — this could mis-date historical prescriptions.  
**Fix:** Return an error or require the frontend to always supply a confirmed date.

---

### [KI-17] Hardcoded demo patient IDs leaking medications across new patient accounts — ✅ RESOLVED

**Evidence:**
- In `frontend/app/api/patient/medicines/route.ts`, the query hardcoded an array of demo IDs: `['CCM12578', 'demo-patient-1', '713590440', '545590541', '443213338', '960183477']`.
- `patient_medications` queries used `WHERE patient_id = ANY($1::text[]) OR user_id = $2`.
- Fallbacks in `frontend/app/api/confirm/[id]/route.ts` and `frontend/app/upload/page.tsx` defaulted missing patient IDs to `"483027156"` (Rahul Sharma).
- Next.js running in standalone production mode inside Docker without host volume mounting required a container rebuild to deploy updates.

**Impact:**
Newly registered patients immediately saw 29+ demo medications belonging to other patients on `http://localhost:3000/patient/medicines` before uploading or confirming any prescriptions.

**Fix:**
- Created `frontend/lib/patientScope.ts` with `getPatientIds(user)` isolating queries to the user's authentic `P-...` and legacy IDs only.
- Restricted SQL queries across `medicines`, `dashboard`, and `timeline` to `WHERE patient_id = ANY($1::text[]) OR (patient_id IS NULL AND user_id = $2)`.
- Removed `"483027156"` demo fallback across confirm, upload, and timeline routes.
- Updated `frontend/lib/api.ts` to forward `Authorization: Bearer ${token}` on client requests.
- Rebuilt frontend Docker container (`docker-compose build frontend` && `docker-compose up -d --no-deps frontend`). Verified fresh patients receive 0 medications and clean empty states.

---

### [KI-16] Dev API token accepted in production if `API_TOKEN` is not set — 🔴 Critical

**Evidence:** `require_key()` → `if not API_TOKEN or API_TOKEN == DEV_API_TOKEN: if not x_api_key or x_api_key == DEV_API_TOKEN: return`  
**Impact:** If `API_TOKEN` is not set in production, the well-known dev token `rx_local_dev_token_2026_secure` grants full API access.  
**Fix:** Fail hard at startup if `API_TOKEN` is not set or equals the dev token in production.

---

### [KI-18] Unconfirmed OCR prescription draft abandonment marked as clinical encounter without discard/recovery flow — ✅ RESOLVED

**Evidence:**
- In `frontend/app/upload/page.tsx` and `frontend/app/patient/documents/[id]/page.tsx`, if a patient uploaded a prescription and subsequently navigated away (e.g. clicking "Health Timeline" in sidebar) before completing review/confirmation:
  1. The extraction was persisted to PostgreSQL `"Document"` and `"Analysis"` tables with `status = 'NOT CONFIRMED'`.
  2. `frontend/app/api/patient/timeline/route.ts` mapped unconfirmed documents into `patient_timeline_events` with category "Clinical Review" or "Medication", appearing on `/patient/timeline` as an encounter without any draft indicators.
  3. The patient had no UI mechanism on the timeline to discard the abandoned draft or resume editing/submitting.
  4. If the Python backend's in-memory extraction cache had expired or flushed, navigating to `/patient/documents/[id]` produced a 404/500 error.

**Impact:**
Patients mistakenly believed unreviewed prescriptions were saved to their medical history, while having no way to delete false drafts or complete review.

**Fix:**
- Updated `frontend/app/api/patient/timeline/route.ts` and `frontend/app/api/user/dashboard/route.ts`:
  - Unconfirmed drafts are explicitly flagged with `status: doc.status`, `title: doc.originalName || "Prescription Scan (Draft)"`, `description: "Prescription scan awaiting patient review and confirmation."`, `source: "Uploaded Document"`, `reliability: "Pending Review"`, and `verification_status: "Awaiting Review"`.
- Upgraded `frontend/app/patient/timeline/page.tsx`:
  - Added a prominent top alert banner notifying patients of pending prescription drafts.
  - Added inline draft callout cards on each unconfirmed event featuring **"Discard Draft"** and **"Review & Submit"** buttons.
  - Added visual badges `Awaiting Review` (amber) and `Unsaved Draft`.
- Upgraded `frontend/app/api/discard/[id]/route.ts`:
  - Enforces database cleanup by deleting matching rows from `"Analysis"`, `"Document"`, and unconfirmed `patient_timeline_events` in PostgreSQL, in addition to notifying the Python engine.
- Upgraded `frontend/app/api/extractions/[id]/route.ts`:
  - Added a graceful fallback querying PostgreSQL `"Document"` and `"Analysis"` tables to reconstruct the review payload if Python cache expired.
- Verified in container: unconfirmed drafts display actionable discard/submit buttons; clicking Discard permanently deletes the draft from timeline, overview, and database.

---

### [KI-19] Misleading "Hospital HMS" / "Hospital Verified" provenance attribution on patient-scanned prescriptions — ✅ RESOLVED

**Evidence:**
- In `frontend/app/api/confirm/[id]/route.ts`, confirming an uploaded prescription inserted a timeline event with:
  `source = 'Hospital HMS'` and `verification_status = 'Hospital Verified'`.
- In `frontend/app/api/user/dashboard/route.ts`, documents were transformed into timeline items with:
  `source: isConfirmed ? "Hospital HMS" : "Diagnostic Lab"` and `verification_status: isConfirmed ? "Hospital Verified" : "Patient Confirmed"`.
- Timeline event #5 in the production database was explicitly seeded with `source: 'Hospital HMS'` and `verification_status: 'Hospital Verified'`.

**Impact:**
Prescriptions photographed and uploaded by patients claimed direct hospital electronic health record integration, violating clinical provenance accuracy.

**Fix:**
- Updated `frontend/app/api/confirm/[id]/route.ts` to attribute confirmed scans truthfully:
  `source: 'Prescription Scan'`, `reliability: 'High'`, `verification_status: 'Prescription Verified'`, and title prefix `Prescription:`.
- Updated `frontend/app/api/user/dashboard/route.ts` and `frontend/app/api/patient/timeline/route.ts` to return `source: 'Prescription Scan'` and `verification_status: 'Prescription Verified'` for confirmed prescription scans, and `source: 'Uploaded Document'`, `verification_status: 'Awaiting Review'` for unconfirmed drafts.
- Sanitized database records (including timeline event #5) to reflect `Prescription Scan` and `Prescription Verified`.

---

### [KI-20] Duplicate "Reports" navigation link highlighting and page scrolling sidebar — ✅ RESOLVED

**Evidence:**
- In `frontend/app/patient/layout.tsx`, `navItems` contained both `"My Medical Records"` (`/patient/documents`) and `"Reports"` (`/patient/documents`).
- Navigating to `/patient/documents` caused both sidebar menu items to highlight simultaneously in active teal styling.
- The sidebar container did not have a fixed height lock, causing the entire navigation sidebar to scroll off-screen when scrolling down long patient records.

**Impact:**
Confusing navigation UI and poor usability on longer dashboards.

**Fix:**
- Removed the redundant `"Reports"` item from `navItems` in `frontend/app/patient/layout.tsx`; retained `"My Medical Records"` (`/patient/documents`).
- Implemented static non-scrolling sidebar: locked the layout root to `h-screen overflow-hidden`, configured `<Sidebar />` with `h-screen sticky top-0`, and wrapped main content in an independent scroll container (`h-screen overflow-y-auto`).
- Removed unused search input component from `TopHeader` and made breadcrumbs dynamic based on `usePathname()`.

---

### [KI-21] Hardcoded / Malformed user profile and ABHA prefix formatting in sidebar — ✅ RESOLVED

**Evidence:**
- In `frontend/app/patient/layout.tsx`, the patient profile card rendered `"ABHA: "` followed by `userData.patientId`, but `userData.patientId` was already formatted as `"ABHA: P-594604202"`, producing duplicate `"ABHA: ABHA: P-594604202"`.
- User ID 40 had the raw uncapitalized username `"arnn"` stored in the PostgreSQL `"User"` table.

**Impact:**
Unpolished UI with duplicate labels and unformatted patient names.

**Fix:**
- Updated `frontend/app/patient/layout.tsx` to normalize patient ID display: replaces redundant `"ABHA: "` with standard identifier prefix `"UHID: "` (`UHID: P-594604202`).
- Updated PostgreSQL database record for user 40 to `"Aryan"`, and added frontend capitalization fallback to capitalize initial letters.

---

## UNVERIFIED Items (Documentation Gaps)

| Item | Location | What needs verification |
|---|---|---|
| Production `medicine_master` row count (claimed 253,313) | `docs/model/06_MEDICINE_KNOWLEDGE_BASE.md` | Check actual row count in Supabase; the number may vary |
| `MODEL_CANDIDATES` validity | `docs/model/10_PROMPT_REGISTRY.md` | Verify each model name against Google AI API documentation |
| OCR processing time estimates ("5–15 s on CPU") | Old `Doc/system_design.md` | Benchmark on target hardware |
| Target accuracy numbers from `accuracy_improvement_plan.md` | `docs/model/07_EVALUATION.md` | Run formal evaluation to produce real numbers |
| Medicine dataset licence (CDSCO / Jan Aushadhi) | `docs/model/06_MEDICINE_KNOWLEDGE_BASE.md` | Confirm licence terms before production use |
| DPDPA 2023 compliance for Gemini data transfer | `docs/operations/08_SECURITY_PRIVACY.md` | Confirm with legal counsel |
| PaddlePaddle version actually installed in Docker | `model/requirements.txt` specifies 2.6.2 but comments mention 3.x | Check installed version in running container |

---

## Technical Debt

| Item | Evidence | Impact |
|---|---|---|
| Single-file Python service (1,633 lines) | `model/final_prescription_ocr_service_windows.py` | Hard to navigate; all logic in one module |
| No unit tests for core functions (`preprocess_image`, `build_lines`, `parse_vital`, `lookup_medicine`) | `scratch/` has integration tests only | Regressions are not caught automatically |
| Windows-specific filename for production service | `final_prescription_ocr_service_windows.py` | Confusing; Dockerfile renames it to `service.py` |
| `requirements.txt` has loose version pins for most packages | `fastapi>=0.110.0` — no upper bound | May break on future major version releases |
| No `.env.example` file | Root directory | New developers do not know what variables are needed |

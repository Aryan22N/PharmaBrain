# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [Unreleased]

- 2026-10-11 — Secure Doctor-to-Patient Access Control, Consent Workflow & Clinical Dossier:
  - Database Schema & Migration: Applied `scratch/migrations/002_patient_access_requests.sql` creating table `patient_access_requests` with status lifecycle (`PENDING`, `APPROVED`, `REJECTED`, `REVOKED`), timestamps (`requested_at`, `responded_at`, `revoked_at`), and composite lookup indexes.
  - Doctor Access Request APIs: Implemented `POST /api/doctor/access-requests` to request access to patients using `P-...` IDs, and `GET /api/doctor/access-requests` to view request history and authorization status.
  - Patient Consent & Sharing APIs: Implemented `GET /api/patient/access-requests` for reviewing requests, `POST /api/patient/access-requests/[id]/respond` for approving/rejecting with IDOR protection (`patient_id = user.id`), and `POST /api/patient/access-requests/[id]/revoke` for immediate revocation.
  - Doctor Patient Records API: Implemented `GET /api/doctor/patients/[patientId]/records` strictly enforcing database authorization on every call (returns 403 if unrequested, pending, rejected, or revoked). Returns full real clinical dossier: medical summary, documents (with explicit OCR draft vs clinician-confirmed status flags), active medications, lab observations/vitals, and longitudinal trends.
  - Doctor-Facing Clinical Dossier UI: Built comprehensive clinical dossier page at `/doctor/patients/[patientId]` with 5 clinical views (Overview, Medications, Prescriptions & Scans, Vitals, Trends), patient identity badges, and full authorization locks.
  - Patient Consent & Sharing UI: Built patient sharing page at `/patient/sharing` with pending request approval/rejection and one-click immediate authorization revocation. Added sidebar link in patient layout.
  - Doctor Dashboard Updates: Integrated access request dialog and status badges directly into `/doctor/dashboard`.
  - Security Verification: 10/10 automated tests passed covering unauthorized 403, pending 403, patient approval, authorized 200, immediate revocation 403, and IDOR prevention.
  - Zero modifications to `model/` folder. Zero fake medical records. Zero client-side trust.
  - Built comprehensive Doctor Dashboard UI matching the project's design system with authenticated doctor profile, persistent database-backed `D-...` ID, verification advisory, and clipboard copying.
  - Implemented server-side patient directory lookup endpoint (`POST /api/doctor/lookup-patient`) guarded by `requireDoctorSession`.
  - Added strict server-side validation of patient ID format (`P-...` format enforcement).
  - Executed queries against real database `"User"` table (zero mock patients, zero fake records, zero placeholder statistics).
  - Implemented privacy-compliant patient record confirmation: displays verified patient identity while keeping full clinical records, prescriptions, and health trends locked pending clinical authorization.
  - Implemented interactive UI states: idle, loading, invalid ID format, patient not found, unauthorized session, and success with clinical locks.
  - Zero modifications to `model/` directory.
- 2026-10-11 — Full Role-Based Access Control (RBAC) & Route Protection:
  - Implemented Next.js Server-Side Edge Middleware (`frontend/middleware.ts`) enforcing strict role checks and redirecting unauthenticated or unauthorized users before page rendering.
  - Built pure Web Crypto JWT validator (`frontend/lib/authEdge.ts`) compatible with Edge runtime without Node.js crypto/buffer dependencies.
  - Built database-backed API authorization layer (`frontend/lib/serverAuth.ts`) with `requirePatientSession` and `requireDoctorSession` verifying active database records and roles.
  - Protected patient pages (`/patient/:path*`, `/upload`, `/onboarding`): unauthenticated users redirect to `/auth/patient/login`, doctors redirect to `/doctor/dashboard`.
  - Protected doctor pages (`/doctor/:path*`): unauthenticated users redirect to `/auth/doctor/login`, patients redirect to `/patient/overview`.
  - Protected patient APIs (`/api/user/dashboard`, `/api/patient/medicines`, `/api/patient/timeline`, `/api/patient/trends`, `/api/user/save-ocr`, `/api/user/onboarding`, `/api/ocr`): doctors calling as patients receive HTTP 403 Forbidden.
  - Removed insecure hardcoded `DEMO_JWT` fallback from `frontend/app/patient/context.tsx`, properly redirecting unauthenticated or expired sessions to `/auth/patient/login`.
  - Removed silent `userId = 1` fallback on `/api/ocr` and `/api/confirm/[id]`, requiring genuine patient authentication.
  - Zero modifications to `model/` directory.
- 2026-10-11 — Dual-Role Authentication Backend Flow & UI Routes (Patient & Doctor):
  - Implemented dedicated backend endpoints: `POST /api/auth/doctor/register` and `POST /api/auth/doctor/login`.
  - Enforced zero client trust on roles: doctor endpoint strictly sets `role: 'DOCTOR'`, while patient endpoint strictly sets `role: 'PATIENT'`.
  - Server-side generation and collision-checking for persistent doctor IDs starting with `D-` (e.g., `D-XXXXXXXXX`) and patient IDs with `P-` (e.g., `P-XXXXXXXXX`), preserving all existing patient IDs.
  - Doctor registration initializes verification status strictly to `PENDING` (no auto-verification upon supplying medical registration number).
  - Secure bcrypt password hashing, HTTP-only secure cookie issuance, and JWT payload extension (`role`, `doctorId`, `doctorVerificationStatus`).
  - Cross-role route protection: attempts to log in with a doctor account on patient login, or a patient account on doctor login, are rejected with HTTP 403.
  - Duplicate account prevention with HTTP 409 and safe error handling.
  - Created portal landing page (`/auth`) and sub-routes (`/auth/patient/login`, `/auth/patient/signup`, `/auth/doctor/login`, `/auth/doctor/signup`).
  - Built unified `AuthForm` component (`frontend/components/auth/AuthForm.tsx`) connected to real endpoints, redirecting doctors to `/doctor/dashboard` and patients to `/patient/overview` or `/onboarding`.
  - Created minimal doctor dashboard landing page (`frontend/app/doctor/dashboard/page.tsx`) displaying doctor ID, pending verification status banner, and credential summary.
  - Zero modification to `model/` folder.
- 2026-10-11 — Database Schema & Authentication Extension for Doctors and Patients:
  - Extended `"User"` table with `role` (`PATIENT` | `DOCTOR`), `doctorId` (`D-` prefix), and `doctorVerificationStatus` (`NOT_REQUIRED` | `PENDING` | `APPROVED` | `REJECTED`).
  - Added doctor clinical credential columns: `medicalLicenseNumber`, `specialization`, `hospitalAffiliation`, `doctorVerificationNote`, `doctorVerifiedAt`, and `doctorVerifiedBy`.
  - Added strict database constraints (`user_role_allowed`, `user_doctor_verification_status_allowed`, `user_doctor_id_format`, `user_patient_id_format`, `user_doctor_identity_consistent`).
  - Implemented server-side cryptographically secure ID generation helpers in `frontend/lib/auth.ts`: `generatePatientId()` (`P-` prefix) and `generateDoctorId()` (`D-` prefix).
  - Preserved all existing patient accounts, 9-digit patient IDs, legacy IDs, documents, and observation associations without disruption.
  - Created idempotent SQL migration (`scratch/migrations/001_support_doctors_and_patients.sql`) and verified against Supabase PostgreSQL.
  - Updated `scratch/supabase_schema.sql` and `docs/api-data/04_DATA_MODEL.md`.


### Fixed
- 2026-10-10 — Supabase Storage Cloud Bucket Upload & Patient Overview Image Display Fix:
  - Resolved issue where prescription image uploads failed and defaulted to `/sample_prescription.png` placeholder on the Patient Overview dashboard (`/patient/overview`).
  - Configured Supabase Storage Bucket `OCR_Images` ACL to `public: true` and enabled all standard medical scan MIME types (`image/png`, `image/jpeg`, `image/webp`).
  - Updated `docker-compose.yml` to inject all Supabase URL, bucket, and key environment variables into the frontend Next.js container.
  - Upgraded `frontend/lib/supabaseStorage.ts` with a resilient dual-upload engine (Supabase JS SDK with automatic fallback to direct REST API `POST /storage/v1/object/...`), MIME normalization, and credential defaults.
  - Fixed image URL resolution in `frontend/app/api/user/dashboard/route.ts` to preserve public Supabase CDN URLs (`https://...`) without corrupting them with `/uploads/` prefix.
  - Fixed `frontend/app/api/confirm/[id]/route.ts` to sync and maintain confirmed prescription image URLs in `Document.storedFilename` and `Analysis.structuredResult`.
  - Fixed Docker container runner permissions in `frontend/Dockerfile` (`/app/public/uploads` owned by `nextjs:nodejs`) ensuring local disk fallback works reliably if cloud storage is unreachable.
  - Backfilled existing patient records with real prescription scans uploaded to Supabase Storage.

### Added
- 2026-10-11 — Generalized Prescription-Based Medication Lifecycle Management & Source Prescription Scan Inspection:
  - Created generalized reconciliation engine (`frontend/lib/medicationLifecycle.ts`) supporting ongoing treatments across multiple medical conditions, injuries, and follow-up visits without accidental deactivations.
  - Implemented 7 deterministic lifecycle categories: `NEW_COURSE`, `POSSIBLE_CONTINUATION`, `CHANGE_IN_STRENGTH_OR_INSTRUCTIONS`, `OVERLAPPING_TREATMENT`, `CONFLICTING_INSTRUCTIONS`, `POTENTIAL_DUPLICATE`, and `INSUFFICIENT_INFORMATION`.
  - Added duration parsing (`days`, `weeks`, `months`, `STAT`), expected end-date tracking, and review workflows for passed end-dates.
  - Extended PostgreSQL schema with `patient_medications` and immutable `patient_medication_audit` tables for clinical auditability.
  - Implemented REST API routes `GET/POST /api/patient/medicines` and `PATCH/PUT /api/patient/medicines/[id]` with mandatory reason validation for holds and discontinuations.
  - Built comprehensive patient dashboard at `/patient/medicines` with `Current`, `History`, and `Needs Review` views, doctor/indication filtering, and removed misleading badges.
  - Built educational status transition modal explaining clinical significance of Completed, Hold, and Discontinue with quick-select suggested reason chips.
  - Built "Source Prescription Inspection" modal featuring high-resolution physical prescription scan display, hover zoom, click-to-view in new tab, and direct external link.
  - Added dynamic high-res image serving route (`frontend/app/uploads/[...slug]/route.ts`) with automatic fallback to prevent 404s.
  - Created 41 automated tests in 14 test suites (`scratch/test_medication_lifecycle.mjs`) passing with 100% success rate.
  - Added comprehensive architecture specification in `docs/Medication-Lifecycle/README.md` and `docs/Medication-Lifecycle/IMPLEMENTATION_STATUS.md`.
- 2026-10-10 — Longitudinal Vitals Analysis, Risk Staging & Interactive Trends (`feature/Krishna`):
  - Created statistical trajectory engine (`frontend/lib/trends.ts`) implementing deterministic clinical guidelines (AHA/ACC 2017 for Blood Pressure stages and sustained rise warnings; ADA 2024 for Glycemia/HbA1c).
  - Built Next.js longitudinal trends API endpoint (`frontend/app/api/patient/trends/route.ts`) querying Supabase `observations` table, deduplicating readings, computing pairwise deltas ($\Delta$), and generating patient-friendly AI health reviews via Google Gemini (`PROMPT-002`).
  - Added `/patients/{patient_id}/trends_summary` endpoint to Python backend (`model/final_prescription_ocr_service_windows.py`) with `TrendsSummaryResponse` Pydantic model and Gemini prompt cascade.
  - Upgraded Patient Health Trends UI (`frontend/app/patient/trends/page.tsx`) with interactive SVG time-series charts (`frontend/components/patient/LongitudinalVitalChart.tsx`) featuring color-coded clinical reference bands, hover tooltips with pairwise visit deltas, metric tabs (BP, Glucose, HbA1c, Heart Rate, SpO2, Weight), Gemini AI narrative review card, and source prescription modal links.
  - Verified confirmed prescription vitals populate Supabase `observations` table cleanly in `frontend/app/api/confirm/[id]/route.ts`.
- 2026-10-08 — Supabase Storage Cloud Bucket Integration: Migrated prescription document image storage from local disk directory (`frontend/public/uploads`) to Supabase Storage Cloud Bucket (`OCR_Images/uploads/`). Created `frontend/lib/supabaseStorage.ts` helper module, updated `frontend/app/api/ocr/route.ts` and API routes to store and serve public Supabase CDN URLs, created migration script `scratch/migrate_uploads_to_supabase.js`, and cleaned up local `public/uploads` directory.
- 2026-10-08 — Patient Initial Profile Context Onboarding Flow: 4-step health context wizard (`frontend/app/onboarding/page.tsx` & `frontend/app/patient/onboarding/page.tsx`), PostgreSQL initial profile storage endpoint (`frontend/app/api/user/onboarding/route.ts`), and `patient_onboarding` database schema.
- 2026-10-08 — Deduplication detection on prescription upload (`POST /api/ocr`) via SHA-256 image hashing.
- 2026-10-08 — Discard draft functionality (`POST /api/discard/[id]`) to delete unconfirmed prescription drafts from database.
- 2026-10-07 — Documentation rebuilt from scratch against current code. All old docs archived to `docs/_archive_20261007/`. New docs cover `README.md`, `AGENTS.md`, and `docs/01` through `docs/13` plus `GLOSSARY.md`.

### Changed
- 2026-10-08 — Post-authentication routing redirect in `frontend/app/auth/page.tsx` directs patients to `/onboarding`.
- 2026-10-08 — Cleaned up all demo MVP text footers and `DemoDisclaimerFooter` across patient portal UI.

---

## [3.0] — 2026-10 (current deployed version, Confirmed in docker-compose.yml)

### Added
- Multimodal Gemini vision: `SEND_IMAGE_TO_LLM = True` — image bytes sent alongside OCR lines so Gemini can visually transcribe handwriting.
- Image resolution raised to 2048px max long side in `preprocess_image()`.
- Extended `MODEL_CANDIDATES` cascade list (9 model candidates) with fast-fail on 404/429/503.
- Extended `STARTER` medicine list with oncology and specialty drugs (Dexa, Ondem, Ultracet, Xgeva, Cloxen, HMW, Folvite, Dytor, Levolin, Meftal-P).
- Updated `SYSTEM_PROMPT` with hybrid visual + OCR extraction instructions and explicit handwriting transcription rules.
- `api_ocr_direct()` endpoint (`POST /api/ocr`) for frontend compatibility — returns bounding-box list without requiring `patient_id`.
- `/extractions` list endpoint with optional `patient_id` filter.
- Background thread for `load_med_index()` — server starts immediately while DB loads.
- Docker healthcheck on `/health` with 300s start period for PaddleOCR model download time.

### Changed
- FastAPI app version bumped to `3.0`.
- `sanitize_database_url()` now handles special characters in Supabase passwords without double-encoding.

---

## [2.x] — Prior versions

No formal changelog was maintained. History available via `git log`.

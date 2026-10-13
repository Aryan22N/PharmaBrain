# Project Cleanup Audit

## 1. Audit Summary

### Scope analyzed

The audit started at the repository root and covered the two application services, frontend routes and components, Python modules, database and migration material, scripts, tests and fixtures, documentation, deployment files, package manifests, lockfiles, environment templates, ignored local artifacts, and static assets.

The project is a two-service clinical prescription application:

- `model/` — Python 3.11 FastAPI service containing PaddleOCR/PaddleOCR-VL processing, Gemini structuring, validation, medicine matching, SQLAlchemy table definitions, and the backend API.
- `frontend/` — Next.js 16 / React 19 application containing patient and doctor portals, authentication, API proxy routes, PostgreSQL access, prescription review, medication lifecycle management, and trend analysis.
- `scratch/` — 48 manually maintained but Git-ignored scripts, schema fragments, migrations, seeders, database inspectors, tests, and a PNG fixture.
- `docs/` — architecture, API/data model, OCR, AI/model, pipeline, operations, audit, trend-analysis, and medication-lifecycle documentation.
- Root configuration — Docker Compose, environment template, README, agent instructions, changelog, and the legacy `app.py` utility.

### Measured inventory

- `171` Git-tracked files were counted with `git ls-files`.
- The filesystem also contains the 48 entries under ignored `scratch/`, the installed `frontend/node_modules/` tree, and the ignored `frontend/tsconfig.tsbuildinfo` file. These were not counted as a stable total because installed dependencies and generated files vary by machine.
- All listed source, configuration, documentation, script, test, and asset areas were inspected. The contents of `frontend/node_modules/` were treated as generated dependency output rather than audited package-by-package.

### Finding counts

Counts below refer to finding rows, with closely related paths grouped only where they have the same evidence and recommendation.

| Category | Findings | Summary |
|---|---:|---|
| A. Confirmed Unused | 1 | One entirely commented-out component has no runtime code. |
| B. Potentially Unused | 6 | No internal callers or navigation references were found, but external/manual use remains possible. |
| C. Duplicate or Redundant | 3 | Duplicate test/bootstrap/schema implementations were found. |
| D. Obsolete or Superseded | 11 | Legacy services, one-off scripts, stale schema utilities, and outdated documentation appear superseded. |
| E. Unnecessary Generated Artifacts | 2 | Local dependency/build artifacts are ignored and need not be maintained. |
| F. Potentially Unused Dependencies | 3 | Two runtime packages and one type package have no discovered imports. |
| G. Uncertain — Manual Verification | 9 | Compatibility routes, migration/seed utilities, and manual integration scripts may still have external or operational consumers. |

### Runtime verification

Runtime verification was **not performed**. No application server was started, no Docker build was run, no database connection was made, no migration or seed script was executed, and no destructive command was run. The conclusions are based on repository inspection, static reference searches, route/import tracing, content comparison, configuration inspection, and package-manifest analysis.

### Important limitations

- Text and import searches cannot prove that an external client, operator, cron job, convention-based route, or manual runbook invokes a file.
- The application has dynamic imports, Next.js file-based routes, fallback routes, direct database access, and manually operated scripts. Those paths were checked where discoverable but cannot be fully proved statically.
- `scratch/` is ignored by Git, so its presence in the working directory does not establish that the files are part of the versioned deliverable.
- The changelog refers to `scratch/migrations/001_support_doctors_and_patients.sql` and `scratch/migrations/002_patient_access_requests.sql`, but that directory was not present in the inspected filesystem. This is reported as documentation/provenance inconsistency rather than a recommendation to recreate or delete migrations.
- Environment files were identified by path, but secret values and credential values are intentionally omitted from this report.

## 2. Project Structure Overview

### Runtime architecture

1. `docker-compose.yml` builds and runs `model/Dockerfile` as `python-ocr` on port 8000 and `frontend/Dockerfile` as the Next.js service on port 3000.
2. `model/final_prescription_ocr_service_windows.py` is the production backend entry point. `model/Dockerfile` copies it to `/app/service.py`; Docker does not use root `app.py`.
3. `frontend/app/` uses Next.js App Router conventions. Page routes cover authentication, patient dashboard sections, upload/review, doctor dashboard/dossiers, and compatibility redirects. `frontend/app/api/` contains server routes for authentication, OCR proxying, persistence, patient features, doctor access, and backend proxying.
4. `frontend/middleware.ts`, `frontend/lib/authEdge.ts`, and `frontend/lib/serverAuth.ts` implement route and API authorization. `frontend/lib/db.ts` owns the Node PostgreSQL pool.
5. The Python service owns the snake_case OCR/extraction tables (`raw_ocr`, `extractions`, `confirmed_prescriptions`, `observations`, `medicine_master`, `audit_log`). The frontend also owns or mirrors quoted PostgreSQL tables such as `"User"`, `"Document"`, `"Analysis"`, `patient_timeline_events`, `patient_medications`, and `patient_access_requests`.
6. `frontend/lib/trends.ts`, `frontend/app/api/patient/trends/route.ts`, and `frontend/app/patient/trends/page.tsx` implement deterministic clinical trend calculation, eligibility gating, cache handling, and optional Gemini summaries.
7. `frontend/lib/medicationLifecycle.ts`, the medication API routes, and `frontend/app/patient/medicines/page.tsx` implement medication reconciliation, status transitions, source attribution, and audit records.

### Configuration and operational areas

- Root: `README.md`, `AGENTS.md`, `CHANGELOG.md`, `.env.example`, `.gitignore`, `docker-compose.yml`, and the legacy `app.py`.
- Python service: `model/requirements.txt`, optional `requirements-local.txt`, `Dockerfile`, bulk medicine import, connection verification, and the monolithic service module.
- Frontend build: `frontend/package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, Dockerfile, middleware, and generated local build metadata.
- Database support: `scratch/supabase_schema.sql`, legacy/partial schema scripts, migration scripts, seeders, inspection utilities, and integration tests.
- Documentation: domain-specific directories under `docs/`, plus historical planning and audit documents.
- Static assets: `frontend/app/favicon.ico`; `frontend/public/` is currently empty. Several UI fallbacks refer to `/sample_prescription.png`, but that asset was not present in the inspected `frontend/public/` directory.

## 3. Confirmed Unused Files and Folders

The following is the only high-confidence confirmed-unused source file found. “Confirmed” here means the file itself contains no executable implementation and no internal runtime reference was found; it does not claim that no historical copy exists outside the repository.

| File/Folder Path | Type | Evidence | Reason It Appears Unused | Recommendation | Confidence |
|---|---|---|---|---|---|
| `frontend/components/Navbar.tsx` | React component | **Observed:** all 122 lines are comments, including the component declaration and imports. `frontend/app/layout.tsx` contains only a commented import and commented JSX for `Navbar`. No active import was found anywhere under `frontend/`. **Conclusion:** Next.js cannot render this file as a component in the current application. | It is a fully commented-out prior navigation/status-bar implementation with no executable value. | Remove or archive after checking whether a historical branch or external documentation deliberately retains it. If retained, convert it to documentation rather than a source component. | High |

## 4. Potentially Unused Files and Folders

These files have no discovered active internal caller, but manual execution, external consumers, or framework entry-point behavior remains possible.

| File/Folder Path | Type | Evidence | Reason It Appears Unused | Recommendation | Confidence |
|---|---|---|---|---|---|
| `model/requirements-local.txt` | Alternate Python dependency manifest | **Observed:** `model/Dockerfile` copies only `requirements.txt`; `AGENTS.md` instructs `pip install -r requirements.txt`; `model/.dockerignore` explicitly excludes `requirements-local.txt`; and no script or documentation references it. It selects `paddleocr[doc-parser]==3.3.2`, while the deployed manifest selects `paddleocr==2.8.1`. **Unverified:** it may be a deliberate local PaddleOCR-VL experiment. | It is not part of the documented or Docker installation path and describes a materially different dependency stack. | Verify whether anyone uses it for local PaddleOCR-VL development. If not, remove it or replace it with a documented, reproducible optional profile. Do not merge it into the deployed requirements without testing compatibility. | Medium |
| `frontend/app/api/user/save-ocr/route.ts` | Next.js API route | **Observed:** active upload uses `frontend/app/api/ocr/route.ts`, `clientApi.uploadPrescription()`, the Python `/ocr` endpoint, Supabase image storage, and draft persistence. No frontend call to `/api/user/save-ocr` was found. The route uses a separate direct OCR persistence flow and contains legacy “Neon DB” wording. **Unverified:** an external client could call it directly. | It appears to be an older direct-save path superseded by the authenticated OCR pipeline and confirmation flow. | Search deployment logs, API consumers, and operational runbooks before removal. If no consumer exists, deprecate and remove the route and its middleware matcher. | Medium |
| `frontend/app/api/extractions/route.ts` | Next.js API proxy route | **Observed:** it proxies the Python `/extractions` list endpoint. `clientApi.listExtractions()` is defined but no call site was found. The active patient UI loads individual documents and dashboard data through other routes. **Unverified:** external tools may use the list endpoint. | No current UI flow appears to need this list endpoint. | Check external API usage and runbook examples. If unused, retire the proxy and the unused `clientApi.listExtractions()` method together. | Medium |
| `frontend/app/patient/hms/page.tsx` | Patient portal page | **Observed:** the patient sidebar links to `/patient/overview`, `/patient/documents`, `/patient/timeline`, `/patient/medicines`, `/patient/trends`, `/patient/sharing`, and `/patient/onboarding`; it does not link to `/patient/hms`. No active internal link to `/patient/hms` was found. The page displays static HMS/HL7 integration claims while only calling the dashboard context refresh. **Unverified:** direct bookmarks or a future integration may use it. | It appears to be an unlinked prototype/status screen rather than an active application flow. | Confirm whether `/patient/hms` is a supported public route and whether a real HMS integration exists. Remove or relabel as a real feature only after that check. | Low |
| `frontend/app/patient/symptoms/page.tsx` | Patient portal page | **Observed:** no active sidebar or page link to `/patient/symptoms` was found. The page reuses the generic timeline-note modal and context data. **Unverified:** a direct URL or planned navigation may still be supported. | It is an unlinked specialized view whose functionality overlaps the Health Timeline and Add Note flow. | Check product navigation and external links. If the timeline is the canonical symptom entry point, remove this page and any future route references. | Low |
| `frontend/clean_and_sync_real_data.js` | Manual database mutation script | **Observed:** no package script, Docker command, runbook entry, or source import references this file. It performs hard-coded cleanup and insertion against patient timeline/medication tables. **Unverified:** it may have been a one-time operator script. | It is a one-off data synchronization tool in the application root with no repeatable invocation contract. | Confirm it is no longer needed for a recoverable data operation. Then archive outside the application or delete from the working tree; do not execute it as part of cleanup. | Medium |

## 4A. Uncertain — Requires Manual Verification

These items have evidence of being compatibility, migration, seed, or manual-test artifacts, but static analysis cannot establish whether an operator or external caller still depends on them.

| File/Folder Path | Type | Evidence | Reason It Appears Unused or Unclear | Verification Required | Confidence |
|---|---|---|---|---|---|
| `frontend/app/patient/[id]/page.tsx`; `frontend/app/patient/[id]/[tab]/page.tsx` | Compatibility route pages | **Observed:** both routes only redirect to the current `/patient/overview` or `/patient/${tab}` pages. No current navigation creates these URL shapes. **Conclusion:** they are likely legacy URL compatibility shims. | They may protect existing bookmarks or old shared links even though no internal caller remains. | Review access logs, bookmarks, and release history. Preserve if old URLs are part of the supported contract. | Low |
| `frontend/app/patients/[id]/page.tsx` | Older patient-history page | **Observed:** current doctor navigation points to `/doctor/patients/[patientId]`; the older `/patients/[id]` page uses `clientApi.getPatientPrescriptions()` and `getPatientObservations()`. It is linked by the older `frontend/app/patient/share/page.tsx`. | It appears to be a previous doctor/share implementation, but it still has working route and proxy dependencies. | Decide which doctor record route is canonical, verify external links and authorization requirements, then migrate or retire the old page and its proxy routes as one change. | Medium |
| `scratch/migrate_neon_to_supabase.py` | Historical migration utility | **Observed:** current documentation and runtime configuration describe Supabase as the active database. The script is not referenced by package scripts or deployment configuration and uses source/target environment conventions for a one-time migration. **Unverified:** historical data migration may need repeatability. | Likely completed migration tooling, but removing it could impair disaster recovery or a still-supported migration. | Confirm migration completion, backups, and whether the source database still exists. Archive rather than delete if it is part of the migration record. | Medium |
| `scratch/seed_patient_trends.js` | Demo data seeder | **Observed:** inserts fixed multi-encounter observations for a named demo identity and has no package or runbook reference. Trend tests create their own temporary data. | It may be obsolete test/demo data setup and would mutate clinical tables if run. | Confirm whether it is used for a local demonstration environment. If not, move it to an explicit fixture area or remove it. | Medium |
| `scratch/seed_timeline_and_medicines.py` | Demo data seeder | **Observed:** it deletes existing rows for fixed patient IDs, creates tables through `create_timeline_and_medicines_tables.sql`, and inserts a large static history. No active application command invokes it. | It is a destructive one-time seed script, not a safe repeatable production migration. | Verify database provenance and whether the seeded records are still required for demos. Retain only as a clearly labeled fixture or historical setup script. | Medium |
| `scratch/cleanup_discarded.js` | Destructive maintenance script | **Observed:** no source or runbook reference was found; it deletes discarded `Analysis` and `Document` rows. | It may still be an operator cleanup tool, but its deletion behavior makes automated or casual use unsafe. | Check database retention policy, audit requirements, and operator history. Archive or remove if retention is now handled by API routes. | Low |
| `scratch/fix_sequences.js` | Database repair utility | **Observed:** no internal caller or runbook reference was found; it manually resets PostgreSQL sequences for multiple tables. | It is a useful emergency repair tool only when sequence drift occurs, not part of normal application execution. | Confirm whether sequence repair is covered by migrations/DB operations. Retain in an operations-only archive if needed. | Low |
| `scratch/test_api_endpoints.py` | Manual integration test | **Observed:** no test runner or CI workflow invokes it. It calls a live local server and performs POST mutations without a test fixture framework. | It can be useful during manual validation but does not provide a reproducible automated test entry point. | Decide whether these checks are still supported. Convert to isolated tests with setup/teardown or archive. | Medium |
| `scratch/test_document_lifecycle.py` | Manual end-to-end test | **Observed:** no test runner or CI workflow invokes it. It requires a running frontend, a specific account/fixture, and `scratch/test_rx.png`. | It may still verify the upload-confirm flow, but its environment assumptions are not encoded in project scripts. | Verify the credential/fixture strategy without exposing values, then either formalize it as a test or archive it. | Medium |

## 5. Duplicate and Redundant Files

### 5.1 Medication lifecycle test copies

- **Potentially redundant file:** `scratch/test_medication_lifecycle.js`
- **Likely canonical counterpart:** `scratch/test_medication_lifecycle.mjs`
- **Observed differences:** Both contain the same 14-suite medication lifecycle scenarios and nearly identical assertions. The `.js` version loads the TypeScript module through CommonJS `require`, while the `.mjs` version imports the TypeScript module directly and is the file named by `CHANGELOG.md`, `docs/Medication-Lifecycle/README.md`, and `docs/Medication-Lifecycle/IMPLEMENTATION_STATUS.md`.
- **Why consolidation is reasonable:** The `.mjs` file is the documented test entry point; the `.js` copy has no discovered documentation or invocation reference.
- **Safe consolidation:** Medium confidence. Confirm no historical automation invokes the `.js` filename, then retain only the documented `.mjs` test and update any external instructions.

### 5.2 Inline Docker bootstrap versus schema-driven migration

- **Potentially redundant file:** `scratch/docker_migrate.js`
- **Likely canonical counterparts:** `scratch/run_supabase_migration.js` and `scratch/supabase_schema.sql`
- **Observed differences:** Both bootstrap overlapping quoted user/document/analysis tables and Python OCR tables and seed a default user. `run_supabase_migration.js` reads the schema file, while `docker_migrate.js` embeds an older schema directly in JavaScript and is not referenced by `docker-compose.yml` or either Dockerfile.
- **Why consolidation is reasonable:** The inline copy can drift from the documented schema. The schema file is explicitly referenced by docs and the migration wrapper.
- **Safe consolidation:** Medium confidence. Verify historical Docker deployment procedures and backups, then archive the inline bootstrap in favor of the schema-driven migration or a real versioned migration system.

### 5.3 Partial timeline/medication schema versus master schema

- **Potentially redundant file:** `scratch/create_timeline_and_medicines_tables.sql`
- **Likely canonical counterpart:** `scratch/supabase_schema.sql`
- **Observed differences:** The master schema contains the modern `patient_medications` lifecycle/audit fields and access-request tables, while the partial SQL creates a smaller earlier `patient_medications` shape and `patient_timeline_events`. `scratch/seed_timeline_and_medicines.py` explicitly consumes the partial SQL.
- **Why consolidation is reasonable:** Maintaining two definitions for `patient_medications` creates schema drift risk. The partial file may still be needed for `patient_timeline_events`, so it cannot safely be removed as a whole without checking that table’s presence in the active schema.
- **Safe consolidation:** Medium confidence. Split any still-needed timeline DDL from the obsolete medication definition and migrate it into the authoritative schema or versioned migrations.

## 6. Obsolete Files and Folders

| File/Folder Path | Superseded By / Evidence | Why It Appears Obsolete | Recommendation | Confidence |
|---|---|---|---|---|
| `app.py` | `model/final_prescription_ocr_service_windows.py` and `model/Dockerfile` | **Observed:** README and `AGENTS.md` explicitly identify it as a minimal standalone OCR server, not the main service. It is not used by Docker Compose or the model Dockerfile and lacks the current LLM, database, authentication, validation, and pipeline behavior. | Confirm no developer or external workflow starts `python app.py`; then archive/remove it or label it as a separate intentionally supported utility. | Medium |
| `frontend/app/patient/share/page.tsx` | `frontend/app/patient/sharing/page.tsx` and the role-protected doctor workflow | **Observed:** current sidebar navigation points to `/patient/sharing`; the newer page calls the access-request APIs. The older page generates a client-only URL/QR-like placeholder pointing to `/patients/{patientCode}` and has no corresponding backend token generation. | Treat as a superseded share prototype. Verify old links and then remove or redirect it to `/patient/sharing`. | Medium |
| `frontend/README.md` | Root `README.md`, `docs/operations/09_RUNBOOK.md`, and project-specific `AGENTS.md` | **Observed:** it is the untouched create-next-app template, references generic Vercel deployment, and does not describe the actual Python service, Docker setup, auth, storage, or medical-safety workflow. | Replace with a short frontend-specific document or remove it after moving any useful commands into the root/runbook documentation. | High |
| `scratch/do_prompt_update.py` | Current `SYSTEM_PROMPT` in `model/final_prescription_ocr_service_windows.py` and `docs/model/10_PROMPT_REGISTRY.md` | **Observed:** the script is a one-time text-rewrite helper targeting an old prompt marker. The current backend prompt is a multimodal vision/OCR prompt and the old end marker is not part of the current prompt. No invocation reference was found. | Archive/remove after confirming the prompt migration is complete. Never run it against the current service without a backup. | High |
| `scratch/seed_neon_dmr.py` | Current Supabase schema and active Supabase-backed frontend/backend | **Observed:** filename and comments identify Neon-era seeding; it creates older tables, deletes existing documents for a fixed user, and inserts a large demo record set. No current command references it. | Retain only as historical fixture provenance if required. Otherwise archive/remove from any operator-facing scripts. | High |
| `scratch/inspect_real_patient_data.js`; `scratch/inspect_real_patient_data.py` | Current quoted `"User"`, `"Document"`, `"Analysis"` schema and current dashboard APIs | **Observed:** both scripts query obsolete lowercase `documents`/`extractions` table names and contain near-duplicate inspection logic. No current code or docs references them. | Archive/remove after confirming they are not needed to inspect a legacy database snapshot. Do not execute against the current database without review. | High |
| `scratch/inspect_raw_ocr.js` | Current `raw_ocr` definition in the backend and `scratch/supabase_schema.sql` | **Observed:** the script probes fields such as `file_name`, `file_path`, and `image_url`, while the current table definition uses `filename`, `lines_json`, image dimensions, and confidence fields. No current caller was found. | Retire or rewrite as a current schema inspector; do not retain an obsolete inspector under an active-looking name. | High |
| `scratch/test_uploaded_image_display.py` | Supabase Storage flow in `frontend/app/api/ocr/route.ts` and `frontend/lib/supabaseStorage.ts` | **Observed:** the test requires the upload response to start with `/uploads/` and tests local static serving. The current implementation prefers a Supabase public URL and uses local disk only as fallback. No test command invokes this script. | Replace with a storage-provider-aware test or archive it as a historical local-fallback test. | High |
| `scratch/add_status_reason_col.js` | `scratch/supabase_schema.sql` and current medication API queries | **Observed:** the one-off script adds `status_reason`; the master schema already declares that column and current code reads/writes it. No invocation reference was found. | Preserve migration history only if the database rollout record requires it; otherwise archive it outside routine scripts. | Medium |
| `scratch/update_db_tags.js` | Current provenance values written by `frontend/app/api/confirm/[id]/route.ts` and dashboard/timeline routes | **Observed:** it performs a one-time bulk rewrite from legacy hospital attribution to prescription-scan attribution. Current code writes the newer values directly. No invocation reference was found. | Archive as a completed data-fix record or remove after verifying the production data migration is complete. | Medium |
| `docs/audits/PHASE_0_AUDIT_REPORT.md` | Current trend implementation, doctor portal, and subsequent changelog entries | **Observed:** the report describes trend functionality as a future implementation and recommends files that now exist or have since changed. It remains useful as historical audit evidence but is not an accurate current architecture guide. | Keep as a historical audit, but mark its status/date as historical and link readers to current documentation. Do not delete without preserving audit provenance. | High |

## 7. Generated Files and Artifacts

| File/Folder Path | Observed State | Why It Need Not Be Maintained | Recommendation | Confidence |
|---|---|---|---|---|
| `frontend/node_modules/` | Present locally; ignored by both root and frontend Git ignore rules. | It is an installed dependency tree generated from `frontend/package.json` and `package-lock.json`, not source. It is reproducible with `npm ci`. | Remove from a clean source checkout or local workspace when no process is using it; recreate with `npm ci`. Never commit it and do not remove the lockfile. | High |
| `frontend/tsconfig.tsbuildinfo` | Present locally; ignored by `frontend/.gitignore` via `*.tsbuildinfo`. | It is TypeScript incremental compiler metadata and can be regenerated from `tsconfig.json`. | Remove as local cleanup if desired. Do not add it to version control. | High |

No `.next/`, Python bytecode cache, local SQLite database, preprocessed image directory, or tracked upload directory was observed in the inspected project listing. The ignored rules for those artifacts should remain.

## 8. Potentially Unused Dependencies

Search scope: all `frontend/**/*.ts`, `frontend/**/*.tsx`, `frontend/**/*.js`, `frontend/**/*.mjs`, configuration files, package scripts, and relevant documentation. The package-lock entries are dependency-resolution records, not evidence of source usage.

| Package | Manifest | Runtime or Development | Evidence of Non-Usage | Possible Tooling Dependency | Recommendation | Confidence |
|---|---|---|---|---|---|---|
| `@neondatabase/serverless` | `frontend/package.json` | Runtime | No import, require, dynamic import, or script reference was found. Active database code uses `pg` in `frontend/lib/db.ts`; project docs describe Supabase/PostgreSQL. | None discovered. The package-lock entry is only the resolved direct dependency. | Remove from `package.json` and regenerate the lockfile only in a separate dependency-maintenance change after `npm run lint` and `npm run build` pass. | High |
| `js-cookie` | `frontend/package.json` | Runtime | No source import or require was found. Authentication uses `localStorage`, Next `cookies()`, request headers, `jsonwebtoken`, and Edge Web Crypto. | None discovered. | Remove after confirming no external/client extension relies on it, then validate auth flows. | High |
| `@types/js-cookie` | `frontend/package.json` | Development | The corresponding runtime package has no source usage, and no type import was found. | None discovered. | Remove with `js-cookie`; do not remove unrelated `@types/*` packages without a separate usage check. | High |

Dependencies that must **not** be treated as unused include `pg`, `@supabase/supabase-js`, `bcryptjs`, `jsonwebtoken`, `lucide-react`, `next`, React, Tailwind/PostCSS packages, TypeScript, and the Python packages in `model/requirements.txt`; each has observed source, build, or deployment usage.

## 9. Files and Folders That Must Be Preserved

The following items may appear indirect or redundant but have observed operational, framework, security, historical, or compliance value.

### Configuration and deployment

- `README.md`, `AGENTS.md`, `.gitignore`, `.env.example`, and `CHANGELOG.md` — project setup, operating rules, secret-name documentation, ignore policy, and change history.
- `docker-compose.yml`, `model/Dockerfile`, and `frontend/Dockerfile` — active service orchestration, health check, dependency installation, standalone Next.js build, and runtime entry points.
- `frontend/package.json`, `frontend/package-lock.json`, `model/requirements.txt`, `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/eslint.config.mjs`, and `frontend/postcss.config.mjs` — build and dependency inputs. Lockfiles must not be removed merely because they are not imported.
- `frontend/middleware.ts`, `frontend/lib/authEdge.ts`, `frontend/lib/auth.ts`, `frontend/lib/serverAuth.ts`, and `frontend/lib/patientScope.ts` — authentication, role enforcement, token validation, and patient-boundary protection.

### Framework and application entry points

- `model/final_prescription_ocr_service_windows.py` — the Docker-copied production backend entry point and source of OCR, LLM, validation, database, and API behavior.
- `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/auth/**`, `frontend/app/patient/layout.tsx`, `frontend/app/doctor/**`, and active `frontend/app/api/**` routes — Next.js convention-discovered routes and layouts.
- `frontend/app/extractions/[id]/page.tsx`, `frontend/app/patient/onboarding/page.tsx`, and other redirect/re-export pages should be preserved until URL compatibility is explicitly retired.
- `frontend/app/uploads/[...slug]/route.ts` — local upload fallback and sample-image route used when cloud storage is unavailable, even though Supabase Storage is preferred.

### Database and data history

- `scratch/supabase_schema.sql` — documented schema reference for the active quoted tables, OCR tables, observations, trends cache, medication lifecycle, audit, and access-request data.
- Existing database migrations and historical migration scripts must not be deleted solely because the current application no longer imports them. Their value is in reproducible environment setup and schema history.
- `model/import_medicines_bulk.py` and the `import_medicine_csv()` function — operational medicine-master loading paths documented by the project.
- `model/test_supabase_connection.py` — manual schema/connection verification utility; it is not imported by the application but can be useful during environment setup.

### Tests, fixtures, and documentation

- `scratch/test_medication_lifecycle.mjs`, `scratch/test_trend_eligibility.js`, `scratch/test_e2e_auth_isolation.py`, and other tests referenced by the runbook or feature documentation should be retained until replaced by a maintained test runner.
- `scratch/test_rx.png` is used by the manual document lifecycle/image tests and should remain if those tests remain supported.
- `docs/architecture/**`, `docs/api-data/**`, `docs/model/**`, `docs/ocr/**`, `docs/pipeline/**`, `docs/operations/**`, `docs/Medication-Lifecycle/**`, and `docs/Trend-Analysis/**` document active behavior and safety boundaries. Stale sections should be corrected or marked historical rather than silently deleted.
- `docs/operations/08_SECURITY_PRIVACY.md`, `docs/operations/09_RUNBOOK.md`, and the healthcare safety statements in the root documentation should be preserved and updated when implementation changes.

### Static assets and legal/compliance material

- `frontend/app/favicon.ico` is a framework-discovered asset.
- `frontend/public/` is the Next.js public-asset root and should remain available for future/static fallback assets; the current directory was empty.
- No license file was present in the inspected root listing. If licensing, attribution, or compliance files exist outside this checkout, they must be preserved and included in future audits.

## 10. Recommended Cleanup Plan

### Priority 1 — Safe cleanup candidates

| Exact path | Reason | Verification required | Expected benefit |
|---|---|---|---|
| `frontend/components/Navbar.tsx` | Entirely commented out and not imported. | Confirm no historical source packaging or external code generation expects the path. | Removes dead source and avoids misleading component inventory. |
| `frontend/node_modules/` | Reproducible ignored install output. | Ensure no local dev/build process is running. | Reduces workspace size; no source behavior change. |
| `frontend/tsconfig.tsbuildinfo` | Reproducible ignored compiler metadata. | Ensure no TypeScript process is using the file. | Removes stale generated metadata. |
| `frontend/package.json` entries for `@neondatabase/serverless`, `js-cookie`, and `@types/js-cookie` | No discovered source/tooling usage. | Confirm no external build plugin or postinstall hook uses them; run `npm ci`, lint, and build after removal in a separate change. | Smaller dependency graph and install surface. |
| `scratch/test_medication_lifecycle.js` | Duplicate of documented `.mjs` test. | Search CI, release notes, and operator history for the `.js` filename. | Removes duplicate maintenance and ambiguous test entry points. |

### Priority 2 — Verify before removal

| Exact path | Reason | Verification required | Expected benefit |
|---|---|---|---|
| `model/requirements-local.txt` | Unreferenced alternate dependency stack that conflicts with the deployed manifest. | Identify local PaddleOCR-VL users and test the supported replacement. | Reduces installation ambiguity and version drift. |
| `app.py` | Standalone OCR implementation explicitly superseded by the main service. | Check external scripts, developer workflows, and historical deployment instructions. | Removes an obsolete second backend entry point. |
| `frontend/app/api/user/save-ocr/route.ts` | No internal caller; old direct-save semantics. | Check external API logs/clients and deprecation requirements. | Removes a legacy persistence path and reduces inconsistent record creation. |
| `frontend/app/api/extractions/route.ts` and `clientApi.listExtractions()` | No current UI caller. | Check external API consumers and runbook examples. | Removes unused proxy code and backend coupling. |
| `frontend/app/patient/share/page.tsx` and `frontend/app/patients/[id]/page.tsx` | Older sharing/doctor-history flow superseded by role-protected doctor routes. | Confirm URL compatibility, external links, and authorization expectations. | Removes duplicate portal behavior and misleading public-sharing assumptions. |
| `frontend/app/patient/hms/page.tsx`; `frontend/app/patient/symptoms/page.tsx` | Unlinked pages with overlapping or static/prototype behavior. | Review product requirements, analytics, and direct route access. | Reduces unexposed UI surface and stale claims. |
| `scratch/docker_migrate.js`; `scratch/create_timeline_and_medicines_tables.sql` | Inline/partial schema copies that can drift from `scratch/supabase_schema.sql`. | Review deployment history, backups, and schema ownership. | Reduces migration drift and conflicting table definitions. |
| `scratch/seed_neon_dmr.py`, `scratch/migrate_neon_to_supabase.py`, `scratch/seed_patient_trends.js`, `scratch/seed_timeline_and_medicines.py` | Historical or destructive data setup tools. | Verify migration completion and whether a demo environment still uses them. | Prevents accidental mutation of clinical data and clarifies setup. |
| `scratch/inspect_real_patient_data.*`, `scratch/inspect_raw_ocr.js`, `scratch/add_status_reason_col.js`, `scratch/update_db_tags.js` | Stale one-off inspectors/data fixes with no active references. | Preserve required audit records, then verify database state and operator history. | Removes obsolete operational surface and schema confusion. |

### Priority 3 — Optional maintenance

| Exact path | Reason | Verification required | Expected benefit |
|---|---|---|---|
| `frontend/README.md` | Generic create-next-app text does not describe this application. | Confirm root README/runbook contain all required frontend setup steps. | Improves onboarding and prevents contradictory deployment guidance. |
| `docs/audits/PHASE_0_AUDIT_REPORT.md` | Valuable historical report but no longer current. | Confirm audit retention requirements. | Keeps history while preventing readers from treating old findings as current state. |
| `KRISHNA.md` | Trend plan is marked draft/active even though implementation and feature docs exist. | Confirm whether it is a branch-specific design record. | Clarifies current versus historical planning material. |
| `scratch/` organization | Mixed migrations, destructive scripts, fixtures, tests, and inspectors share one ignored folder. | Inventory operator dependencies before moving or renaming anything. | Makes manual tooling safer and easier to discover. |
| Documentation links to missing `scratch/migrations/` paths | Changelog and docs reference migration files absent from this checkout. | Reconcile with repository history/backups; do not invent replacements. | Restores migration provenance and reduces audit uncertainty. |

## 11. Validation Checklist

Before removing any candidate, complete the applicable checks:

- [ ] Verify the file has no required direct or indirect references.
- [ ] Verify dynamic loading and framework conventions.
- [ ] Verify scripts, tests, builds, and deployment dependencies.
- [ ] Check cross-workspace references.
- [ ] Check external API consumers, bookmarks, cron jobs, and operator runbooks.
- [ ] For database material, verify migration ordering, backups, rollback plans, and historical migration requirements.
- [ ] For assets, search CSS, JSX/TSX, HTML, route handlers, configuration, and runtime URL construction.
- [ ] For dependencies, remove the manifest entry only in an isolated change and regenerate the lockfile intentionally.
- [ ] Run relevant linting, type checking, and tests after removal.
- [ ] Build all affected applications and services.
- [ ] Test relevant application flows, including authentication, upload, OCR draft review, confirmation, discard, storage fallback, medication reconciliation, trends, and doctor access where affected.
- [ ] Review the Git diff before committing.
- [ ] Confirm no secrets, patient data, or credentials were added to the cleanup change.

## 12. Audit Limitations

1. **No runtime verification:** Docker, Next.js, FastAPI, OCR model loading, Gemini calls, and database behavior were not executed. The audit therefore does not claim that a candidate was safe in a running environment.
2. **External consumers:** API routes can be used by clients that are not represented in this repository. This is especially relevant to `/api/user/save-ocr`, `/api/extractions`, older share routes, and compatibility redirects.
3. **Manual operations:** `scratch/` scripts are not wired into package scripts or CI, but an operator may still run them manually. Their lack of references is not proof that they are disposable.
4. **Framework discovery:** Next.js pages, layouts, middleware, route handlers, `favicon.ico`, and static asset directories are discovered by convention. “No import found” is not sufficient evidence for deleting a framework-convention file.
5. **Database state:** The audit did not inspect live tables, migration history, backups, or production logs. Historical migrations and data repair scripts must be reviewed against the actual database before removal.
6. **Generated dependency tree:** `frontend/node_modules/` was identified as generated output but was not individually traversed. Transitive packages were not classified as unused; only direct manifest dependencies with no discovered source use were listed.
7. **Missing or stale documentation references:** The absent `scratch/migrations/` directory and historical audit/plan documents indicate that repository history may contain material not present in this working tree.
8. **Static asset inconsistency:** Code references `/sample_prescription.png`, but no such file was found under the inspected `frontend/public/` directory. This is a possible broken fallback reference, not evidence that a different asset should be deleted.
9. **No existing audit report was present:** `PROJECT_CLEANUP_AUDIT.md` did not exist before this audit, so this report was created at the requested path.

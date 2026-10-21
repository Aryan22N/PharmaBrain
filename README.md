# Single-Hospital-Pro

**A clinician-reviewed workflow for turning prescription images into structured medical records.**

Single-Hospital-Pro combines a Next.js patient and clinician interface with a Python OCR and extraction service. It helps digitize prescription information and organize it alongside patient history. Extracted information is a draft and requires clinician review before clinical use.

[Architecture](docs/architecture/02_ARCHITECTURE.md) · [Pipeline](docs/pipeline/03_PIPELINE_SPEC.md) · [API specification](docs/api-data/05_API_SPEC.md) · [Security and privacy](docs/operations/08_SECURITY_PRIVACY.md) · [Known issues](docs/operations/13_KNOWN_ISSUES.md)

## Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Run with Docker Compose](#run-with-docker-compose)
- [Run locally](#run-locally)
- [URLs and API](#urls-and-api)
- [Database and uploaded files](#database-and-uploaded-files)
- [Prescription processing](#prescription-processing)
- [Development commands](#development-commands)
- [Security and privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Limitations and roadmap](#limitations-and-roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

The application supports patients and clinicians with prescription digitization and medical-record workflows. A patient or clinician can upload a prescription image; the OCR service extracts text and uses Gemini to produce structured draft data. A reviewer can inspect and correct the extraction before it is confirmed into the record. The web application also provides patient records, a medical timeline, and trend-related views.

This repository configures a locally run web application and OCR service. Docker Compose exposes both services on the local machine. The repository does not establish that a deployment is production-ready or compliant with a healthcare regulation.

## Features

Features present in the application and service include:

- Patient and doctor registration and login routes, with role-specific workflows.
- Prescription image upload and OCR using PaddleOCR.
- Gemini-assisted structuring of OCR output into prescription fields.
- Draft extraction review, correction, confirmation, and discard flows.
- Medicine matching against the `medicine_master` data, with uncertain matches available for human review.
- Patient medical timeline, prescription-image inspection, and record views.
- Longitudinal Health Trends & Risk Prediction Engine: Multi-encounter biomarker trajectory evaluation, strict 5-clinical-date eligibility gating, AHA/ACC 2017 & ADA 2024 guideline staging, dual-tier SHA-256 fingerprint caching, and executive AI clinical synthesis v2.0 with deterministic fallback.
- Doctor Longitudinal Dashboard & Consent Security: Clinician-facing longitudinal biomarker suite at `/doctor/patients/[patientId]`, protected by verified patient consent checks (`patient_access_requests`).
- Rapid Diagnostic Snapshot: Clickable clinical cards for active conditions, allergen hypersensitivities, and current medications opening comprehensive pharmacology, mechanisms, and clinical precaution modals.
- Supabase Storage integration for prescription images.
- Python API authentication using an `X-API-Key` token for protected endpoints.

These features are not a claim of clinical validation, accuracy, regulatory compliance, or production readiness. The project roadmap describes additional work, including PDF and multi-page support, GPU acceleration, a broader medicine database, and hybrid medicine matching.

## Architecture

```mermaid
flowchart LR
    Browser[Patient or clinician browser] --> Web[Next.js web app and API routes]
    Web -->|HTTP and X-API-Key| OCR[FastAPI OCR service]
    OCR --> Paddle[PaddleOCR]
    OCR --> Gemini[Google Gemini API]
    OCR -->|SQLAlchemy| DB[(PostgreSQL or configured backend database)]
    Web -->|SQL queries| DB
    Web -->|Supabase client| Storage[Supabase Storage]
```

The frontend handles the web experience and server-side API routes. The Python service runs OCR, Gemini structuring, validation, and related database operations. Both services use `DATABASE_URL`; for a full web application, configure it to the same PostgreSQL database. Uploaded images use the configured Supabase Storage bucket. Docker Compose also mounts a named volume for the Python service's local SQLite fallback, but SQLite does not satisfy the frontend's database requirement.

## Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript | Patient and clinician UI and server-side routes |
| Styling | Tailwind CSS 4 | Frontend styling |
| Backend | Python 3.11, FastAPI | OCR and prescription processing API |
| Database access | SQLAlchemy Core 2.x; `pg` in the frontend | SQL access from Python and Node.js |
| Database | PostgreSQL; SQLite is supported by the Python service | Patient, extraction, and related records |
| OCR | PaddleOCR 2.8 | Text extraction from prescription images |
| AI | Google Gemini via `google-genai` | Structured extraction and selected summaries |
| Medicine matching | RapidFuzz | Fuzzy candidate matching for review |
| Image storage | Supabase Storage | Prescription image storage integration |
| Containers | Docker and Docker Compose | Local multi-service setup |

Versions are taken from the package manifests and Python requirements. The project does not specify a hosted deployment provider.

## Repository layout

```text
.
├── docs/                         # Architecture, API, pipeline, operations, and domain docs
├── frontend/                     # Next.js application, API routes, and Dockerfile
├── model/                        # FastAPI OCR service, requirements, and Dockerfile
├── scratch/                      # Local scripts and SQL; most scratch files are git-ignored
├── docker-compose.yml            # Local frontend and Python service orchestration
├── .env.example                  # Environment variable template
├── CHANGELOG.md                  # Project change history
└── README.md
```

`app.py` is a minimal standalone OCR server; the main backend is `model/final_prescription_ocr_service_windows.py`.

## Prerequisites

For the Docker Compose workflow:

- Docker Engine or Docker Desktop with the Compose plugin.
- A PostgreSQL database reachable by both containers (for example, a configured Supabase PostgreSQL database).
- A Google Gemini API key.
- A Supabase project and storage credentials for prescription image storage.

For local development, install Python 3.11+, Node.js 22 (the frontend Docker image uses Node 22), and npm. The Python service downloads/initializes PaddleOCR models on first startup and may take several minutes.

## Configuration

Copy `.env.example` to `.env` and replace its placeholders. Never commit `.env` or real credentials. The template's SQLite URL is only suitable for the Python service; use PostgreSQL for the complete frontend and backend application.

```dotenv
GEMINI_API_KEY=replace_with_gemini_api_key
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
API_TOKEN=replace_with_a_long_random_token
PYTHON_API_TOKEN=replace_with_the_same_token
JWT_SECRET=replace_with_a_long_random_secret
FRONTEND_ORIGIN=http://localhost:3000
PYTHON_API_URL=http://python-ocr:8000
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace_with_supabase_anon_key
SUPABASE_ANON_KEY=replace_with_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=replace_with_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=OCR_Images
SUPABASE_STORAGE_FOLDER=uploads
```

| Variable | Required | Used by | Purpose / default |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | Python service and selected frontend routes | Gemini authentication. Set a valid key. |
| `DATABASE_URL` | Yes | Both services | Shared PostgreSQL connection string for the full application. Compose's backend-only SQLite fallback is `sqlite:////app/data/rx_local.db`; it does not serve the frontend. |
| `API_TOKEN` | Yes for protected backend API use | Python service | Backend `X-API-Key` token; auto-generated if unset when started directly, but configure a stable secret. |
| `PYTHON_API_TOKEN` | Yes for frontend-to-backend calls | Frontend | Must match `API_TOKEN`. Compose currently supplies an insecure development fallback when unset; replace it. |
| `JWT_SECRET` | Yes for secure authentication | Frontend | JWT signing and verification. Source contains an insecure fallback; configure a strong secret. |
| `PYTHON_API_URL` | No | Frontend | Python API base URL; Compose sets the internal URL. Direct local development uses `http://127.0.0.1:8000` by default. |
| `FRONTEND_ORIGIN` | No | Python service | CORS origin; defaults to `*` in the service. Compose sets `http://localhost:3000`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Required for storage integration | Frontend | Supabase project URL; the `NEXT_PUBLIC_` prefix means it is exposed to browser code. |
| `SUPABASE_URL` | Required for storage integration | Frontend | Server-side Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for the configured Supabase client | Frontend | Public/anonymous Supabase key; exposed to browser code and must rely on Supabase policies for access control. |
| `SUPABASE_ANON_KEY` | Required when no service-role key is configured | Frontend | Server-side fallback key for Supabase Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional in code; required for service-role storage access | Frontend | Secret server-side Supabase key. Never expose it to browser code. |
| `SUPABASE_STORAGE_BUCKET` | No | Frontend | Storage bucket; defaults to `OCR_Images`. |
| `SUPABASE_STORAGE_FOLDER` | No | Frontend | Storage folder; defaults to `uploads`. |
| `PADDLEOCR_DEVICE` | No | Python service | OCR device; defaults to CPU. |
| `PADDLEOCR_LANG` | No | Python service | PaddleOCR language; defaults to English. |
| `HOST`, `PORT` | No | Python service | Bind address and port; default to `0.0.0.0:8000`. |

The application also contains a default Supabase project URL in source code. Set your own project URL and keys rather than relying on that default. Compose currently sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for the frontend, which disables TLS certificate validation in that process; review and correct this configuration before any deployment that handles sensitive data.

## Run with Docker Compose

1. Clone the repository and enter its directory.
2. Create the environment file and configure the required values:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set `DATABASE_URL` to a PostgreSQL URL. Set a Gemini key, Supabase project URL and keys, a strong `JWT_SECRET`, and matching strong values for `API_TOKEN` and `PYTHON_API_TOKEN`.

3. Build and start the services:

   ```powershell
   docker compose up --build
   ```

4. Check status and logs in another terminal:

   ```powershell
   docker compose ps
   docker compose logs -f
   ```

5. Open [http://localhost:3000](http://localhost:3000). The Python service health endpoint is [http://localhost:8000/health](http://localhost:8000/health).
6. Stop the services with `Ctrl+C`, or run `docker compose down` in another terminal. `docker compose down` leaves named volumes in place; removing volumes deletes persisted local container data.
7. Rebuild after application or Docker configuration changes with `docker compose up --build`.

The first backend startup may take several minutes while OCR model files are initialized. Compose waits for the backend health check before starting the frontend.

## Run locally

The local workflow requires both services and a PostgreSQL database usable by the frontend. Configure environment variables for both processes; `.env` files are ignored by Git. Configure the Python service with `GEMINI_API_KEY`, `DATABASE_URL`, and `API_TOKEN`; configure the frontend with the same `DATABASE_URL`, `PYTHON_API_URL=http://localhost:8000`, `PYTHON_API_TOKEN` matching the backend token, `JWT_SECRET`, and the Supabase variables required for image storage.

In one terminal, install Python dependencies and start the API:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r model/requirements.txt
python model/final_prescription_ocr_service_windows.py
```

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The service reads environment variables at startup; create `model/.env` and `frontend/.env.local` or otherwise provide the variables to each process. See [`.env.example`](.env.example) and the [runbook](docs/operations/09_RUNBOOK.md) for variable details. The runbook's local SQLite option applies to the Python service only, not the complete web app.

## URLs and API

| Service | Local URL | Purpose |
|---|---|---|
| Next.js frontend | `http://localhost:3000` | Patient and clinician web interface |
| Python API | `http://localhost:8000` | OCR and prescription processing |
| Health check | `http://localhost:8000/health` | Backend readiness check; no API token required |
| OpenAPI docs | `http://localhost:8000/docs` | Interactive FastAPI documentation |

Compose maps ports 3000 and 8000 to the host. The API specification documents extraction, confirmation, patient record, observation, and trend endpoints, as well as authentication requirements. See [API specification](docs/api-data/05_API_SPEC.md).

## Database and uploaded files

The Python service uses SQLAlchemy Core and can connect to PostgreSQL or SQLite. The Next.js application also connects to PostgreSQL through `DATABASE_URL`, so use PostgreSQL for the full application. The Python service creates its managed tables at startup; the repository does not provide an automatic migration runner for the full schema. Review the SQL schema and migration scripts under `scratch/` and apply the appropriate SQL to your database deliberately. See [data model](docs/api-data/04_DATA_MODEL.md).

Docker Compose uses named volumes for the Paddle model cache and backend SQLite fallback. PostgreSQL data is managed by the configured database provider, not by a Compose volume. Prescription image storage is integrated with Supabase Storage. Configure the bucket and access policies in Supabase; the application does not configure a production backup schedule. Back up the database and uploaded files through your chosen provider's documented procedures.

## Prescription processing

1. An image is uploaded through the application.
2. PaddleOCR extracts text and confidence data.
3. Gemini attempts to structure the extraction into prescription fields.
4. The service validates fields and looks up medicine candidates against its medicine data.
5. The result remains a draft for clinician review and correction.
6. On confirmation, the reviewed record is saved to the patient's medical record and timeline.

OCR and AI can misread or omit information. The generated output is not a diagnosis or prescription, and must not be used clinically until reviewed and confirmed by a licensed clinician.

## Development commands

Frontend commands from `frontend/`:

```powershell
npm ci
npm run dev
npm run lint
npm run build
npm run start
```

`package.json` does not define a dedicated test or type-check script. The repository contains ad hoc scripts under `scratch/` and `model/`; they are not presented as a maintained automated test suite. For backend setup, see [Python requirements](model/requirements.txt). For Docker integration, use `docker compose up --build`.

## Security and privacy

- Treat prescription images and extracted records as sensitive health information. Use synthetic data for local development unless your environment is approved for real patient data.
- Store secrets outside source control. Do not expose `SUPABASE_SERVICE_ROLE_KEY`, database credentials, Gemini keys, API tokens, or `JWT_SECRET` to browser code.
- Configure a strong `JWT_SECRET` and matching strong `API_TOKEN`/`PYTHON_API_TOKEN`. Source and Compose contain development fallbacks that are unsuitable for deployment.
- The Python service defaults CORS to `*` when `FRONTEND_ORIGIN` is unset. Set the intended origin explicitly.
- Compose currently disables TLS certificate validation in the frontend process. This must be addressed before deployment with sensitive data.
- Review Supabase Storage policies and database access controls for your deployment. The README does not establish regulatory compliance or a security certification.
- Avoid sharing logs that may contain request or operational details. Do not put patient data or secrets in issue reports.

See [security and privacy documentation](docs/operations/08_SECURITY_PRIVACY.md) and [known issues](docs/operations/13_KNOWN_ISSUES.md).

## Troubleshooting

| Symptom | Checks |
|---|---|
| Backend reports a missing Gemini key | Set `GEMINI_API_KEY` for the Python process/container and restart it. |
| Database connection fails | Confirm `DATABASE_URL` is valid and reachable from both services. For the full app it must point to PostgreSQL; SQLite only covers the Python service. |
| Frontend cannot call the Python service | In Compose use the internal URL configured by Compose; in local development set `PYTHON_API_URL=http://localhost:8000`. Ensure `PYTHON_API_TOKEN` matches backend `API_TOKEN`. |
| Uploads fail or images do not display | Check the Supabase URL and key variables, bucket name, bucket policies, and storage availability. |
| Backend takes a long time to become healthy | Initial PaddleOCR model setup can take several minutes. Inspect `docker compose logs -f python-ocr` and the `/health` endpoint. |
| Gemini structuring fails | Check API key validity, provider availability, quota, and backend logs. A failed structuring attempt may require retrying the extraction workflow. |
| A local port is already in use | Stop the process using port 3000 or 8000, or adjust the host-side port mapping in Compose. |
| Authentication behaves unexpectedly | Set `JWT_SECRET` consistently for the frontend and restart it; do not rely on the source fallback. |

For additional operational guidance, see the [runbook](docs/operations/09_RUNBOOK.md).

## Limitations and roadmap

Known constraints include CPU-based OCR in the default Compose configuration, no automatic full-schema migration framework, and security configuration that needs review before deployment. The project roadmap lists GPU acceleration, PDF and multi-page support, broader medicine data, and hybrid matching as planned improvements. Check the [roadmap](docs/architecture/12_ROADMAP.md) and [known issues](docs/operations/13_KNOWN_ISSUES.md) for current project status.

## Contributing

1. Create a focused feature branch.
2. Make and document a scoped change.
3. Run the relevant lint, build, or service checks available for the change.
4. Open a pull request describing the change and its validation.

Do not include real patient data, credentials, or generated local artifacts in contributions.

## License

No license file is currently present in the repository. The project's license has not been specified.

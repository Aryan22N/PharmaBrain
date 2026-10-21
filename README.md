<div align="center">

<img src="https://github.com/user-attachments/assets/ac75b89d-c9b4-4393-81e9-31bddba22817" alt="PharmaBrain — from a crumpled prescription photo to a clinician-verified health record" width="100%"/>

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
<br/>
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PaddleOCR](https://img.shields.io/badge/PaddleOCR-2.8-0053D6?style=for-the-badge&logo=paddlepaddle&logoColor=white)](https://github.com/PaddlePaddle/PaddleOCR)
[![Gemini](https://img.shields.io/badge/Google_Gemini-AI-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_+_Storage-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/compose/)

**[Why](#-why-pharmabrain)** ·
**[Features](#-features)** ·
**[How it works](#-how-it-works)** ·
**[Quick start](#-quick-start)** ·
**[Docs](#-documentation)** ·
**[Roadmap](#-roadmap)**

</div>

<br/>

> [!WARNING]
> **PharmaBrain produces drafts, not clinical decisions.** OCR and AI can misread or omit information. Every extraction stays in `PENDING_USER_CONFIRMATION` until a human reviews it, and there is no auto-confirm path. The project makes no claim of clinical validation, accuracy, regulatory compliance or production readiness. Use synthetic data unless your environment is approved for real patient data.

---

## 💡 Why PharmaBrain

Prescriptions are still mostly paper. Each one is a snapshot, so a patient's history ends up scattered across clinics, folders and phone galleries. Slow trends go unnoticed, and a new prescription can quietly overwrite a long-term treatment.

PharmaBrain turns those snapshots into a **continuous, patient-owned medical record**:

| 😵 Without it | 🧠 With PharmaBrain |
|---|---|
| Handwritten slips, lost in a drawer | Photo in, structured draft out in seconds |
| One-off readings, no context | Longitudinal vitals with guideline-based reference bands |
| Every Rx looks like an isolated list | A medication lifecycle that never silently cancels unrelated treatments |
| Records shared as photos on WhatsApp | Doctor access that is patient-approved, time-boxed and revocable |
| "Trust the AI" | **Human in the loop.** The LLM structures text and never invents drug facts |

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 📸 Prescription Intelligence
- Upload a photo and get **PaddleOCR** text with confidence scores
- **Gemini** structures it into typed prescription fields
- Every field carries `src` line IDs, so each value is **traceable to the exact OCR line**
- Duplicate uploads are caught by SHA-256 and resume from saved OCR
- Review, edit, **confirm or discard** drafts in a dedicated review screen

</td>
<td width="50%" valign="top">

### 💊 Medication Lifecycle Engine
- Reconciles medicines **across prescriptions and doctors**
- Classifies each change: `NEW_COURSE`, `POSSIBLE_CONTINUATION`, `CHANGE_IN_STRENGTH_OR_INSTRUCTIONS`, `CONFLICTING_INSTRUCTIONS`, `OVERLAPPING_TREATMENT`, `POTENTIAL_DUPLICATE`, `INSUFFICIENT_INFORMATION`
- Parses durations into expected end dates
- Patient controls with reasons and a full **audit trail**
- Inspect the original prescription scan beside each medicine

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📈 Longitudinal Trend Analysis
- Deterministic staging against **AHA/ACC 2017** (blood pressure) and **ADA 2024** (glycemic) guidelines
- Pairwise deltas, monthly velocity and sustained-rise warnings
- **5-visit gate** (5 confirmed prescriptions on 5 distinct dates) before multi-visit AI synthesis
- Gemini writes a plain-language, non-diagnostic summary plus questions for your next visit
- SHA-256 caching, so Gemini is only called on request

</td>
<td width="50%" valign="top">

### 🔐 Consent-Based Doctor Sharing
- Separate **patient** and **doctor** roles and portals
- Doctors look up patients by ID and request access
- Patients approve with an **auto-revoke window of 3, 8 or 30 days**
- Expired or revoked access is blocked server-side with `403`
- Patient timeline, onboarding and demographics stay in sync

</td>
</tr>
</table>

<details>
<summary><b>🧩 More under the hood</b></summary>

<br/>

- **Medicine matching** against `medicine_master` with RapidFuzz. Near-matches are flagged for review and **never auto-accepted**.
- **PII masking** of emails and phone numbers before the prompt reaches Gemini.
- **Resilient Gemini calls** with model-candidate fallback and bounded retries. A failed structuring attempt can be resumed.
- **Patient timeline** with idempotent confirmation, draft callouts and "Review & Submit" or "Discard Draft" actions.
- **Supabase Storage** for prescription images, with a disk fallback.
- **Python API auth** via `X-API-Key`. **JWT** auth with `bcrypt` password hashing on the web side.
- A per-event **audit log** in the OCR pipeline.

</details>

---

## 🔬 How it works

<img src="https://github.com/user-attachments/assets/95a1d900-26e3-4e4f-9104-f115f78f5922" alt="Pipeline: Upload, OCR, Structure, Validate, Human review, Living record" width="100%"/>

<br/>

```mermaid
flowchart LR
    U(["🧑‍⚕️ Patient / Clinician"]) --> W["<b>Next.js 16</b><br/>UI + API routes"]
    W -- "HTTP + X-API-Key" --> O["<b>FastAPI</b><br/>OCR service"]
    O --> P["PaddleOCR"]
    O --> G["Google Gemini"]
    O -- SQLAlchemy --> D[("PostgreSQL<br/>Supabase")]
    W -- "pg pool" --> D
    W -- "Supabase client" --> S[("Storage<br/>prescription images")]

    classDef core fill:#0d2433,stroke:#5eead4,color:#f1f5f9;
    classDef ext fill:#12303a,stroke:#38bdf8,color:#f1f5f9;
    class W,O core
    class P,G,D,S ext
```

### Design principles

| Principle | How it is enforced |
|---|---|
| 🧑‍⚕️ **Human in the loop** | Every extraction starts as `PENDING_USER_CONFIRMATION`. No auto-confirm path exists. |
| 📚 **LLM is not a source of truth** | Drug facts come only from `medicine_master`. The LLM structures text and never generates drug data. |
| 🔎 **Traceability** | Every extracted field carries OCR line IDs, and the `audit_log` records every pipeline event. |
| 🛡️ **PII before LLM** | `mask_pii()` strips emails and phones before the prompt is sent. |
| ⚠️ **Safe corrections** | Auto-corrected fields are flagged `check`. Near-match drugs are never auto-accepted. |

> [!NOTE]
> Patient names, diagnoses and medicine data **are sent to the Google Gemini API** as part of structuring. Review [Security & Privacy](docs/operations/08_SECURITY_PRIVACY.md) before using any real data.

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide icons |
| **Web API** | Next.js route handlers, `jsonwebtoken`, `bcryptjs`, `pg` |
| **Backend** | Python 3.11, FastAPI, Uvicorn, Pydantic 2 |
| **OCR** | PaddleOCR 2.8 on PaddlePaddle 2.6 (CPU by default) |
| **AI** | Google Gemini through the `google-genai` SDK |
| **Matching** | RapidFuzz |
| **Data** | PostgreSQL (Supabase), SQLAlchemy Core 2.x, SQLite fallback for the Python service only |
| **Storage** | Supabase Storage |
| **Infra** | Docker and Docker Compose |

---

## 🚀 Quick start

### Prerequisites

- Docker with the Compose plugin
- A **PostgreSQL** database reachable by both services (a Supabase project works well)
- A **Google Gemini API key**
- A **Supabase** project (URL, keys and a storage bucket) for prescription images

### 1 · Clone and configure

```bash
git clone https://github.com/<your-username>/PharmaBrain.git
cd PharmaBrain
cp .env.example .env
```

Edit `.env` and set at least:

```dotenv
GEMINI_API_KEY=...
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=<long random string>
API_TOKEN=<long random token>
PYTHON_API_TOKEN=<same value as API_TOKEN>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-side only, never expose to the browser
```

> [!IMPORTANT]
> The `.env.example` SQLite URL only covers the Python service. **Use PostgreSQL for the full app**, because the frontend queries it directly. Replace every placeholder with strong values, and never commit `.env`.

### 2 · Launch

```bash
docker compose up --build
```

The first backend start downloads and initialises the PaddleOCR models, which can take **several minutes**. Compose waits for the backend health check before starting the frontend.

### 3 · Open

| Service | URL |
|---|---|
| 🌐 Web app | http://localhost:3000 |
| ⚙️ OCR API | http://localhost:8000 |
| 📖 Interactive API docs | http://localhost:8000/docs |
| 💓 Health check | http://localhost:8000/health |

### Run without Docker

```bash
# Terminal 1: OCR service
python -m venv .venv && source .venv/bin/activate     # Windows: .\.venv\Scripts\Activate.ps1
pip install -r model/requirements.txt
python model/final_prescription_ocr_service_windows.py

# Terminal 2: web app
cd frontend
npm ci
npm run dev
```

Provide the same variables through `model/.env` and `frontend/.env.local`, and set `PYTHON_API_URL=http://localhost:8000` for the frontend. The [runbook](docs/operations/09_RUNBOOK.md) lists every variable.

<details>
<summary><b>🔧 Environment variable reference</b></summary>

<br/>

| Variable | Used by | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Backend, some frontend routes | Gemini authentication |
| `DATABASE_URL` | Both | Shared PostgreSQL connection string |
| `API_TOKEN` / `PYTHON_API_TOKEN` | Backend / frontend | `X-API-Key` shared secret. The two must match. |
| `JWT_SECRET` | Frontend | JWT signing and verification |
| `FRONTEND_ORIGIN` | Backend | CORS origin (defaults to `*` if unset, so set it) |
| `PYTHON_API_URL` | Frontend | Backend base URL |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` | Frontend | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY` | Frontend | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Frontend (server) | Secret storage key |
| `SUPABASE_STORAGE_BUCKET` / `_FOLDER` | Frontend | Defaults: `OCR_Images` / `uploads` |
| `PADDLEOCR_DEVICE`, `PADDLEOCR_LANG` | Backend | OCR device and language (CPU, English) |
| `HOST`, `PORT` | Backend | Bind address (`0.0.0.0:8000`) |

</details>

---

## 📁 Repository layout

```text
PharmaBrain/
├── frontend/                 # Next.js 16 app: patient + doctor portals, API routes
│   ├── app/                  #   pages and route handlers (auth, patient, doctor, ocr, ...)
│   ├── components/           #   MedicineEditor, VitalsDisplay, charts, modals
│   └── lib/                  #   medicationLifecycle, trends, auth, db, storage
├── model/                    # FastAPI OCR + structuring service, Dockerfile, bulk medicine importer
├── Flows/                    # Interactive HTML flow diagrams (OCR, timeline, trends, sharing)
├── docs/                     # Architecture, pipeline, API, security, runbook, domain docs
├── scratch/                  # SQL schema, migrations and ad hoc test scripts
├── docker-compose.yml        # Frontend + OCR service orchestration
├── .env.example              # Environment template
└── CHANGELOG.md
```

---

## 📚 Documentation

| | |
|---|---|
| 🏛️ [Architecture](docs/architecture/02_ARCHITECTURE.md) | Components, failure modes and design principles |
| 🔄 [Pipeline spec](docs/pipeline/03_PIPELINE_SPEC.md) | Every stage from image to confirmed record |
| 🔌 [API spec](docs/api-data/05_API_SPEC.md) | Endpoints and authentication |
| 🗄️ [Data model](docs/api-data/04_DATA_MODEL.md) | Tables and relationships |
| 💊 [Medication lifecycle](docs/Medication-Lifecycle/README.md) | Reconciliation rules and audit trail |
| 📈 [Trend analysis](docs/Trend-Analysis/README.md) | Clinical bands, gating and caching |
| 🔒 [Security & privacy](docs/operations/08_SECURITY_PRIVACY.md) | Data flows and risks |
| 🛠️ [Runbook](docs/operations/09_RUNBOOK.md) · [Known issues](docs/operations/13_KNOWN_ISSUES.md) | Operating and troubleshooting |

The `Flows/` folder also contains interactive HTML diagrams you can open in a browser.

---

## 🧪 Development

```bash
cd frontend
npm run dev      # dev server
npm run lint     # ESLint
npm run build    # production build
```

There is no unified test runner yet. Ad hoc verification scripts live in `scratch/` (for example `test_trend_eligibility.js`, `test_e2e_auth_isolation.py` and `test_document_lifecycle.py`). Apply the SQL under `scratch/` to your database deliberately, because there is no automatic migration framework yet.

---

## 🔐 Security notes

Please read before deploying anywhere that matters:

- Set strong, unique `JWT_SECRET`, `API_TOKEN` and `PYTHON_API_TOKEN`, and never rely on the fallbacks in source or Compose.
- Set `FRONTEND_ORIGIN` explicitly, because CORS defaults to `*` when it is unset.
- The provided `docker-compose.yml` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for the frontend. **Remove it** before handling sensitive data.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only, and review your Supabase Storage policies.
- Never put real patient data or secrets in issues, logs or commits.

---

## 🗺️ Roadmap

- [x] OCR → Gemini structuring → human review → confirmed record
- [x] Patient timeline and prescription image inspection
- [x] Medication lifecycle engine with audit trail
- [x] Longitudinal vitals trend engine with cached AI summaries
- [x] Patient onboarding and demographics
- [x] Doctor portal with consent-based, auto-expiring access
- [x] Supabase cloud storage for prescription images
- [ ] Production-grade secrets and a locked-down CORS and TLS setup
- [ ] Licensed Indian medicine dataset (NLEM / Jan Aushadhi / CDSCO) with pharmacist verification
- [ ] Evaluation test set and published baseline accuracy
- [ ] Hybrid medicine matching (`pg_trgm` + `pgvector`)
- [ ] GPU-accelerated OCR
- [ ] Multi-page PDF support
- [ ] Real-time progress updates (WebSockets)
- [ ] Migration framework (Alembic)
- [ ] Trend view in the doctor portal

Full details: [roadmap](docs/architecture/12_ROADMAP.md) · [changelog](CHANGELOG.md)

---

## 🤝 Contributing

1. Create a focused feature branch.
2. Keep the change scoped and documented.
3. Run the relevant checks (`npm run lint`, `npm run build`, or the service checks).
4. Open a pull request that describes the change and how you validated it.

Do not include real patient data, credentials or generated local artifacts.

## 📄 License

No license has been specified yet. Add a `LICENSE` file to declare how others may use this project.

---

<div align="center">

**Built so the paper trail finally follows the patient.** 🩺

<sub>PharmaBrain is a research and engineering project. It is not a medical device and does not provide medical advice.</sub>

</div>

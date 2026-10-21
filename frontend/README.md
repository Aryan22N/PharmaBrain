# Single-Hospital-Pro — Frontend Application

Modern Next.js 16 clinical EHR and patient intelligence platform. Built with React 19, TypeScript, and Tailwind CSS 4.

---

## 🌟 Overview

The frontend of **Single-Hospital-Pro** provides dual-role healthcare portals:
1. **Patient Portal (`/patient/*`)**: Medical timeline, prescription uploads, active medication management, longitudinal health trends, allergy tracking, and clinical consent governance.
2. **Doctor Portal (`/doctor/*`)**: Practice dashboard, patient directory lookup (`P-...`), authorized clinical dossiers, longitudinal biomarker trajectory inspection, and rapid diagnostic snapshots.

All clinical records extracted from paper prescriptions via PaddleOCR and Google Gemini require explicit human-in-the-loop verification before commit.

---

## 🚀 Key Features

### 1. Patient Portal
- **Dashboard Overview (`/patient/overview`)**: Real-time synthesized health summary, active diagnoses, latest glycemic biomarkers, ongoing regimens, conflicting medicines callouts, and allergy cards with modification/deletion modals.
- **Prescription Upload & Review (`/upload`, `/patient/documents/[id]`)**: Drag-and-drop prescription photograph upload, real-time OCR extraction preview, interactive drug editor, and resilient draft review/discard recovery lifecycle.
- **Medication Lifecycle (`/patient/medicines`)**: Non-destructive reconciliation across multi-doctor orders, 7 lifecycle categories (Active, Completed, Held, Discontinued, Needs Review), duration end-date calculation, and source prescription scan modal inspection.
- **Longitudinal Trends & Risk Engine (`/patient/trends`)**: 5-clinical-date eligibility gating, AHA/ACC 2017 & ADA 2024 guideline staging, multi-tier SHA-256 fingerprint caching, and Google Gemini Executive AI Synthesis v2.0 with deterministic fallback.
- **Clinical Consent Sharing (`/patient/sharing`)**: Patient-controlled doctor authorization with configurable auto-revocation policy (3, 8, 30 days), real-time KPI metrics, in-flight duration adjustments, and instant one-click revocation.
- **Demographics & Settings (`/patient/settings`)**: Bi-directional profile synchronization with `patient_demographics`, `patient_onboarding`, and root `User` records.

### 2. Doctor Portal
- **Practice Dashboard (`/doctor/dashboard`)**: Verified doctor identity (`D-...`), real-time practice metrics, incoming patient access requests, and patient directory search.
- **Authorized Clinical Dossier (`/doctor/patients/[patientId]`)**:
  - Gated by active, unexpired patient consent (`patient_access_requests`).
  - 5 interactive clinical tabs: Overview, Medications, Prescriptions & Scans, Vitals, and Trends.
  - Reusable `<LongitudinalTrendsDashboard isDoctorView={true} />` embedded under `#biomarkers`.
  - Rapid Diagnostic Snapshot: Interactive clinical reference drawers powered by `frontend/lib/medicalDescriptions.ts` with normal ranges and doctor interpretation notes.

---

## 📁 Repository & Folder Architecture

```text
frontend/
├── app/
│   ├── api/                           # Next.js Route Handlers (Server-Side)
│   │   ├── auth/                      # Login, register, session verification
│   │   ├── confirm/[id]/              # Human-in-the-loop prescription confirmation
│   │   ├── discard/[id]/              # Draft cascade discard & cleanup
│   │   ├── doctor/                    # Doctor dashboard, lookup, dossiers, trends
│   │   ├── extractions/[id]/          # OCR draft retrieval with DB fallback
│   │   ├── patient/                   # Medicines, timeline, trends, allergies, sharing
│   │   ├── upload/                    # Dual-engine upload to Supabase Storage & Python API
│   │   └── user/                      # Dashboard synthesis, onboarding, profile sync
│   ├── doctor/                        # Doctor portal pages (dashboard, patient dossier)
│   ├── patient/                       # Patient portal pages (overview, meds, trends, etc.)
│   ├── onboarding/                    # 4-step patient clinical onboarding wizard
│   ├── upload/                        # Prescription upload interface
│   ├── layout.tsx                     # Root HTML layout and font configurations
│   └── page.tsx                       # Public landing page
├── components/
│   ├── trends/                        # Reusable LongitudinalTrendsDashboard component
│   ├── patient/                       # Patient-specific charts and cards
│   ├── MedicineEditor.tsx             # Interactive medicine table editor
│   ├── Navbar.tsx                     # Top navigation bar
│   └── Sidebar.tsx                    # Locked non-scrolling patient sidebar
├── lib/
│   ├── api.ts                         # Client API fetch wrapper with Bearer token injection
│   ├── auth.ts                        # JWT generation and verification
│   ├── authEdge.ts                    # Pure Web Crypto JWT validator for Edge Middleware
│   ├── db.ts                          # PostgreSQL connection pool with TLS verification
│   ├── medicalDescriptions.ts         # Clinical reference dictionary (vitals, labs, conditions)
│   ├── medicationLifecycle.ts         # Generalized medication reconciliation engine
│   ├── patientScope.ts                # Strict multi-tenant patient ID query isolation
│   ├── supabaseStorage.ts             # Cloud image storage client with REST fallback
│   ├── trends.ts                      # Guideline staging & statistical velocity calculations
│   └── trendsService.ts               # Core server-side trends evaluation & Gemini synthesis v2.0
├── middleware.ts                      # Server-side Edge Middleware route protection (RBAC)
└── Dockerfile                         # Standalone multi-stage production Docker container
```

---

## 🔒 Security & Access Control

- **Edge Middleware (`middleware.ts`)**: Pure Web Crypto JWT validator running on Next.js Edge runtime. Strictly routes unauthenticated users to `/login` and blocks cross-role access between patients and clinicians.
- **Patient Isolation (`patientScope.ts`)**: Prevents cross-account record leakage by scoping database queries strictly to the authenticated user's canonical `P-...` and legacy IDs.
- **Time-Bound Clinical Consent**: Doctor routes enforce `expires_at > NOW()` on `patient_access_requests`, immediately locking dossiers with `403 Forbidden` once consent expires.
- **TLS & Certificate Verification**: `frontend/lib/db.ts` enforces TLS certificate chain verification against Supabase Root & Intermediate CA certificates.

---

## 🛠 Local Development

### Prerequisites
- Node.js 20+ (Node.js 22 recommended)
- Running PostgreSQL database (Supabase instance recommended)
- Running Python OCR backend on port 8000

### Installation & Execution

```bash
# Install dependencies
npm install

# Start local Next.js development server
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

### Environment Variables
Configure `frontend/.env.local` (see root `.env.example`):
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require
NEXT_PUBLIC_API_URL=http://localhost:8000
JWT_SECRET=your_secure_random_jwt_secret_key
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
GEMINI_API_KEY=[GEMINI_API_KEY]
```

### Build for Production
```bash
npm run build
npm run start
```

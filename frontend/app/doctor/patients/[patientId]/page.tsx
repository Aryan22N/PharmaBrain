"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  FileText,
  Pill,
  Activity,
  AlertCircle,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Heart,
  Stethoscope,
  Search,
  Bell,
  Sparkles,
  Check,
  Printer,
  Eye,
  ExternalLink,
  Droplet,
  Phone,
  MapPin,
  Mail,
  ChevronRight,
} from "lucide-react";
import { LongitudinalTrendsDashboard } from "@/components/trends/LongitudinalTrendsDashboard";
import {
  getMedicationDescription,
  getConditionDescription,
  getAllergyDescription,
} from "@/lib/medicalDescriptions";

interface MedicationItem {
  id: number;
  name: string;
  strength?: string | null;
  frequency?: string | null;
  form?: string | null;
  route?: string | null;
  indication?: string | null;
  doctor?: string | null;
  start_date?: string | null;
  conflict_details?: string | null;
  reconciliation_notes?: string | null;
  status: string;
  prescribed_by?: string | null;
  hospital?: string | null;
  reconciliation_category?: string | null;
  actual_end_date?: string | null;
  expected_end_date?: string | null;
  duration_raw?: string | null;
  duration_days?: number | null;
  discontinued_reason?: string | null;
  reference_id?: string | number | null;
  source?: string | null;
}

interface StructuredConditionItem {
  id: string | number;
  name: string;
  category: string;
  status: string;
  source: string;
  diagnosedDate?: string | null;
  icd10Code?: string | null;
  severity?: string | null;
  doctor?: string | null;
  facility?: string | null;
  notes?: string | null;
}

interface StructuredAllergyItem {
  id: string | number;
  name: string;
  severity: string;
  status: string;
  reaction: string;
  source: string;
  category?: string | null;
  notes?: string | null;
  addedDate?: string | null;
}

interface ObservationItem {
  id: number;
  obs_date?: string | null;
  kind: string;
  systolic?: number | null;
  diastolic?: number | null;
  value?: number | null;
  unit?: string | null;
  raw_text?: string | null;
}

interface DocStructuredMedicine {
  name?: { val?: string } | string;
  strength?: { val?: string } | string;
  frequency?: { val?: string } | string;
}

interface DocStructuredResult {
  hospital?: unknown;
  doctor?: unknown;
  doctor_reg_no?: string | null;
  dateIso?: string | null;
  medicines?: DocStructuredMedicine[];
  vitals?: unknown[];
  diagnoses?: unknown[];
  notes?: string;
  [key: string]: unknown;
}

function formatDoctorName(docField: unknown): string {
  if (!docField) return "Attending Physician";
  if (typeof docField === "string") {
    if (docField.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(docField);
        return parsed?.name ? (parsed.reg_no ? `${parsed.name} (${parsed.reg_no})` : parsed.name) : docField;
      } catch {
        return docField;
      }
    }
    return docField;
  }
  if (typeof docField === "object" && docField !== null) {
    const d = docField as { name?: string; reg_no?: string };
    if (d.name) {
      return d.reg_no ? `${d.name} (${d.reg_no})` : d.name;
    }
  }
  return String(docField || "Attending Physician");
}

function formatHospitalName(hospField: unknown): string {
  if (!hospField) return "Medical Facility";
  if (typeof hospField === "string") {
    if (hospField.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(hospField);
        return parsed?.name || hospField;
      } catch {
        return hospField;
      }
    }
    return hospField;
  }
  if (typeof hospField === "object" && hospField !== null) {
    const h = hospField as { name?: string };
    if (h.name) return h.name;
  }
  return String(hospField || "Medical Facility");
}

interface DocumentItem {
  id: number;
  originalName: string;
  documentType: string;
  status: string;
  clinicalVerification: string;
  isDraft: boolean;
  uploadedAt: string;
  summary?: string | null;
  structuredResult?: DocStructuredResult | null;
  storedFilename?: string | null;
  filePath?: string | null;
  imageUrl?: string | null;
}

function getPrescriptionImageUrl(doc: DocumentItem | null): string | null {
  if (!doc) return null;
  const candidate =
    doc.imageUrl ||
    (doc.structuredResult as Record<string, unknown> | null | undefined)?.imageUrl ||
    doc.storedFilename ||
    doc.filePath;
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/uploads/")) {
    return trimmed;
  }
  const clean = trimmed.replace(/^(\.\/|\/)/, "");
  return `https://dvydfsahkqzgluusdsnn.supabase.co/storage/v1/object/public/OCR_Images/uploads/${clean}`;
}

interface RecordDossier {
  authorized: boolean;
  authorization: {
    status: string;
    authorizedDoctor: string;
    doctorCode: string;
    approvedAt: string;
    auditNote: string;
  };
  patient: {
    id: number;
    name: string;
    email: string;
    patientId: string;
    legacyPatientId?: string | null;
    accountRegisteredAt: string;
    onboardingInfo?: {
      basic_info?: Record<string, unknown> | null;
      conditions?: Record<string, unknown> | null;
      custom_conditions?: unknown[] | Record<string, unknown> | null;
      history?: {
        allergies?: string | null;
        pastSurgeries?: string | null;
        [key: string]: unknown;
      } | null;
    } | null;
  };
  medicalSummary: {
    totalDocuments: number;
    confirmedPrescriptionsCount: number;
    draftPrescriptionsCount: number;
    activeMedicationsCount: number;
    totalObservationsCount: number;
  };
  documents: DocumentItem[];
  medications: {
    active: MedicationItem[];
    history: MedicationItem[];
    needsReview: MedicationItem[];
    total: number;
  };
  observations: ObservationItem[];
  conditions?: any[];
  allergies?: any[];
  longitudinalTrends?: {
    narrative?: string | null;
    summary?: string | null;
    totalEncounters?: number | null;
    timeRange?: {
      start?: string | null;
      end?: string | null;
    } | null;
    [key: string]: unknown;
  } | null;
}

// Dynamic SVG Sparkline Generator based on DB history points
function DynamicSparkline({
  points,
  color = "#2F7D78",
  height = 80,
  targetValue,
  targetLabel,
  targetBand,
  emptyMessage = "No clinical history recorded in database",
}: {
  points?: { value: number; date: string }[];
  color?: string;
  height?: number;
  targetValue?: number;
  targetLabel?: string;
  targetBand?: { min: number; max: number };
  emptyMessage?: string;
}) {
  if (!points || points.length === 0) {
    return (
      <div className="w-full h-24 flex flex-col items-center justify-center border-b border-dashed border-[#DCE4ED] text-[#94A3B8]">
        <span className="text-[11px] italic font-medium">{emptyMessage}</span>
      </div>
    );
  }

  const width = 240;
  const paddingX = 14;
  const paddingY = 12;

  if (points.length === 1) {
    return (
      <div className="w-full h-24 flex flex-col items-center justify-center">
        <svg className="w-full h-16 overflow-visible" fill="none" viewBox={`0 0 ${width} 60`}>
          <line x1="10" y1="30" x2="230" y2="30" stroke={color} strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="120" cy="30" r="4.5" fill={color} stroke="white" strokeWidth="2" />
          <text x="120" y="20" textAnchor="middle" fill="#0F172A" fontSize="10" fontWeight="bold">
            {points[0].value} ({points[0].date})
          </text>
        </svg>
        <span className="text-[10px] text-[#64748B] font-mono">Single recorded reading</span>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (targetBand) {
    min = Math.min(min, targetBand.min);
    max = Math.max(max, targetBand.max);
  }
  if (targetValue != null) {
    min = Math.min(min, targetValue);
    max = Math.max(max, targetValue);
  }
  const range = max - min || 1;

  const coords = points.map((p, idx) => {
    const x = paddingX + (idx / (points.length - 1)) * (width - paddingX * 2);
    const normalized = (p.value - min) / range;
    const y = height - paddingY - normalized * (height - paddingY * 2);
    return { x, y, value: p.value, date: p.date };
  });

  const pathD = coords.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ""
  );

  const targetY =
    targetValue != null
      ? height - paddingY - ((targetValue - min) / range) * (height - paddingY * 2)
      : null;

  return (
    <div className="w-full h-24 relative flex items-end">
      <svg
        className="w-full h-full overflow-visible"
        fill="none"
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        {targetY != null && (
          <>
            <line
              x1="0"
              y1={targetY}
              x2={width}
              y2={targetY}
              stroke="#A7E9DF"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            {targetLabel && (
              <text x="4" y={Math.max(10, targetY - 4)} fill="#2F7D78" fontSize="8" fontWeight="600">
                {targetLabel}
              </text>
            )}
          </>
        )}

        <path
          d={pathD}
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coords.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r={idx === coords.length - 1 ? 4.5 : 3.5}
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}

// Dynamic Dual-Line Vector Chart for Blood Pressure (Systolic & Diastolic)
function DualBpSparkline({
  points,
  emptyMessage = "No blood pressure records in timeline",
}: {
  points?: { systolic: number | null; diastolic: number | null; date: string }[];
  emptyMessage?: string;
}) {
  const validPoints = (points || []).filter((p) => p.systolic != null && p.diastolic != null);

  if (validPoints.length === 0) {
    return (
      <div className="w-full h-24 flex flex-col items-center justify-center border-b border-dashed border-[#DCE4ED] text-[#94A3B8]">
        <span className="text-[11px] italic font-medium">{emptyMessage}</span>
      </div>
    );
  }

  const height = 80;
  const width = 240;
  const paddingX = 14;
  const paddingY = 12;

  if (validPoints.length === 1) {
    const pt = validPoints[0];
    return (
      <div className="w-full h-24 flex flex-col items-center justify-center">
        <svg className="w-full h-16 overflow-visible" fill="none" viewBox={`0 0 ${width} 60`}>
          <line x1="10" y1="30" x2="230" y2="30" stroke="#DCE4ED" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="100" cy="30" r="4.5" fill="#2F7D78" stroke="white" strokeWidth="2" />
          <circle cx="140" cy="30" r="4.5" fill="#2874B5" stroke="white" strokeWidth="2" />
          <text x="120" y="20" textAnchor="middle" fill="#0F172A" fontSize="10" fontWeight="bold">
            {pt.systolic}/{pt.diastolic} mmHg ({pt.date})
          </text>
        </svg>
        <span className="text-[10px] text-[#64748B] font-mono">Single recorded reading</span>
      </div>
    );
  }

  const allSys = validPoints.map((p) => p.systolic as number);
  const allDia = validPoints.map((p) => p.diastolic as number);
  const min = Math.min(...allDia, 60);
  const max = Math.max(...allSys, 160);
  const range = max - min || 1;

  const sysCoords = validPoints.map((p, idx) => {
    const x = paddingX + (idx / (validPoints.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - (((p.systolic as number) - min) / range) * (height - paddingY * 2);
    return { x, y };
  });

  const diaCoords = validPoints.map((p, idx) => {
    const x = paddingX + (idx / (validPoints.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - (((p.diastolic as number) - min) / range) * (height - paddingY * 2);
    return { x, y };
  });

  const sysPath = sysCoords.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ""
  );
  const diaPath = diaCoords.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ""
  );

  return (
    <div className="w-full h-24 relative flex items-end">
      <svg
        className="w-full h-full overflow-visible"
        fill="none"
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Systolic Line (Teal) */}
        <path d={sysPath} stroke="#2F7D78" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {sysCoords.map((pt, idx) => (
          <circle
            key={`sys-${idx}`}
            cx={pt.x}
            cy={pt.y}
            r={idx === sysCoords.length - 1 ? 4.5 : 3.5}
            fill="#2F7D78"
            stroke="white"
            strokeWidth="2"
          />
        ))}

        {/* Diastolic Line (Blue) */}
        <path
          d={diaPath}
          stroke="#2874B5"
          strokeWidth="2"
          strokeDasharray="3 3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {diaCoords.map((pt, idx) => (
          <circle
            key={`dia-${idx}`}
            cx={pt.x}
            cy={pt.y}
            r={idx === diaCoords.length - 1 ? 4.5 : 3.5}
            fill="#2874B5"
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}

export default function DoctorPatientRecordPage() {
  const router = useRouter();
  const routeParams = useParams();

  const rawParam = routeParams?.patientId;
  const paramPatientId = Array.isArray(rawParam)
    ? rawParam[0]
    : typeof rawParam === "string"
    ? rawParam
    : "";

  const cleanPatientId = React.useMemo(() => {
    try {
      return decodeURIComponent(paramPatientId || "")
        .trim()
        .replace(/\s+/g, "-")
        .toUpperCase();
    } catch {
      return (paramPatientId || "").trim().replace(/\s+/g, "-").toUpperCase();
    }
  }, [paramPatientId]);

  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dossier, setDossier] = useState<RecordDossier | null>(null);

  // Active section for in-page navigation & filters
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [timeRange, setTimeRange] = useState<"6M" | "1Y" | "3Y" | "ALL">("1Y");
  const [timelineFilter, setTimelineFilter] = useState<"ALL" | "PRESCRIPTION" | "LAB" | "CONSULT">("ALL");
  const [patientSearchInput, setPatientSearchInput] = useState("");
  const [selectedDocForModal, setSelectedDocForModal] = useState<DocumentItem | null>(null);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<MedicationItem | null>(null);
  const [showAllMedications, setShowAllMedications] = useState(false);
  const [isMedicationsModalOpen, setIsMedicationsModalOpen] = useState(false);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const [docModalTab, setDocModalTab] = useState<"scan" | "details">("scan");
  const [selectedConditionForModal, setSelectedConditionForModal] = useState<StructuredConditionItem | null>(null);
  const [selectedAllergyForModal, setSelectedAllergyForModal] = useState<StructuredAllergyItem | null>(null);
  const [selectedMedicationForModal, setSelectedMedicationForModal] = useState<MedicationItem | null>(null);

  const loadDossier = React.useCallback(async () => {
    if (!cleanPatientId) {
      setLoading(false);
      setErrorStatus(400);
      setErrorMessage("Patient ID is required.");
      return;
    }

    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`/api/doctor/patients/${encodeURIComponent(cleanPatientId)}/records`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          router.replace(`/auth/doctor/login?redirect=/doctor/patients/${encodeURIComponent(cleanPatientId)}`);
          return;
        }
        setErrorStatus(res.status);
        setErrorMessage(data.error || "Failed to load patient medical records.");
        return;
      }

      setDossier(data);
    } catch (err: unknown) {
      setErrorStatus(500);
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect to patient records service.");
    } finally {
      setLoading(false);
    }
  }, [cleanPatientId, router]);

  useEffect(() => {
    void loadDossier();
  }, [loadDossier]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#2F7D78] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-[#0F172A]">Verifying Patient Authorization...</h2>
        <p className="text-sm text-[#64748B] mt-1">
          Validating database consent keys and decrypting clinical records for ID:{" "}
          <span className="font-mono font-bold text-[#0F172A]">{cleanPatientId || paramPatientId}</span>
        </p>
      </div>
    );
  }

  // 1. FORBIDDEN / LOCKED STATE (Strict security enforcement)
  if (errorStatus === 403 || (dossier && !dossier.authorized)) {
    return (
      <div className="min-h-screen bg-[#F7F9FB] flex flex-col justify-center items-center p-4">
        <div className="max-w-lg w-full bg-white border border-[#FECACA] rounded-2xl p-8 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF2F2] text-[#DC2626] mx-auto flex items-center justify-center border border-[#FCA5A5]">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
              Access Restricted
            </span>
            <h1 className="text-xl font-bold text-[#0F172A] mt-2">Clinical Authorization Required</h1>
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
              {errorMessage ||
                "You do not possess active clinical authorization to inspect this patient's medical dossier. Access was either not granted, declined, or revoked by the patient."}
            </p>
          </div>

          <div className="p-4 bg-[#F7F9FB] rounded-xl border border-[#DCE4ED] text-left text-xs space-y-1.5 text-[#475569] font-mono">
            <div>
              Patient ID: <strong className="text-[#0F172A]">{cleanPatientId || paramPatientId}</strong>
            </div>
            <div>Status: <span className="text-[#DC2626] font-bold">LOCKED_CONSENT_UNCONFIRMED</span></div>
            <div className="text-[11px] text-[#64748B] font-sans">
              Knowing a patient ID does not grant access. A confirmed patient consent approval is legally required.
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/doctor/dashboard")}
              className="px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Return to Doctor Dashboard
            </button>
            <button
              onClick={loadDossier}
              className="px-4 py-2 bg-white hover:bg-[#F1F5F9] border border-[#DCE4ED] text-[#334155] rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. PATIENT NOT FOUND
  if (errorStatus === 404) {
    return (
      <div className="min-h-screen bg-[#F7F9FB] flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white border border-[#DCE4ED] rounded-2xl p-8 shadow-xs text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-[#94A3B8] mx-auto" />
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">Patient Record Not Found</h1>
            <p className="text-xs text-[#64748B] mt-1">
              No patient with identifier &ldquo;{cleanPatientId || paramPatientId}&rdquo; was found in the hospital registry.
            </p>
          </div>
          <button
            onClick={() => router.push("/doctor/dashboard")}
            className="px-4 py-2 bg-[#2F7D78] text-white rounded-xl text-xs font-semibold hover:bg-[#256B66] transition-colors"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  // 3. SERVER / NETWORK ERROR
  if (errorStatus || !dossier) {
    return (
      <div className="min-h-screen bg-[#F7F9FB] flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white border border-[#FECACA] rounded-2xl p-8 shadow-xs text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-[#DC2626] mx-auto" />
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">Unable to Load Medical Records</h1>
            <p className="text-xs text-[#64748B] mt-1">
              {errorMessage || "A network or server error occurred while retrieving clinical records."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => router.push("/doctor/dashboard")}
              className="px-4 py-2 bg-white hover:bg-[#F1F5F9] border border-[#DCE4ED] text-[#334155] rounded-xl text-xs font-semibold transition-colors"
            >
              Doctor Dashboard
            </button>
            <button
              onClick={loadDossier}
              className="px-4 py-2 bg-[#2F7D78] hover:bg-[#256B66] text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    patient = { id: 0, name: "", email: "", patientId: cleanPatientId, accountRegisteredAt: "" },
    medicalSummary = { totalDocuments: 0, confirmedPrescriptionsCount: 0, draftPrescriptionsCount: 0, activeMedicationsCount: 0, totalObservationsCount: 0 },
    documents = [],
    medications = { active: [], history: [], needsReview: [], total: 0 },
    observations = [],
    longitudinalTrends = null,
    authorization = { status: "", authorizedDoctor: "", doctorCode: "", approvedAt: "", auditNote: "" },
    conditions: dbConditions = [],
    allergies: dbAllergies = [],
  } = dossier || {};

  // Safe collections
  const safeMedications = {
    active: Array.isArray(medications?.active) ? medications.active : [],
    history: Array.isArray(medications?.history) ? medications.history : [],
    needsReview: Array.isArray(medications?.needsReview) ? medications.needsReview : [],
    total: typeof medications?.total === "number" ? medications.total : 0,
  };
  const safeObs = Array.isArray(observations) ? observations : [];
  const safeDocs = Array.isArray(documents) ? documents : [];

  // Derive patient metadata dynamically
  const basicInfo = (patient?.onboardingInfo?.basic_info as Record<string, unknown>) || {};
  
  // Calculate dynamic age from explicit age or birth date
  let patientAge: string | null = null;
  if (basicInfo.age != null && basicInfo.age !== "") {
    patientAge = `${basicInfo.age} y/o`;
  } else if (basicInfo.dob) {
    const birth = new Date(String(basicInfo.dob));
    if (!isNaN(birth.getTime())) {
      const today = new Date();
      let years = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        years--;
      }
      if (years >= 0) patientAge = `${years} y/o`;
    }
  }

  const patientGender = basicInfo.gender ? String(basicInfo.gender).trim() : null;
  const patientDob = basicInfo.dob ? String(basicInfo.dob) : null;
  const patientBloodGroup = (basicInfo.bloodGroup || basicInfo.blood_group || basicInfo.blood || basicInfo.bloodType)
    ? String(basicInfo.bloodGroup || basicInfo.blood_group || basicInfo.blood || basicInfo.bloodType).trim().toUpperCase()
    : null;
  const patientPhone = (basicInfo.phone || basicInfo.phone_number || basicInfo.contact)
    ? String(basicInfo.phone || basicInfo.phone_number || basicInfo.contact).trim()
    : null;
  const patientCity = basicInfo.city ? String(basicInfo.city).trim() : null;
  const patientState = basicInfo.state ? String(basicInfo.state).trim() : null;
  const patientPincode = basicInfo.pincode ? String(basicInfo.pincode).trim() : null;
  const patientAddress = basicInfo.address ? String(basicInfo.address).trim() : null;
  const emergencyContactName = (basicInfo.emergencyName || basicInfo.emergency_contact_name || basicInfo.emergency_contact)
    ? String(basicInfo.emergencyName || basicInfo.emergency_contact_name || basicInfo.emergency_contact).trim()
    : null;
  const emergencyContactPhone = (basicInfo.emergencyPhone || basicInfo.emergency_contact_phone)
    ? String(basicInfo.emergencyPhone || basicInfo.emergency_contact_phone).trim()
    : null;

  // Normalized conditions from database + onboarding without hardcoding category/source
  const structuredConditions: StructuredConditionItem[] = [];
  const seenNames = new Set<string>();

  if (Array.isArray(dbConditions)) {
    dbConditions.forEach((c: any, idx: number) => {
      const name = (c?.condition_name || "").trim();
      if (name && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        structuredConditions.push({
          id: c.id || `db-cond-${idx}`,
          name,
          category: c.category || c.status || "Condition",
          status: c.status || "Active",
          source: c.doctor
            ? `Diagnosed by ${formatDoctorName(c.doctor)}`
            : c.facility
            ? formatHospitalName(c.facility)
            : "Clinical Record Confirmed",
          diagnosedDate: c.diagnosed_date || null,
          icd10Code: c.icd10_code || null,
          severity: c.severity || null,
          doctor: c.doctor ? formatDoctorName(c.doctor) : null,
          facility: c.facility ? formatHospitalName(c.facility) : null,
          notes: c.notes || null,
        });
      }
    });
  }

  const conditionsList = Array.isArray(patient?.onboardingInfo?.conditions)
    ? (patient.onboardingInfo?.conditions as string[])
    : [];
  const customConditionsList = Array.isArray(patient?.onboardingInfo?.custom_conditions)
    ? (patient.onboardingInfo?.custom_conditions as string[])
    : [];

  [...conditionsList, ...customConditionsList].forEach((cond, idx) => {
    const name = (typeof cond === "string" ? cond : "").trim();
    if (name && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      structuredConditions.push({
        id: `onb-cond-${idx}`,
        name,
        category: "Reported",
        status: "Self-Reported",
        source: "Patient Onboarding Declaration",
        diagnosedDate: null,
      });
    }
  });

  // Structured allergies without hardcoding counts or intake labels
  const structuredAllergies: StructuredAllergyItem[] = [];
  const seenAllergens = new Set<string>();

  if (Array.isArray(dbAllergies) && dbAllergies.length > 0) {
    dbAllergies.forEach((a: any, idx: number) => {
      const allergen = (a?.allergen || "").trim();
      if (allergen && !seenAllergens.has(allergen.toLowerCase())) {
        seenAllergens.add(allergen.toLowerCase());
        structuredAllergies.push({
          id: a.id || `db-all-${idx}`,
          name: allergen,
          severity: a.severity || a.status || "Active Flag",
          status: a.verification_status || a.status || "Confirmed",
          reaction: a.reaction ? `Reaction: ${a.reaction}` : a.notes ? String(a.notes) : "Documented clinical allergy",
          source: a.source ? `Source: ${a.source}` : "Clinical Record",
          category: a.category || null,
          notes: a.notes || null,
          addedDate: a.added_date || null,
        });
      }
    });
  }

  const onboardingAllergies = patient?.onboardingInfo?.history?.allergies;
  if (typeof onboardingAllergies === "string" && onboardingAllergies.trim()) {
    onboardingAllergies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((allergen, idx) => {
        if (!seenAllergens.has(allergen.toLowerCase())) {
          seenAllergens.add(allergen.toLowerCase());
          structuredAllergies.push({
            id: `onb-all-${idx}`,
            name: allergen,
            severity: "Declared",
            status: "Self-Reported",
            reaction: "Documented during patient intake",
            source: "Patient Intake",
          });
        }
      });
  }

  const patientAllergiesSummary = structuredAllergies.length > 0
    ? structuredAllergies.map((a) => a.name).join(", ")
    : null;

  // Derive latest vitals measurements directly from database observations
  const bpObs = safeObs.filter((o) => o && (o.kind === "bp" || o.kind === "blood_pressure"));
  const latestBp = bpObs[bpObs.length - 1] || null;

  const glucoseObs = safeObs.filter(
    (o) =>
      o &&
      typeof o.kind === "string" &&
      (o.kind === "glucose" ||
        o.kind === "sugar_fasting" ||
        o.kind === "sugar_random" ||
        o.kind === "sugar_post_meal" ||
        o.kind.includes("glucose") ||
        o.kind.includes("sugar"))
  );
  const latestGlucose = glucoseObs[glucoseObs.length - 1] || null;

  const hba1cObs = safeObs.filter(
    (o) =>
      o &&
      typeof o.kind === "string" &&
      (o.kind === "hba1c" || o.kind.includes("hba1c") || o.kind.includes("a1c"))
  );
  const latestHba1c = hba1cObs[hba1cObs.length - 1] || null;

  const hrObs = safeObs.filter(
    (o) =>
      o &&
      typeof o.kind === "string" &&
      (o.kind === "heart_rate" || o.kind === "pulse" || o.kind === "hr" || o.kind === "pr")
  );
  const latestHr = hrObs[hrObs.length - 1] || null;

  const spo2Obs = safeObs.filter(
    (o) =>
      o &&
      typeof o.kind === "string" &&
      (o.kind === "spo2" || o.kind.includes("spo2") || o.kind.includes("oxygen") || o.kind.includes("o2"))
  );
  const latestSpo2 = spo2Obs[spo2Obs.length - 1] || null;

  const weightObs = safeObs.filter(
    (o) => o && typeof o.kind === "string" && (o.kind === "weight" || o.kind === "wt")
  );
  const latestWeight = weightObs[weightObs.length - 1] || null;

  const heightObs = safeObs.filter(
    (o) => o && typeof o.kind === "string" && (o.kind === "height" || o.kind === "ht")
  );
  const latestHeight = heightObs[heightObs.length - 1] || null;
  const rawHeightVal = latestHeight?.value ?? (basicInfo?.height ? Number(basicInfo.height) : null);

  let parsedHeightM: number | null = null;
  if (rawHeightVal != null && !isNaN(Number(rawHeightVal)) && Number(rawHeightVal) > 0) {
    const val = Number(rawHeightVal);
    if (val > 30 && val < 280) parsedHeightM = val / 100; // cm to meters
    else if (val >= 0.5 && val <= 2.8) parsedHeightM = val; // already in meters
  }

  const bmiObs = safeObs.filter((o) => o && o.kind === "bmi");
  const latestBmi = bmiObs[bmiObs.length - 1] || null;

  let calculatedBmi: string | null = null;
  if (latestBmi?.value != null) {
    calculatedBmi = Number(latestBmi.value).toFixed(1);
  } else if (latestWeight?.value != null && parsedHeightM != null) {
    const w = Number(latestWeight.value);
    if (w > 0) {
      calculatedBmi = (w / (parsedHeightM * parsedHeightM)).toFixed(1);
    }
  }

  const creatinineObs = safeObs.filter(
    (o) => o && typeof o.kind === "string" && o.kind.includes("creatinine")
  );
  const latestCreatinine = creatinineObs[creatinineObs.length - 1] || null;

  // Derive latest record validation timestamp
  const validationTimestamps: number[] = [];
  safeObs.forEach((o) => {
    if (o.obs_date) {
      const t = new Date(o.obs_date).getTime();
      if (!isNaN(t)) validationTimestamps.push(t);
    }
  });
  safeDocs.forEach((d) => {
    if (d.uploadedAt) {
      const t = new Date(d.uploadedAt).getTime();
      if (!isNaN(t)) validationTimestamps.push(t);
    }
  });
  if (authorization?.approvedAt) {
    const t = new Date(authorization.approvedAt).getTime();
    if (!isNaN(t)) validationTimestamps.push(t);
  }
  const latestValidationDate = validationTimestamps.length > 0
    ? new Date(Math.max(...validationTimestamps)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Map observations to chronological history arrays for trend analysis
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

  const filterHistory = <T extends { date: string }>(items: T[], range: "6M" | "1Y" | "3Y" | "ALL"): T[] => {
    if (range === "ALL") return items;
    const now = new Date();
    const months = range === "6M" ? 6 : range === "1Y" ? 12 : 36;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).getTime();
    return items.filter((item) => {
      if (!item.date) return true;
      const itemTime = new Date(item.date).getTime();
      return !isNaN(itemTime) && itemTime >= cutoff;
    });
  };

  const filteredHba1c = filterHistory(hba1cHistory, timeRange);
  const filteredGlucose = filterHistory(glucoseHistory, timeRange);
  const filteredBp = filterHistory(bpHistory, timeRange);

  const baselineHba1c = filteredHba1c.length > 0 ? filteredHba1c[0] : null;
  const currentHba1c = filteredHba1c.length > 0 ? filteredHba1c[filteredHba1c.length - 1] : null;

  const baselineGlucose = filteredGlucose.length > 0 ? filteredGlucose[0] : null;
  const currentGlucose = filteredGlucose.length > 0 ? filteredGlucose[filteredGlucose.length - 1] : null;

  const baselineBp = filteredBp.length > 0 ? filteredBp[0] : null;
  const currentBp = filteredBp.length > 0 ? filteredBp[filteredBp.length - 1] : null;

  // Derive latest clinical event (consultation note or most recent document)
  const latestEventDoc = safeDocs[0] || null;

  // Filter timeline documents
  const filteredTimelineDocs = safeDocs.filter((doc) => {
    if (timelineFilter === "ALL") return true;
    if (timelineFilter === "PRESCRIPTION") return doc.documentType?.toUpperCase().includes("PRESCRIPTION");
    if (timelineFilter === "LAB") return doc.documentType?.toUpperCase().includes("LAB") || doc.documentType?.toUpperCase().includes("REPORT");
    if (timelineFilter === "CONSULT") return doc.documentType?.toUpperCase().includes("CONSULT") || doc.documentType?.toUpperCase().includes("SUMMARY");
    return true;
  });

  const timelineCounts = {
    ALL: safeDocs.length,
    PRESCRIPTION: safeDocs.filter((d) => d.documentType?.toUpperCase().includes("PRESCRIPTION")).length,
    LAB: safeDocs.filter((d) => d.documentType?.toUpperCase().includes("LAB") || d.documentType?.toUpperCase().includes("REPORT")).length,
    CONSULT: safeDocs.filter((d) => d.documentType?.toUpperCase().includes("CONSULT") || d.documentType?.toUpperCase().includes("SUMMARY")).length,
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (patientSearchInput.trim()) {
      router.push(`/doctor/patients/${patientSearchInput.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] text-[#0F172A] font-sans antialiased">
      {/* ==========================================
          1. FIXED TOP CLINICAL HEADER
          ========================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#DCE4ED] h-16">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Brand & Portal Switcher */}
          <div className="flex items-center gap-4 shrink-0">
            <Link href="/doctor/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#2F7D78] flex items-center justify-center text-white shadow-xs">
                <Stethoscope className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-semibold text-base text-[#2F7D78] tracking-tight">
                Patient-Centric DMR
              </span>
            </Link>
          </div>

          {/* Quick Patient ID Search */}
          <div className="flex-1 max-w-md mx-2 hidden md:block">
            <form onSubmit={handleGlobalSearch} className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-[#94A3B8]" />
              <input
                type="text"
                value={patientSearchInput}
                onChange={(e) => setPatientSearchInput(e.target.value)}
                placeholder={cleanPatientId ? `Search patient by ID (current: ${cleanPatientId})...` : "Search patient by ID..."}
                className="w-full pl-9 pr-4 py-1.5 bg-[#F8FAFC] rounded-lg border border-[#DCE4ED] text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#2F7D78] focus:bg-white transition-all font-mono"
              />
            </form>
          </div>

          {/* Practitioner Info & Status */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Active Consent Pill */}
            <div className="hidden lg:flex items-center gap-2 bg-[#E8F6F4] border border-[#A7E9DF] px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#2F7D78] animate-pulse" />
              <ShieldCheck className="w-4 h-4 text-[#2F7D78]" />
              <span className="text-xs text-[#2F7D78] font-medium truncate max-w-xs">
                {authorization?.status === "APPROVED" ? "Active Consent" : (authorization?.status || "Consent")} • Dr. {authorization?.authorizedDoctor || "Attending Doctor"}
              </span>
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {safeMedications.needsReview.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626]" />
              )}
            </button>

            {/* Doctor Profile Chip */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-[#DCE4ED]">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-[#0F172A] leading-tight">
                  {authorization?.authorizedDoctor ? `Dr. ${authorization.authorizedDoctor}` : "Attending Doctor"}
                </span>
                <span className="text-[11px] font-mono text-[#64748B] leading-tight">
                  {authorization?.doctorCode || ""}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#2F7D78] text-white flex items-center justify-center font-bold text-xs">
                {(authorization?.authorizedDoctor || "D").trim().charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ==========================================
          2. FIXED LEFT CLINICAL SIDEBAR
          ========================================== */}
      <aside className="fixed left-0 top-16 bottom-0 w-72 bg-white border-r border-[#DCE4ED] z-40 hidden md:flex flex-col justify-between overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          {/* Active Record Card */}
          <div className="p-3 bg-[#F7F9FB] rounded-xl border border-[#DCE4ED]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                Active Record
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F6F4] text-[#2F7D78] border border-[#A7E9DF]">
                {authorization?.status === "APPROVED" ? "Consent Verified" : (authorization?.status || "Consent Active")}
              </span>
            </div>
            <div className="text-sm font-bold text-[#0F172A] truncate">{patient?.name || "Patient Record"}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[#64748B]">
              {patientAge && <span className="font-medium">{patientAge}</span>}
              {patientGender && <span>• {patientGender}</span>}
              {patientBloodGroup && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#FEF2F2] text-[#DC2626] font-bold text-[10px] border border-[#FECACA]">
                  <Droplet className="w-2.5 h-2.5 fill-current" />
                  <span>{patientBloodGroup}</span>
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-[#94A3B8] mt-1 truncate">
              ID: {patient.patientId}
            </div>
          </div>

          {/* Section Navigation Links */}
          <nav className="flex flex-col gap-1">
            {[
              { id: "overview", label: "Patient Overview", icon: Activity },
              { id: "alerts", label: "Attention Flags", icon: AlertTriangle, badge: safeMedications.needsReview.length > 0 ? String(safeMedications.needsReview.length) : undefined },
              { id: "diagnostic-snapshot", label: "Diagnostic Snapshot", icon: Stethoscope },
              { id: "biomarkers", label: "Vitals & Trends", icon: TrendingUp },
              { id: "timeline", label: "Medical Timeline", icon: Clock, count: safeDocs.length },
              { id: "documents", label: "Reports & Documents", icon: FileText, count: safeDocs.length },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-left ${
                    isActive
                      ? "bg-[#E8F6F4] text-[#2F7D78] font-bold border-l-4 border-[#2F7D78]"
                      : "text-[#64748B] font-medium hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#2F7D78]" : "text-[#94A3B8]"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626]">
                      {item.badge}
                    </span>
                  ) : item.count !== undefined ? (
                    <span className="text-[11px] font-mono text-[#94A3B8]">{item.count}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Patient Switcher Pin */}
        <div className="p-4 border-t border-[#DCE4ED] bg-white">
          <div className="flex items-center justify-between gap-2 p-2.5 bg-[#F7F9FB] rounded-xl border border-[#DCE4ED]">
            <div className="flex items-center gap-2 overflow-hidden">
              <RotateCcw className="w-4 h-4 text-[#2F7D78] shrink-0" />
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-[#0F172A] truncate">
                  {patient?.name || "Patient Record"}
                </span>
                <span className="text-[11px] text-[#64748B]">
                  {authorization?.status ? `${authorization.status} Dossier` : "Clinical Dossier"}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/doctor/dashboard")}
              className="px-2 py-1 bg-white hover:bg-[#2F7D78] hover:text-white text-[#2F7D78] border border-[#DCE4ED] rounded-lg text-[11px] font-semibold transition-colors shrink-0"
            >
              Switch
            </button>
          </div>
        </div>
      </aside>

      {/* ==========================================
          3. MAIN CLINICAL VIEWPORT
          ========================================== */}
      <main className="md:pl-72 pt-16 min-h-screen">
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* SECTION 1: Patient Identity & Consent Access Banner */}
          <section id="overview" className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4ED] shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Patient Core Identity */}
              <div className="lg:col-span-5 flex items-start gap-4 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-xl bg-[#E8F6F4] flex items-center justify-center text-[#2F7D78] font-bold text-2xl shadow-xs select-none">
                    {(patient?.name || "Patient")
                      .split(" ")
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "PT"}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#2F7D78] text-white flex items-center justify-center ring-2 ring-white shadow-xs"
                    title="Active Longitudinal Consent"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                </div>

                <div className="flex flex-col min-w-0 gap-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                      {patient?.name || "Patient"}
                    </h1>
                    {patientAge && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-xs font-medium">
                        {patientAge}
                      </span>
                    )}
                    {patientGender && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-xs font-medium">
                        {patientGender}
                      </span>
                    )}
                    {patientBloodGroup && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] text-xs font-bold shadow-2xs">
                        <Droplet className="w-3 h-3 fill-[#DC2626]" />
                        <span>{patientBloodGroup}</span>
                      </span>
                    )}
                    {patientDob && (
                      <span className="text-xs text-[#64748B] font-medium hidden sm:inline">
                        DOB: {patientDob}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono mt-0.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F7F9FB] border border-[#DCE4ED] text-[#0F172A]">
                      <span className="text-[#94A3B8] font-sans font-normal">PMR</span>
                      <span className="font-semibold">{patient.patientId}</span>
                      <CheckCircle2 className="w-3 h-3 text-[#2F7D78]" />
                    </span>
                    {patient.legacyPatientId && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F7F9FB] border border-[#DCE4ED] text-[#0F172A]">
                        <span className="text-[#94A3B8] font-sans font-normal">Legacy</span>
                        <span className="font-semibold">{patient.legacyPatientId}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Longitudinal Consent Window */}
              <div className="lg:col-span-4 flex flex-col gap-2 p-3 rounded-xl bg-[#F7F9FB] border border-[#DCE4ED]">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E8F6F4] text-[#2F7D78] text-xs font-semibold border border-[#A7E9DF]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{authorization?.status ? `${authorization.status} Clinical Access` : "Authorized Clinical Access"}</span>
                  </div>
                  <span className="text-[11px] text-[#64748B] font-mono">
                    {authorization?.approvedAt
                      ? `Approved: ${new Date(authorization.approvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : authorization?.status || "Authorized"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#64748B] pt-1 border-t border-[#DCE4ED]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D78] animate-pulse" />
                    <span>{medicalSummary.totalDocuments} consolidated medical documents</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#0F172A]">
                    {medicalSummary.confirmedPrescriptionsCount} Confirmed
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => scrollToSection("timeline")}
                  className="h-9 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#2F7D78] text-white hover:bg-[#256B66] font-semibold text-xs shadow-xs transition-colors w-full"
                >
                  <Clock className="w-4 h-4" />
                  <span>Medical Timeline</span>
                </button>
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => scrollToSection("biomarkers")}
                    className="h-9 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#0F172A] border border-[#DCE4ED] hover:bg-[#F7F9FB] font-semibold text-xs transition-colors flex-1"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#2F7D78]" />
                    <span>Vitals & Trends</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("documents")}
                    className="h-9 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#0F172A] border border-[#DCE4ED] hover:bg-[#F7F9FB] font-semibold text-xs transition-colors flex-1"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#2874B5]" />
                    <span>Docs ({safeDocs.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Comprehensive Demographic & Contact Information Strip */}
            <div className="mt-4 pt-4 border-t border-[#DCE4ED] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {/* Blood Group */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-[#64748B] flex items-center gap-1">
                  <Droplet className="w-3 h-3 text-[#DC2626] fill-[#DC2626]" />
                  <span>Blood Group</span>
                </span>
                <span className="font-bold text-[#DC2626] text-sm mt-0.5">
                  {patientBloodGroup || "Not Specified"}
                </span>
              </div>

              {/* Age & Sex */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-[#64748B] flex items-center gap-1">
                  <Activity className="w-3 h-3 text-[#2F7D78]" />
                  <span>Age & Sex</span>
                </span>
                <span className="font-semibold text-[#0F172A] mt-0.5">
                  {patientAge ? `${patientAge}` : "Age N/A"}{patientGender ? ` • ${patientGender}` : ""}
                </span>
              </div>

              {/* Contact Phone */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-[#64748B] flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#2874B5]" />
                  <span>Phone Number</span>
                </span>
                <span className="font-mono font-semibold text-[#0F172A] mt-0.5 truncate" title={patientPhone || undefined}>
                  {patientPhone ? `+91 ${patientPhone.replace(/^\+91\s*/, "")}` : "Not Recorded"}
                </span>
              </div>

              {/* Email Address */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-[#64748B] flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#64748B]" />
                  <span>Email</span>
                </span>
                <span className="font-medium text-[#0F172A] mt-0.5 truncate" title={patient.email || undefined}>
                  {patient.email || "Not Provided"}
                </span>
              </div>

              {/* Residential Location */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-[#64748B] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#64748B]" />
                  <span>Address / City</span>
                </span>
                <span className="font-medium text-[#0F172A] mt-0.5 truncate" title={patientAddress ? `${patientAddress}, ${patientCity || ""} ${patientState || ""} ${patientPincode || ""}` : undefined}>
                  {patientCity || patientAddress ? (
                    <span>
                      {patientAddress ? `${patientAddress}, ` : ""}
                      {patientCity ? `${patientCity.charAt(0).toUpperCase() + patientCity.slice(1)}` : ""}
                      {patientState ? `, ${patientState}` : ""}
                      {patientPincode ? ` (${patientPincode})` : ""}
                    </span>
                  ) : (
                    "Not Specified"
                  )}
                </span>
              </div>

              {/* Emergency Contact */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-[#64748B] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#D97706]" />
                  <span>Emergency Contact</span>
                </span>
                <div className="mt-0.5 truncate" title={emergencyContactName ? `${emergencyContactName} (${emergencyContactPhone || ""})` : undefined}>
                  {emergencyContactName ? (
                    <>
                      <span className="font-semibold text-[#0F172A] block truncate">{emergencyContactName}</span>
                      {emergencyContactPhone && (
                        <span className="text-[11px] font-mono text-[#64748B] block truncate">+91 {emergencyContactPhone.replace(/^\+91\s*/, "")}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[#94A3B8] italic">None Listed</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Critical Attention Alert Strip */}
          <section id="alerts" className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Allergy Flag Chip */}
            <div className="lg:col-span-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 flex items-start gap-3 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#92400E] flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#92400E]">
                    {structuredAllergies.length > 0 ? "ALLERGIES RECORDED" : "ALLERGY STATUS"}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-[#92400E] px-1.5 py-0.2 rounded bg-[#FEF3C7]">
                    {structuredAllergies.length > 0
                      ? `${structuredAllergies.length} ${structuredAllergies.length === 1 ? "Active Flag" : "Active Flags"}`
                      : "No Flags"}
                  </span>
                </div>
                <p className="text-xs text-[#0F172A] mt-0.5 leading-snug">
                  {structuredAllergies.length > 0 ? (
                    <span>
                      <strong className="text-[#DC2626]">Documented:</strong> {patientAllergiesSummary}
                    </span>
                  ) : (
                    <span className="text-[#64748B]">No specific allergies flagged in patient records.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Medication Variance / Discrepancy Flag Banner */}
            <div className="lg:col-span-8 bg-[#F7F9FB] border border-[#DCE4ED] rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    safeMedications.needsReview.length > 0
                      ? "bg-[#FEE2E2] text-[#DC2626]"
                      : "bg-[#E8F6F4] text-[#2F7D78]"
                  }`}
                >
                  {safeMedications.needsReview.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        safeMedications.needsReview.length > 0 ? "text-[#DC2626]" : "text-[#2F7D78]"
                      }`}
                    >
                      {safeMedications.needsReview.length > 0
                        ? `CLINICAL DISCREPANCY DETECTED (${safeMedications.needsReview.length})`
                        : "NO ACTIVE RECONCILIATION CONFLICTS"}
                    </span>
                    <span className="text-[11px] text-[#64748B]">Prescription Safety Check</span>
                  </div>
                  <p className="text-xs text-[#0F172A] leading-tight mt-0.5 truncate sm:whitespace-normal">
                    {safeMedications.needsReview.length > 0 ? (
                      <span>
                        Conflict: <strong className="font-semibold">{safeMedications.needsReview[0].name}</strong> —{" "}
                        {safeMedications.needsReview[0].conflict_details ||
                          safeMedications.needsReview[0].reconciliation_notes ||
                          safeMedications.needsReview[0].reconciliation_category ||
                          "Requires clinical review"}
                      </span>
                    ) : safeMedications.active.length > 0 ? (
                      <span>
                        All {safeMedications.active.length} active prescriptions currently align with recorded health profile.
                      </span>
                    ) : (
                      <span>
                        No prescription conflicts or dosage discrepancies detected on file.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {safeMedications.needsReview.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDiscrepancy(safeMedications.needsReview[0])}
                  className="px-2.5 py-1.5 rounded-lg bg-white text-[#DC2626] border border-[#FECACA] hover:bg-[#FEE2E2] text-xs font-semibold transition-colors shrink-0 self-end sm:self-center"
                >
                  Review Conflict
                </button>
              )}
            </div>
          </section>

          {/* SECTION 3: Rapid Diagnostic Snapshot */}
          <section id="diagnostic-snapshot" className="bg-white rounded-xl border border-[#DCE4ED] shadow-xs p-5 sm:p-6 flex flex-col gap-5">
            {/* Snapshot Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DCE4ED] gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E8F6F4] flex items-center justify-center text-[#2F7D78]">
                  <Stethoscope className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight leading-tight">
                    Rapid Diagnostic Snapshot
                  </h2>
                  <p className="text-xs text-[#64748B] leading-tight mt-0.5">
                    Key clinical findings synthesized from verified EHR, OCR extractions, and patient reports.
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#64748B] font-mono sm:text-right">
                Validated state • <span className="text-[#0F172A] font-semibold">{latestValidationDate}</span>
              </div>
            </div>

            {/* 3-Column Functional Groups */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Col 1: Active Conditions & Allergies (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                {/* Active Conditions */}
                <div className="bg-[#F7F9FB] rounded-xl p-4 border border-[#DCE4ED] flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-[#2F7D78]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                          Active Conditions
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#2F7D78] text-[11px] font-bold">
                        {structuredConditions.length} {structuredConditions.length === 1 ? "Active" : "Active"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {structuredConditions.length > 0 ? (
                        structuredConditions.map((cond) => (
                          <button
                            key={cond.id}
                            type="button"
                            onClick={() => setSelectedConditionForModal(cond)}
                            className="w-full text-left p-2.5 rounded-lg bg-white border border-[#DCE4ED] hover:border-[#2F7D78] hover:bg-[#F8FAFC] transition-all cursor-pointer shadow-2xs group flex items-start justify-between gap-2"
                            title="Click to view condition description and clinical details"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-[#0F172A] group-hover:text-[#2F7D78] transition-colors truncate">
                                  {cond.name}
                                </span>
                                <span className="text-[10px] font-mono text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.2 rounded shrink-0">
                                  {cond.category}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-[#2F7D78] mt-1 font-medium truncate">
                                <CheckCircle2 className="w-3 h-3 text-[#2F7D78] shrink-0" />
                                <span className="truncate">{cond.source}{cond.diagnosedDate ? ` • ${cond.diagnosedDate}` : ""}</span>
                              </div>
                            </div>
                            <div className="p-1 text-[#94A3B8] group-hover:text-[#2F7D78] transition-colors shrink-0 self-center">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-[#64748B] italic p-2">No chronic or diagnosed conditions declared.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#DCE4ED] flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Outpatient Profile</span>
                    <button
                      onClick={() => scrollToSection("biomarkers")}
                      className="text-[#2F7D78] font-bold hover:underline"
                    >
                      View Biomarkers →
                    </button>
                  </div>
                </div>

                {/* Allergies & Hypersensitivities */}
                <div className="bg-[#F7F9FB] rounded-xl p-4 border border-[#DCE4ED] flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-[#92400E]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#92400E]">
                          Allergies & Sensitivities
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-[11px] font-bold">
                        {structuredAllergies.length} {structuredAllergies.length === 1 ? "Flagged" : "Flags"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {structuredAllergies.length > 0 ? (
                        structuredAllergies.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setSelectedAllergyForModal(a)}
                            className="w-full text-left p-2.5 rounded-lg bg-white border border-[#FDE68A] hover:border-[#DC2626] hover:bg-[#FFF5F5] transition-all cursor-pointer shadow-2xs group flex items-start justify-between gap-2"
                            title="Click to view allergen description, reaction profile and precautions"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-[#DC2626] group-hover:text-[#B91C1C] transition-colors truncate">
                                  {a.name}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#FEE2E2] text-[#DC2626] font-semibold shrink-0">
                                  {a.severity}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#64748B] mt-1 leading-tight line-clamp-1">
                                {a.reaction}
                              </p>
                            </div>
                            <div className="p-1 text-[#FCA5A5] group-hover:text-[#DC2626] transition-colors shrink-0 self-center">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-[#64748B] italic p-2">No known allergies on record.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#DCE4ED] flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Safety Guardrails</span>
                    <span className="text-[#2F7D78] font-semibold">Clinical Records</span>
                  </div>
                </div>
              </div>

              {/* Col 2: Current Medications & Latest Clinical Event (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                {/* Current Medications */}
                <div className="bg-[#F7F9FB] rounded-xl p-4 border border-[#DCE4ED] flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Pill className="w-4 h-4 text-[#2874B5]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                          Current Medications
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#2F7D78] text-[11px] font-bold">
                        {safeMedications.active.length} Active
                      </span>
                    </div>

                    <div className="space-y-2">
                      {safeMedications.active.length > 0 ? (
                        (showAllMedications ? safeMedications.active : safeMedications.active.slice(0, 5)).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedMedicationForModal(m)}
                            className="w-full text-left p-2.5 rounded-lg bg-white border border-[#DCE4ED] hover:border-[#2F7D78] hover:bg-[#F8FAFC] transition-all cursor-pointer shadow-2xs group flex items-start justify-between gap-2"
                            title="Click to view medication pharmacology, indication and full description"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-[#0F172A] group-hover:text-[#2F7D78] transition-colors truncate">
                                  {m.name}
                                </span>
                                {m.frequency ? (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#E8F6F4] text-[#2F7D78] font-bold font-mono shrink-0">
                                    {m.frequency}
                                  </span>
                                ) : m.indication ? (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F1F5F9] text-[#64748B] font-medium shrink-0 truncate max-w-[120px]">
                                    {m.indication}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-[#64748B] mt-1 truncate">
                                {m.strength || ""} {m.route ? `• ${m.route}` : ""}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] mt-1 font-mono truncate">
                                <span>Prescriber: {formatDoctorName(m.doctor)}</span>
                              </div>
                            </div>
                            <div className="p-1 text-[#94A3B8] group-hover:text-[#2F7D78] transition-colors shrink-0 self-center">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-[#64748B] italic p-2">No active medications recorded.</p>
                      )}

                      {safeMedications.active.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllMedications((prev) => !prev)}
                          className="w-full py-1.5 px-3 text-xs font-semibold text-[#2F7D78] hover:text-[#256B66] bg-[#E8F6F4] hover:bg-[#D5EFEA] rounded-lg transition-colors text-center border border-[#A7E9DF] mt-2 flex items-center justify-center gap-1"
                        >
                          <span>
                            {showAllMedications
                              ? "Show Less (First 5 medicines)"
                              : `Show More (${safeMedications.active.length - 5} more active medicines)`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#DCE4ED] flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setIsMedicationsModalOpen(true)}
                      className="text-[#2F7D78] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <Pill className="w-3.5 h-3.5" />
                      <span>All Medications ({safeMedications.active.length})</span>
                    </button>
                    <Link
                      href="/patient/medicines"
                      target="_blank"
                      className="text-[#64748B] hover:text-[#0F172A] font-medium inline-flex items-center gap-1 text-[11px]"
                    >
                      <span>Medications Page ↗</span>
                    </Link>
                  </div>
                </div>

                {/* Latest Clinical Event */}
                <div className="bg-[#F7F9FB] rounded-xl p-4 border border-[#DCE4ED] flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#2F7D78]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                          Latest Clinical Event
                        </span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-[#2F7D78]" />
                    </div>

                    {latestEventDoc ? (
                      <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#2F7D78]">
                            {latestEventDoc.documentType || "Consultation Note"}
                          </span>
                          <span className="text-[10px] font-mono text-[#64748B]">
                            {new Date(latestEventDoc.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#0F172A] mt-1 truncate">
                          {latestEventDoc.originalName}
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          {formatHospitalName(latestEventDoc.structuredResult?.hospital)} • {formatDoctorName(latestEventDoc.structuredResult?.doctor)}
                        </p>
                        {latestEventDoc.summary && (
                          <div className="mt-2 text-xs text-[#0F172A] bg-[#F8FAFC] p-2 rounded leading-relaxed border border-[#E2E8F0] line-clamp-2">
                            &ldquo;{latestEventDoc.summary}&rdquo;
                          </div>
                        )}
                        <div className="mt-2.5 pt-2 border-t border-[#DCE4ED] flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDocForModal(latestEventDoc);
                              setDocModalTab("scan");
                            }}
                            className="text-xs font-semibold text-[#2F7D78] hover:text-[#256B66] hover:underline inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Original Prescription Scan</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#64748B] italic p-2">No clinical documents uploaded.</p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#DCE4ED] flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Encounter Log</span>
                    <button
                      onClick={() => scrollToSection("timeline")}
                      className="text-[#2F7D78] font-bold hover:underline"
                    >
                      Encounter Archive →
                    </button>
                  </div>
                </div>
              </div>

              {/* Col 3: Latest Clinical Measurements (Vitals & Labs) (4 cols) */}
              <div className="lg:col-span-4 bg-[#F7F9FB] rounded-xl p-4 border border-[#DCE4ED] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-[#2F7D78]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                        Latest Clinical Measurements
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[#64748B]">Vitals & Labs</span>
                  </div>

                  {/* Structured Measurements 2-Col Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Blood Pressure */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        Blood Pressure
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestBp?.systolic && latestBp?.diastolic ? (
                          <span>
                            {latestBp.systolic}/{latestBp.diastolic}{" "}
                            <span className="text-xs font-normal text-[#64748B]">mmHg</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">Not recorded</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#2F7D78] font-medium mt-0.5">
                        {latestBp?.obs_date
                          ? latestBp.obs_date
                          : latestBp?.systolic
                          ? "Recorded"
                          : "Target < 130/80 mmHg"}
                      </div>
                    </div>

                    {/* Heart Rate */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        Heart Rate
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestHr?.value != null ? (
                          <span>
                            {latestHr.value}{" "}
                            <span className="text-xs font-normal text-[#64748B]">bpm</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">Not recorded</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#2F7D78] font-medium mt-0.5">
                        {latestHr?.value != null
                          ? latestHr.value >= 60 && latestHr.value <= 100
                            ? `Regular rhythm${latestHr.obs_date ? ` • ${latestHr.obs_date}` : ""}`
                            : latestHr.value > 100
                            ? `Tachycardia${latestHr.obs_date ? ` • ${latestHr.obs_date}` : ""}`
                            : `Bradycardia${latestHr.obs_date ? ` • ${latestHr.obs_date}` : ""}`
                          : "Target 60-100 bpm"}
                      </div>
                    </div>

                    {/* Oxygen SpO2 */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        SpO2 (Oxygen)
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestSpo2?.value != null ? (
                          <span>{latestSpo2.value}%</span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">Not recorded</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">
                        {latestSpo2?.value != null
                          ? latestSpo2.value >= 95
                            ? `Normal room air${latestSpo2.obs_date ? ` • ${latestSpo2.obs_date}` : ""}`
                            : `Low saturation${latestSpo2.obs_date ? ` • ${latestSpo2.obs_date}` : ""}`
                          : "Target ≥ 95%"}
                      </div>
                    </div>

                    {/* BMI */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        BMI / Mass
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {calculatedBmi != null ? (
                          <span>{calculatedBmi}</span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">Not recorded</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">
                        {latestBmi?.obs_date
                          ? latestBmi.obs_date
                          : latestWeight?.value != null
                          ? `${latestWeight.value} kg${parsedHeightM ? ` • ${(parsedHeightM * 100).toFixed(0)} cm` : ""}${latestWeight.obs_date ? ` • ${latestWeight.obs_date}` : ""}`
                          : "Target 18.5 - 24.9"}
                      </div>
                    </div>

                    {/* HbA1c Glycated */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        HbA1c Glycated
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestHba1c?.value != null ? (
                          <span>{latestHba1c.value}%</span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">Not recorded</span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] font-medium mt-0.5 ${
                          latestHba1c?.value != null
                            ? Number(latestHba1c.value) > 7.0
                              ? "text-[#92400E]"
                              : "text-[#2F7D78]"
                            : "text-[#64748B]"
                        }`}
                      >
                        {latestHba1c?.value != null
                          ? Number(latestHba1c.value) > 7.0
                            ? `Above target (>7.0%)${latestHba1c.obs_date ? ` • ${latestHba1c.obs_date}` : ""}`
                            : `Optimal control (<7.0%)${latestHba1c.obs_date ? ` • ${latestHba1c.obs_date}` : ""}`
                          : "Target < 7.0%"}
                      </div>
                    </div>

                    {/* Fasting Glucose */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        Fasting Glucose
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestGlucose?.value != null ? (
                          <span>
                            {latestGlucose.value}{" "}
                            <span className="text-xs font-normal text-[#64748B]">mg/dL</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">Not recorded</span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] font-medium mt-0.5 ${
                          latestGlucose?.value != null
                            ? Number(latestGlucose.value) > 130
                              ? "text-[#92400E]"
                              : Number(latestGlucose.value) < 70
                              ? "text-[#DC2626]"
                              : "text-[#2F7D78]"
                            : "text-[#64748B]"
                        }`}
                      >
                        {latestGlucose?.value != null
                          ? Number(latestGlucose.value) > 130
                            ? `Above target (>130)${latestGlucose.obs_date ? ` • ${latestGlucose.obs_date}` : ""}`
                            : Number(latestGlucose.value) < 70
                            ? `Low glucose alert${latestGlucose.obs_date ? ` • ${latestGlucose.obs_date}` : ""}`
                            : `Within target range${latestGlucose.obs_date ? ` • ${latestGlucose.obs_date}` : ""}`
                          : "Target 70-130 mg/dL"}
                      </div>
                    </div>
                  </div>

                  {/* Serum Creatinine full row */}
                  <div className="mt-2.5 p-2.5 rounded-lg bg-white border border-[#DCE4ED] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        Serum Creatinine
                      </span>
                      <span className="text-xs font-bold text-[#0F172A]">
                        {latestCreatinine?.value != null ? (
                          `${latestCreatinine.value} mg/dL`
                        ) : (
                          <span className="text-xs text-[#94A3B8]">Not recorded</span>
                        )}
                      </span>
                    </div>
                    <div className="text-right">
                      {latestCreatinine?.value != null ? (
                        <>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              Number(latestCreatinine.value) <= 1.2
                                ? "bg-[#E8F6F4] text-[#2F7D78]"
                                : "bg-[#FEF3C7] text-[#92400E]"
                            }`}
                          >
                            {Number(latestCreatinine.value) <= 1.2 ? "Normal" : "Elevated"}
                          </span>
                          <span className="text-[10px] text-[#64748B] block mt-0.5">
                            {latestCreatinine.obs_date || "Lab result"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-medium">
                            No Lab Data
                          </span>
                          <span className="text-[10px] text-[#64748B] block mt-0.5">
                            Normal: 0.6 - 1.2 mg/dL
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#DCE4ED] flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium flex items-center gap-1">
                    {safeObs.length > 0 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D78]" />
                        <span>
                          {safeObs.length} Recorded Observation
                          {safeObs.length > 1 ? "s" : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span className="text-[#94A3B8]">No clinical observations logged</span>
                      </>
                    )}
                  </span>
                  <button
                    onClick={() => scrollToSection("biomarkers")}
                    className="text-[#2F7D78] font-bold hover:underline"
                  >
                    Trend Analysis →
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: LONGITUDINAL HEALTH TRENDS & RISK PREDICTION (Full Width) */}
          <section id="biomarkers" className="bg-transparent space-y-6">
            <LongitudinalTrendsDashboard
              patientId={cleanPatientId}
              patientName={patient?.name}
              documents={safeDocs}
              isDoctorView={true}
              onViewDocScan={(doc) => {
                setSelectedDocForModal(doc);
                setDocModalTab("scan");
              }}
            />
          </section>

          {/* SECTION 5: TWO-COLUMN DEEP-DIVE (Timeline 8 cols vs Documents 4 cols) */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (8 cols): Medical Timeline */}
            <div className="lg:col-span-8 flex flex-col gap-6">

              {/* Chronological Medical Timeline with Filters */}
              <div id="timeline" className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4ED] shadow-xs flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">
                      Medical Timeline & Encounters
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Federated audit log across hospital visits, diagnostic labs & extracted prescriptions
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1 text-xs bg-[#F1F5F9] p-1 rounded-lg border border-[#DCE4ED]">
                    {(["ALL", "PRESCRIPTION", "LAB", "CONSULT"] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setTimelineFilter(filter)}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          timelineFilter === filter
                            ? "bg-white text-[#2F7D78] font-bold shadow-xs"
                            : "text-[#64748B] hover:text-[#0F172A]"
                        }`}
                      >
                        {filter === "ALL"
                          ? `All (${timelineCounts.ALL})`
                          : `${filter.charAt(0) + filter.slice(1).toLowerCase()} (${timelineCounts[filter]})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical Stepper Timeline */}
                {filteredTimelineDocs.length > 0 ? (
                  <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#DCE4ED]">
                    {filteredTimelineDocs.map((doc, idx) => (
                      <div key={doc.id || idx} className="relative flex flex-col gap-1.5">
                        <div
                          className={`absolute -left-6 top-1 w-4 h-4 rounded-full ring-4 ring-white ${
                            !doc.isDraft ? "bg-[#2F7D78]" : "bg-[#2874B5]"
                          }`}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0F172A]">{doc.originalName}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                !doc.isDraft
                                  ? "bg-[#E8F6F4] text-[#2F7D78] border border-[#A7E9DF]"
                                  : "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                              }`}
                            >
                              {doc.clinicalVerification || (!doc.isDraft ? "Clinician Confirmed" : "OCR Extraction")}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-[#64748B]">
                            {new Date(doc.uploadedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-[#F7F9FB] border border-[#DCE4ED] flex flex-col gap-1.5 text-xs">
                          <div className="flex items-center gap-2 text-[#0F172A]">
                            <strong className="font-semibold">
                              {formatDoctorName(doc.structuredResult?.doctor)}
                            </strong>
                            <span className="text-[#94A3B8]">•</span>
                            <span className="text-[#64748B]">
                              {formatHospitalName(doc.structuredResult?.hospital)}
                            </span>
                          </div>
                          {doc.summary && (
                            <p className="text-[#334155] leading-relaxed">
                              {doc.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-[#2F7D78]">
                            <button
                              type="button"
                              onClick={() => setSelectedDocForModal(doc)}
                              className="font-semibold hover:underline inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Document Record</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B] italic py-4">No events found matching this filter.</p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN (4 cols): Consolidated Documents */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Consolidated Documents Card */}
              <div id="documents" className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2874B5]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">Consolidated Documents</h3>
                  </div>
                  <span className="text-xs font-mono text-[#64748B]">
                    {safeDocs.length} Files
                  </span>
                </div>

                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                  {safeDocs.length > 0 ? (
                    (showAllDocs ? safeDocs : safeDocs.slice(0, 5)).map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-lg bg-[#F7F9FB] hover:bg-[#F1F5F9] transition-colors border border-[#DCE4ED] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded bg-white text-[#2874B5] border border-[#DCE4ED] flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-[#0F172A] truncate">
                              {doc.originalName}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-mono">
                              <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                              <span>•</span>
                              <span className={!doc.isDraft ? "text-[#2F7D78] font-semibold" : "text-[#92400E]"}>
                                {doc.clinicalVerification || (!doc.isDraft ? "Confirmed" : "OCR Draft")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDocForModal(doc);
                            setDocModalTab("scan");
                          }}
                          className="p-1 text-[#64748B] hover:text-[#2F7D78] transition-colors cursor-pointer"
                          title="View Document & Scan"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#64748B] italic p-3">No documents uploaded yet.</p>
                  )}

                  {safeDocs.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDocs((prev) => !prev)}
                      className="w-full py-2 px-3 text-xs font-semibold text-[#2874B5] hover:text-[#1E5C94] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-colors text-center border border-[#DCE4ED] mt-2 flex items-center justify-center gap-1"
                    >
                      <span>
                        {showAllDocs
                          ? "Show Less (First 5 files)"
                          : `Show More (${safeDocs.length - 5} more files)`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ==========================================
          4. DOCUMENT PREVIEW MODAL (WITH SUPABASE SCAN)
          ========================================== */}
      {selectedDocForModal && (() => {
        const prescriptionImgUrl = getPrescriptionImageUrl(selectedDocForModal);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 border border-[#DCE4ED] shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#DCE4ED] pb-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-[#0F172A] truncate">
                      {selectedDocForModal.originalName}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-[#64748B] font-mono">
                      <span>{selectedDocForModal.uploadedAt ? new Date(selectedDocForModal.uploadedAt).toLocaleDateString() : ""}</span>
                      <span>•</span>
                      <span className={!selectedDocForModal.isDraft ? "text-[#2F7D78] font-semibold" : "text-[#92400E]"}>
                        {selectedDocForModal.clinicalVerification}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDocForModal(null)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg border border-[#DCE4ED] shrink-0">
                <button
                  type="button"
                  onClick={() => setDocModalTab("scan")}
                  className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    docModalTab === "scan"
                      ? "bg-white text-[#2F7D78] shadow-xs"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Original Prescription Scan</span>
                  {prescriptionImgUrl && (
                    <span className="w-2 h-2 rounded-full bg-[#2F7D78]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDocModalTab("details")}
                  className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    docModalTab === "details"
                      ? "bg-white text-[#2F7D78] shadow-xs"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Clinical Summary & Details</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                {docModalTab === "scan" ? (
                  <div className="space-y-3">
                    {prescriptionImgUrl ? (
                      <div className="border border-[#DCE4ED] rounded-xl overflow-hidden bg-neutral-900/5 flex flex-col">
                        <div className="w-full max-h-[460px] overflow-auto flex items-center justify-center p-3 bg-white">
                          <img
                            src={prescriptionImgUrl}
                            alt={selectedDocForModal.originalName || "Original Prescription Scan"}
                            className="max-h-[420px] w-auto object-contain rounded shadow-xs"
                          />
                        </div>
                        <div className="px-3 py-2 bg-[#F8FAFC] border-t border-[#DCE4ED] flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[#64748B] font-mono text-[11px] truncate max-w-sm">
                            Supabase Storage: {selectedDocForModal.storedFilename || selectedDocForModal.originalName}
                          </span>
                          <a
                            href={prescriptionImgUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#2F7D78] hover:text-[#256B66] font-semibold inline-flex items-center gap-1 hover:underline text-xs"
                          >
                            <span>Open High-Res Scan</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-[#F7F9FB] rounded-xl border border-dashed border-[#DCE4ED] space-y-2">
                        <FileText className="w-10 h-10 text-[#94A3B8] mx-auto" />
                        <h4 className="text-sm font-bold text-[#0F172A]">No Image Scan Attached</h4>
                        <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                          This document was recorded directly through clinical EHR note entry without an uploaded scanned artifact.
                        </p>
                      </div>
                    )}

                    {/* Metadata Summary Pill Matrix */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-[#F7F9FB] rounded-xl border border-[#DCE4ED] text-xs">
                      <div>
                        <span className="text-[#64748B] block text-[10px] uppercase font-bold">Facility / Clinic</span>
                        <span className="text-[#0F172A] font-semibold truncate block">
                          {formatHospitalName(selectedDocForModal.structuredResult?.hospital)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[10px] uppercase font-bold">Physician</span>
                        <span className="text-[#0F172A] font-semibold truncate block">
                          {formatDoctorName(selectedDocForModal.structuredResult?.doctor)}
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[#64748B] block text-[10px] uppercase font-bold">Record Status</span>
                        <span className={!selectedDocForModal.isDraft ? "text-[#2F7D78] font-bold" : "text-[#92400E] font-bold"}>
                          {selectedDocForModal.clinicalVerification}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-[#F7F9FB] rounded-xl border border-[#DCE4ED] space-y-2 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Document Status:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            !selectedDocForModal.isDraft
                              ? "bg-[#E8F6F4] text-[#2F7D78]"
                              : "bg-[#FEF3C7] text-[#92400E]"
                          }`}
                        >
                          {selectedDocForModal.clinicalVerification}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Upload Timestamp:</span>
                        <span className="text-[#0F172A]">
                          {selectedDocForModal.uploadedAt ? new Date(selectedDocForModal.uploadedAt).toLocaleString() : "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-sans">
                        <span className="text-[#64748B]">Facility / Clinic:</span>
                        <span className="font-semibold text-[#0F172A]">{formatHospitalName(selectedDocForModal.structuredResult?.hospital)}</span>
                      </div>
                      {selectedDocForModal.structuredResult?.doctor ? (
                        <div className="flex items-center justify-between font-sans">
                          <span className="text-[#64748B]">Physician:</span>
                          <span className="font-semibold text-[#0F172A]">{formatDoctorName(selectedDocForModal.structuredResult?.doctor)}</span>
                        </div>
                      ) : null}
                    </div>

                    {selectedDocForModal.summary && (
                      <div className="p-3.5 bg-[#F7F9FB] rounded-xl border border-[#DCE4ED] text-[#334155] leading-relaxed">
                        <span className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                          Structured Clinical Summary
                        </span>
                        {selectedDocForModal.summary}
                      </div>
                    )}

                    {Array.isArray(selectedDocForModal.structuredResult?.medicines) &&
                      selectedDocForModal.structuredResult.medicines.length > 0 && (
                        <div className="p-3 bg-white rounded-xl border border-[#DCE4ED] space-y-2">
                          <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                            Prescribed Medicines in Document ({selectedDocForModal.structuredResult.medicines.length})
                          </span>
                          <div className="space-y-1.5">
                            {selectedDocForModal.structuredResult.medicines.map((med, idx) => {
                              const medName = typeof med.name === "object" ? med.name?.val : med.name;
                              const medStrength = typeof med.strength === "object" ? med.strength?.val : med.strength;
                              const medFreq = typeof med.frequency === "object" ? med.frequency?.val : med.frequency;
                              return (
                                <div key={idx} className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs">
                                  <span className="font-bold text-[#0F172A]">{medName || "Medication"}</span>
                                  <span className="text-[11px] text-[#64748B] font-mono">
                                    {medStrength || ""} {medFreq ? `• ${medFreq}` : ""}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-[#DCE4ED] flex items-center justify-between shrink-0">
                {prescriptionImgUrl ? (
                  <a
                    href={prescriptionImgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 border border-[#DCE4ED] hover:bg-[#F1F5F9] text-[#0F172A] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Scan in New Window</span>
                  </a>
                ) : <div />}
                <button
                  type="button"
                  onClick={() => setSelectedDocForModal(null)}
                  className="px-4 py-2 bg-[#2F7D78] text-white rounded-lg text-xs font-semibold hover:bg-[#256B66] transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==========================================
          5. ALL ACTIVE MEDICATIONS MODAL
          ========================================== */}
      {isMedicationsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 border border-[#DCE4ED] shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#DCE4ED] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center">
                  <Pill className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">All Active Medications</h3>
                  <p className="text-xs text-[#64748B]">
                    Complete list of ongoing prescriptions for {patient?.name || "Patient"} ({safeMedications.active.length} total)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMedicationsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-2.5">
              {safeMedications.active.length > 0 ? (
                safeMedications.active.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMedicationForModal(m)}
                    className="p-3.5 rounded-xl bg-[#F7F9FB] border border-[#DCE4ED] hover:border-[#2F7D78] hover:bg-white cursor-pointer transition-all flex flex-col gap-2 group shadow-2xs"
                    title="Click to view full medication pharmacology, indications, and description"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#0F172A] group-hover:text-[#2F7D78] transition-colors">{m.name}</span>
                        {m.strength && (
                          <span className="text-[11px] font-mono text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#DCE4ED]">
                            {m.strength}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F6F4] text-[#2F7D78]">
                          Active
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#2F7D78] transition-colors" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-[#64748B] pt-1">
                      <div>
                        <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Frequency</span>
                        <span className="text-[#0F172A] font-medium">{m.frequency || "As prescribed"}</span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Route</span>
                        <span className="text-[#0F172A] font-medium">{m.route || "Oral"}</span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Prescriber</span>
                        <span className="text-[#0F172A] font-medium truncate block">{formatDoctorName(m.doctor)}</span>
                      </div>
                      {m.start_date && (
                        <div>
                          <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Start Date</span>
                          <span className="text-[#0F172A] font-medium">{m.start_date}</span>
                        </div>
                      )}
                      {m.indication && (
                        <div className="col-span-2">
                          <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Indication</span>
                          <span className="text-[#334155]">{m.indication}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#64748B] italic p-4 text-center">No active medications registered.</p>
              )}
            </div>

            <div className="pt-2 border-t border-[#DCE4ED] flex items-center justify-between shrink-0">
              <Link
                href="/patient/medicines"
                target="_blank"
                className="px-3 py-1.5 border border-[#DCE4ED] hover:bg-[#F1F5F9] text-[#0F172A] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Full Medications Management Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setIsMedicationsModalOpen(false)}
                className="px-4 py-2 bg-[#2F7D78] text-white rounded-lg text-xs font-semibold hover:bg-[#256B66] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          5. DISCREPANCY RECONCILIATION MODAL
          ========================================== */}
      {selectedDiscrepancy && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#DCE4ED] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE4ED] pb-3">
              <div className="flex items-center gap-2 text-[#DC2626]">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-sm text-[#0F172A]">Clinical Medication Discrepancy</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDiscrepancy(null)}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#FEF2F2] rounded-xl border border-[#FECACA]">
                <span className="font-bold text-[#DC2626] block text-sm">{selectedDiscrepancy.name}</span>
                {selectedDiscrepancy.reconciliation_category && (
                  <span className="text-[11px] font-mono text-[#991B1B]">Category: {selectedDiscrepancy.reconciliation_category}</span>
                )}
                <p className="text-[#7F1D1D] mt-2 leading-relaxed">
                  {selectedDiscrepancy.conflict_details || selectedDiscrepancy.reconciliation_notes || "Conflicting dosage or frequency detected between source records."}
                </p>
              </div>
              <p className="text-[#64748B] leading-relaxed">
                As attending practitioner, verify the patient&apos;s current active regimen and instruct hospital pharmacy accordingly.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDiscrepancy(null)}
                className="px-4 py-2 bg-[#2F7D78] text-white rounded-lg text-xs font-semibold hover:bg-[#256B66]"
              >
                Acknowledge Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          6. ACTIVE CONDITION DESCRIPTION MODAL
          ========================================== */}
      {selectedConditionForModal && (() => {
        const cond = selectedConditionForModal;
        const desc = getConditionDescription(cond.name, cond.notes);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 border border-[#DCE4ED] shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-start justify-between border-b border-[#DCE4ED] pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center shrink-0 border border-[#A7E9DF]">
                    <Activity className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-[#0F172A]">{cond.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F6F4] text-[#2F7D78] border border-[#A7E9DF]">
                        {cond.status || "Active"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0]">
                        {cond.category || "Clinical"}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Clinical Condition Profile & Diagnostic Description
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedConditionForModal(null)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] block">
                    Clinical Overview & Description
                  </span>
                  <p className="text-xs text-[#1E293B] leading-relaxed">
                    {desc.overview}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Clinical Status</span>
                    <span className="text-xs font-bold text-[#0F172A] mt-0.5 block">{cond.status || "Active"}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Category / Type</span>
                    <span className="text-xs font-bold text-[#0F172A] mt-0.5 block">{cond.category || "Condition"}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Diagnosis Source</span>
                    <span className="text-xs font-semibold text-[#0F172A] mt-0.5 block">{cond.source}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Documented Date</span>
                    <span className="text-xs font-mono font-medium text-[#0F172A] mt-0.5 block">
                      {cond.diagnosedDate || "Present in patient medical dossier"}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#E8F6F4]/50 border border-[#A7E9DF] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#2F7D78] block">
                    Clinical Guideline Impact & Progression
                  </span>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {desc.clinicalImpact}
                  </p>
                  <p className="text-xs text-[#2F7D78] font-medium pt-1.5 border-t border-[#A7E9DF]/60">
                    <strong>Care Management Protocol:</strong> {desc.management}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#DCE4ED] flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedConditionForModal(null)}
                  className="px-4 py-2 bg-[#2F7D78] text-white rounded-xl text-xs font-semibold hover:bg-[#256B66] transition-colors"
                >
                  Close Description
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==========================================
          7. ALLERGY DESCRIPTION MODAL
          ========================================== */}
      {selectedAllergyForModal && (() => {
        const allergy = selectedAllergyForModal;
        const desc = getAllergyDescription(allergy.name, allergy.reaction);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 border border-[#FECACA] shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-start justify-between border-b border-[#FECACA] pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0 border border-[#FCA5A5]">
                    <AlertCircle className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-[#991B1B]">{allergy.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
                        {allergy.severity || "Active Flag"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-[#991B1B] bg-[#FFF5F5] border border-[#FED7D7]">
                        {allergy.status || "Confirmed"}
                      </span>
                    </div>
                    <p className="text-xs text-[#7F1D1D] mt-0.5">
                      Documented Patient Allergen & Hypersensitivity Flag
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAllergyForModal(null)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#DC2626] block">
                    Documented Allergic Reaction
                  </span>
                  <p className="text-xs font-semibold text-[#7F1D1D] leading-snug">
                    {allergy.reaction || "Adverse allergic / hypersensitivity reaction"}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#92400E] block">
                      Allergen Classification
                    </span>
                    <p className="text-xs text-[#78350F] font-semibold mt-0.5">
                      {desc.allergenClass}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#92400E] block">
                      Reaction Manifestation & Pathophysiology
                    </span>
                    <p className="text-xs text-[#78350F] leading-relaxed mt-0.5">
                      {desc.reactionProfile}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Severity Rating</span>
                    <span className="text-xs font-bold text-[#DC2626] mt-0.5 block">{allergy.severity}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Source Record</span>
                    <span className="text-xs font-semibold text-[#0F172A] mt-0.5 block">{allergy.source}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Prescription Safety Advisory</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {desc.precautions}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#FECACA] flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedAllergyForModal(null)}
                  className="px-4 py-2 bg-[#DC2626] text-white rounded-xl text-xs font-semibold hover:bg-[#B91C1C] transition-colors"
                >
                  Close Description
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==========================================
          8. MEDICATION DESCRIPTION MODAL
          ========================================== */}
      {selectedMedicationForModal && (() => {
        const med = selectedMedicationForModal;
        const desc = getMedicationDescription(med.name, med.indication);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 border border-[#DCE4ED] shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-start justify-between border-b border-[#DCE4ED] pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center shrink-0 border border-[#A7E9DF]">
                    <Pill className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-[#0F172A]">{med.name}</h3>
                      {med.strength && (
                        <span className="text-[11px] font-mono text-[#2F7D78] bg-[#E8F6F4] px-2 py-0.5 rounded border border-[#A7E9DF] font-bold">
                          {med.strength}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F6F4] text-[#2F7D78]">
                        {med.status || "Active"}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Pharmacological Classification & Regimen Profile
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMedicationForModal(null)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#64748B] block">Therapeutic Class</span>
                    <span className="text-xs font-bold text-[#0F172A]">{desc.drugClass}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#64748B] block">Mechanism of Action & Clinical Description</span>
                    <p className="text-xs text-[#334155] leading-relaxed mt-0.5">{desc.mechanism}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#64748B] block">Therapeutic Indication</span>
                    <p className="text-xs text-[#2F7D78] font-semibold leading-relaxed mt-0.5">{desc.indications}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Frequency / Timing</span>
                    <span className="text-xs font-bold text-[#0F172A] font-mono mt-0.5 block">{med.frequency || "As prescribed"}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Route & Form</span>
                    <span className="text-xs font-semibold text-[#0F172A] mt-0.5 block">{med.route || "Oral"} {med.form ? `(${med.form})` : ""}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#DCE4ED]">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Prescriber</span>
                    <span className="text-xs font-semibold text-[#0F172A] mt-0.5 block truncate">{formatDoctorName(med.doctor)}</span>
                  </div>
                  {med.start_date && (
                    <div className="p-2.5 rounded-xl bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Start Date</span>
                      <span className="text-xs font-mono text-[#0F172A] mt-0.5 block">{med.start_date}</span>
                    </div>
                  )}
                  {med.duration_raw && (
                    <div className="p-2.5 rounded-xl bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Duration</span>
                      <span className="text-xs font-semibold text-[#0F172A] mt-0.5 block">{med.duration_raw}</span>
                    </div>
                  )}
                  {med.hospital && (
                    <div className="p-2.5 rounded-xl bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Facility</span>
                      <span className="text-xs font-semibold text-[#0F172A] mt-0.5 block truncate">{formatHospitalName(med.hospital)}</span>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-1">
                  <div className="flex items-center gap-1.5 text-[#92400E] font-bold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Clinical Precautions & Guidance</span>
                  </div>
                  <p className="text-[11px] text-[#78350F] leading-relaxed">
                    {desc.precautions}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#DCE4ED] flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedMedicationForModal(null)}
                  className="px-4 py-2 bg-[#2F7D78] text-white rounded-xl text-xs font-semibold hover:bg-[#256B66] transition-colors"
                >
                  Close Description
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

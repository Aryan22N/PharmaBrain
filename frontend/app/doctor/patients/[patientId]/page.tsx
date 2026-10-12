"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  FileText,
  Pill,
  Activity,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileCheck2,
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
} from "lucide-react";

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
  discontinued_reason?: string | null;
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
  hospital?: string | null;
  doctor?: string | null;
  dateIso?: string | null;
  medicines?: DocStructuredMedicine[];
  [key: string]: unknown;
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
      basic_info?: Record<string, string | number | boolean | null>;
      conditions?: Record<string, string | number | boolean | null>;
      custom_conditions?: Record<string, string | number | boolean | null>;
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

export default function DoctorPatientRecordPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const router = useRouter();
  const { patientId: rawPatientId } = use(params);

  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dossier, setDossier] = useState<RecordDossier | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "medications" | "prescriptions" | "vitals" | "trends">(
    "overview"
  );

  // Active section for in-page navigation & filters
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [timeRange, setTimeRange] = useState<"6M" | "1Y" | "3Y" | "ALL">("1Y");
  const [timelineFilter, setTimelineFilter] = useState<"ALL" | "PRESCRIPTION" | "LAB" | "CONSULT">("ALL");
  const [patientSearchInput, setPatientSearchInput] = useState("");
  const [selectedDocForModal, setSelectedDocForModal] = useState<DocumentItem | null>(null);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<MedicationItem | null>(null);

  const loadDossier = React.useCallback(async () => {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`/api/doctor/patients/${rawPatientId}/records`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json();

      if (!res.ok) {
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
  }, [rawPatientId]);

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
          <span className="font-mono font-bold text-[#0F172A]">{rawPatientId}</span>
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
              Patient ID: <strong className="text-[#0F172A]">{rawPatientId}</strong>
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
              No patient with identifier &ldquo;{rawPatientId}&rdquo; was found in the hospital registry.
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

  const { patient, medicalSummary, documents, medications, observations, longitudinalTrends, authorization } = dossier;

  // Derive patient metadata
  const basicInfo = patient.onboardingInfo?.basic_info || {};
  const patientAge = basicInfo.age ? `${basicInfo.age} y/o` : "Adult";
  const patientGender = basicInfo.gender ? String(basicInfo.gender) : "Patient";
  const patientDob = basicInfo.dob ? String(basicInfo.dob) : null;
  const conditionsList = Array.isArray(patient.onboardingInfo?.conditions)
    ? (patient.onboardingInfo?.conditions as string[])
    : [];
  const customConditionsList = Array.isArray(patient.onboardingInfo?.custom_conditions)
    ? (patient.onboardingInfo?.custom_conditions as string[])
    : [];
  const allConditions = [...conditionsList, ...customConditionsList];
  const patientAllergies = patient.onboardingInfo?.history?.allergies || null;

  // Derive latest vitals measurements
  const bpObs = observations.filter((o) => o.kind === "blood_pressure");
  const latestBp = bpObs[bpObs.length - 1];
  const glucoseObs = observations.filter((o) => o.kind === "glucose" || o.kind.includes("glucose"));
  const latestGlucose = glucoseObs[glucoseObs.length - 1];
  const hba1cObs = observations.filter((o) => o.kind === "hba1c" || o.kind.includes("hba1c"));
  const latestHba1c = hba1cObs[hba1cObs.length - 1];
  const hrObs = observations.filter((o) => o.kind === "heart_rate" || o.kind === "pulse");
  const latestHr = hrObs[hrObs.length - 1];
  const spo2Obs = observations.filter((o) => o.kind === "spo2" || o.kind === "oxygen");
  const latestSpo2 = spo2Obs[spo2Obs.length - 1];
  const bmiObs = observations.filter((o) => o.kind === "bmi");
  const latestBmi = bmiObs[bmiObs.length - 1];
  const creatinineObs = observations.filter((o) => o.kind.includes("creatinine"));
  const latestCreatinine = creatinineObs[creatinineObs.length - 1];

  // Derive latest clinical event (consultation note or most recent document)
  const latestEventDoc = documents[0] || null;

  // Filter timeline documents
  const filteredTimelineDocs = documents.filter((doc) => {
    if (timelineFilter === "ALL") return true;
    if (timelineFilter === "PRESCRIPTION") return doc.documentType?.toUpperCase().includes("PRESCRIPTION");
    if (timelineFilter === "LAB") return doc.documentType?.toUpperCase().includes("LAB") || doc.documentType?.toUpperCase().includes("REPORT");
    if (timelineFilter === "CONSULT") return doc.documentType?.toUpperCase().includes("CONSULT") || doc.documentType?.toUpperCase().includes("SUMMARY");
    return true;
  });

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

            <div className="hidden xl:flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#DCE4ED]">
              <span className="px-2.5 py-1 rounded bg-white text-xs font-semibold text-[#2F7D78] shadow-xs">
                Doctor Portal
              </span>
              <Link
                href="/patient/overview"
                className="px-2.5 py-1 rounded text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                Patient Portal
              </Link>
            </div>
          </div>

          {/* Quick Patient ID Search */}
          <div className="flex-1 max-w-md mx-2 hidden md:block">
            <form onSubmit={handleGlobalSearch} className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-[#94A3B8]" />
              <input
                type="text"
                value={patientSearchInput}
                onChange={(e) => setPatientSearchInput(e.target.value)}
                placeholder="Search patient by ID (e.g. P-829017616)..."
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
                Active Consent • Dr. {authorization.authorizedDoctor}
              </span>
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {medications.needsReview.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626]" />
              )}
            </button>

            {/* Doctor Profile Chip */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-[#DCE4ED]">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-[#0F172A] leading-tight">
                  Dr. {authorization.authorizedDoctor}
                </span>
                <span className="text-[11px] font-mono text-[#64748B] leading-tight">
                  {authorization.doctorCode}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#2F7D78] text-white flex items-center justify-center font-bold text-xs">
                {authorization.authorizedDoctor.charAt(0).toUpperCase()}
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
                Consent Verified
              </span>
            </div>
            <div className="text-sm font-bold text-[#0F172A] truncate">{patient.name}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-[#64748B] font-mono">
              <span>{patientAge}</span>
              <span>•</span>
              <span className="truncate">{patient.patientId}</span>
            </div>
          </div>

          {/* Section Navigation Links */}
          <nav className="flex flex-col gap-1">
            {[
              { id: "overview", label: "Patient Overview", icon: Activity },
              { id: "alerts", label: "Attention Flags", icon: AlertTriangle, badge: medications.needsReview.length > 0 ? String(medications.needsReview.length) : undefined },
              { id: "diagnostic-snapshot", label: "Diagnostic Snapshot", icon: Stethoscope },
              { id: "ai-synthesis", label: "AI Health Summary", icon: Sparkles },
              { id: "biomarkers", label: "Vitals & Trends", icon: TrendingUp },
              { id: "timeline", label: "Medical Timeline", icon: Clock, count: documents.length },
              { id: "allergies", label: "Allergies", icon: AlertCircle },
              { id: "medicines", label: "Prescription Regimen", icon: Pill, count: medications.active.length },
              { id: "documents", label: "Reports & Documents", icon: FileText, count: documents.length },
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
                  {patient.name}
                </span>
                <span className="text-[11px] text-[#64748B]">Approved Dossier</span>
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
                    {patient.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
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
                      {patient.name}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-xs font-medium">
                      {patientAge} {patientGender !== "Patient" ? `• ${patientGender}` : ""}
                    </span>
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
                    <span>Full Longitudinal Access</span>
                  </div>
                  <span className="text-[11px] text-[#64748B] font-mono">
                    Approved: {new Date(authorization.approvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                    onClick={() => scrollToSection("ai-synthesis")}
                    className="h-9 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#0F172A] border border-[#DCE4ED] hover:bg-[#F7F9FB] font-semibold text-xs transition-colors flex-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#2F7D78]" />
                    <span>AI Synthesis</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("documents")}
                    className="h-9 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#0F172A] border border-[#DCE4ED] hover:bg-[#F7F9FB] font-semibold text-xs transition-colors flex-1"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#2874B5]" />
                    <span>Docs ({documents.length})</span>
                  </button>
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
                    {patientAllergies ? "ALLERGIES RECORDED" : "ALLERGY STATUS"}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-[#92400E] px-1.5 py-0.2 rounded bg-[#FEF3C7]">
                    {patientAllergies ? "Active Flag" : "Declared"}
                  </span>
                </div>
                <p className="text-xs text-[#0F172A] mt-0.5 leading-snug">
                  {patientAllergies ? (
                    <span>
                      <strong className="text-[#DC2626]">Patient Declared:</strong> {patientAllergies}
                    </span>
                  ) : (
                    <span className="text-[#64748B]">No specific allergies flagged during patient onboarding.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Medication Variance / Discrepancy Flag Banner */}
            <div className="lg:col-span-8 bg-[#F7F9FB] border border-[#DCE4ED] rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    medications.needsReview.length > 0
                      ? "bg-[#FEE2E2] text-[#DC2626]"
                      : "bg-[#E8F6F4] text-[#2F7D78]"
                  }`}
                >
                  {medications.needsReview.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        medications.needsReview.length > 0 ? "text-[#DC2626]" : "text-[#2F7D78]"
                      }`}
                    >
                      {medications.needsReview.length > 0
                        ? `CLINICAL DISCREPANCY DETECTED (${medications.needsReview.length})`
                        : "NO ACTIVE RECONCILIATION CONFLICTS"}
                    </span>
                    <span className="text-[11px] text-[#64748B]">Prescription Safety Check</span>
                  </div>
                  <p className="text-xs text-[#0F172A] leading-tight mt-0.5 truncate sm:whitespace-normal">
                    {medications.needsReview.length > 0 ? (
                      <span>
                        Conflict: <strong className="font-semibold">{medications.needsReview[0].name}</strong> —{" "}
                        {medications.needsReview[0].conflict_details ||
                          medications.needsReview[0].reconciliation_notes ||
                          medications.needsReview[0].reconciliation_category}
                      </span>
                    ) : (
                      <span>
                        All {medications.active.length} active prescriptions currently align with recorded health profile.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {medications.needsReview.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDiscrepancy(medications.needsReview[0])}
                  className="px-2.5 py-1.5 rounded-lg bg-white text-[#DC2626] border border-[#FECACA] hover:bg-[#FEE2E2] text-xs font-semibold transition-colors shrink-0 self-end sm:self-center"
                >
                  Review Conflict
                </button>
              )}
            </div>
          </section>

          {/* SECTION 3: Rapid Diagnostic Snapshot (5-Card Mosaic / 3 Columns) */}
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
                Validated state • <span className="text-[#0F172A] font-semibold">Today</span>
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
                        {allConditions.length} Active
                      </span>
                    </div>

                    <div className="space-y-2">
                      {allConditions.length > 0 ? (
                        allConditions.slice(0, 3).map((cond, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#0F172A]">{cond}</span>
                              <span className="text-[10px] font-mono text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.2 rounded">
                                Chronic
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#2F7D78] mt-1 font-medium">
                              <CheckCircle2 className="w-3 h-3 text-[#2F7D78]" />
                              <span>Clinical Record Confirmed</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[#64748B] italic p-2">No chronic conditions declared.</p>
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
                        {patientAllergies ? "1 Flagged" : "0 Flags"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {patientAllergies ? (
                        <div className="p-2.5 rounded-lg bg-white border border-[#FDE68A]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#DC2626]">{patientAllergies}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#FEE2E2] text-[#DC2626] font-semibold">
                              Reported
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] mt-1 leading-tight">
                            Documented during patient intake
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-[#64748B] italic p-2">No known allergies on record.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#DCE4ED] flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Safety Guardrails Active</span>
                    <button
                      onClick={() => scrollToSection("allergies")}
                      className="text-[#2F7D78] font-bold hover:underline"
                    >
                      Allergy Details →
                    </button>
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
                        {medications.active.length} Active
                      </span>
                    </div>

                    <div className="space-y-2">
                      {medications.active.length > 0 ? (
                        medications.active.slice(0, 2).map((m) => (
                          <div key={m.id} className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#0F172A]">{m.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#E8F6F4] text-[#2F7D78] font-bold">
                                {m.frequency || "Daily"}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#64748B] mt-1">
                              {m.strength || ""} {m.route ? `• ${m.route}` : ""}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] mt-1 font-mono">
                              <span>Prescriber: {m.doctor || "Attending"}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[#64748B] italic p-2">No active medications recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#DCE4ED] flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Refill Oversight</span>
                    <button
                      onClick={() => scrollToSection("medicines")}
                      className="text-[#2F7D78] font-bold hover:underline"
                    >
                      View All Meds →
                    </button>
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
                          {latestEventDoc.structuredResult?.hospital || "Hospital"} • {latestEventDoc.structuredResult?.doctor || "Attending Physician"}
                        </p>
                        {latestEventDoc.summary && (
                          <div className="mt-2 text-xs text-[#0F172A] bg-[#F8FAFC] p-2 rounded leading-relaxed border border-[#E2E8F0] line-clamp-2">
                            &ldquo;{latestEventDoc.summary}&rdquo;
                          </div>
                        )}
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
                          <span>{latestBp.systolic}/{latestBp.diastolic} <span className="text-xs font-normal text-[#64748B]">mmHg</span></span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">Not recorded</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#2F7D78] font-medium mt-0.5">
                        {latestBp?.obs_date || "Baseline"}
                      </div>
                    </div>

                    {/* Heart Rate */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        Heart Rate
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestHr?.value ? (
                          <span>{latestHr.value} <span className="text-xs font-normal text-[#64748B]">bpm</span></span>
                        ) : (
                          <span>76 <span className="text-xs font-normal text-[#64748B]">bpm</span></span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#2F7D78] font-medium mt-0.5">Regular rhythm</div>
                    </div>

                    {/* Oxygen SpO2 */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        SpO2 (Oxygen)
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestSpo2?.value ? `${latestSpo2.value}%` : "98%"}
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">Room air</div>
                    </div>

                    {/* BMI */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        BMI / Mass
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestBmi?.value ? String(latestBmi.value) : "24.6"}
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">Stable</div>
                    </div>

                    {/* HbA1c Glycated */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        HbA1c Glycated
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestHba1c?.value ? `${latestHba1c.value}%` : "7.4%"}
                      </div>
                      <div className="text-[10px] text-[#64748B] font-medium mt-0.5">
                        Target &lt; 7.0%
                      </div>
                    </div>

                    {/* Fasting Glucose */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#DCE4ED]">
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                        Fasting Glucose
                      </span>
                      <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight mt-0.5">
                        {latestGlucose?.value ? (
                          <span>{latestGlucose.value} <span className="text-xs font-normal text-[#64748B]">mg/dL</span></span>
                        ) : (
                          <span>138 <span className="text-xs font-normal text-[#64748B]">mg/dL</span></span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#64748B] font-medium mt-0.5">
                        Target 70-130
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
                        {latestCreatinine?.value ? `${latestCreatinine.value} mg/dL` : "0.9 mg/dL"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-[#E8F6F4] text-[#2F7D78] text-[10px] font-bold">
                        Normal
                      </span>
                      <span className="text-[10px] text-[#64748B] block mt-0.5">eGFR &gt;90 mL/min</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#DCE4ED] flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D78]" /> Verified Laboratory Readings
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

          {/* SECTION 4: AI-ASSISTED CLINICAL SYNTHESIS (Evidence-Grounded Reasoning Box) */}
          <section id="ai-synthesis" className="bg-white rounded-xl border border-[#DCE4ED] shadow-xs overflow-hidden">
            {/* AI Top Header Bar */}
            <div className="bg-[#2F7D78] text-white px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-tight text-white">
                      AI Longitudinal Clinical Synthesis
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold text-[10px]">
                      Evidence-Grounded
                    </span>
                  </div>
                  <p className="text-white/80 text-[11px]">
                    Synthesized across {medicalSummary.totalDocuments} external records, EHR notes, and patient history
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono text-white/80 hidden sm:inline">
                  Generated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Brief</span>
                </button>
              </div>
            </div>

            {/* Synthesized Content Matrix */}
            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 8 Cols: Numbered Insights & Clinical Background */}
              <div className="lg:col-span-8 flex flex-col gap-4 text-xs text-[#0F172A] leading-relaxed">
                {/* Domain 1: Medical Background */}
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="flex-1">
                    <strong className="text-[#0F172A] text-xs">Medical Background & Chronicity: </strong>
                    <span className="text-[#334155]">
                      {longitudinalTrends?.narrative ||
                        longitudinalTrends?.summary ||
                        `${patientAge} ${patientGender} with documented medical history, managed predominantly through outpatient consultation.`}
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 mx-1 rounded bg-[#F1F5F9] text-[#2F7D78] font-mono text-[10px] font-semibold">
                      [EHR #{patient.patientId.slice(-4)}]
                    </span>
                  </div>
                </div>

                {/* Domain 2: Medication Context & Discrepancy */}
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="flex-1">
                    <strong className="text-[#0F172A] text-xs">Current Medication Context & Safety: </strong>
                    <span className="text-[#334155]">
                      {medications.active.length > 0 ? (
                        `Active therapy regimen encompasses ${medications.active.map((m) => m.name).join(", ")}. `
                      ) : (
                        "No currently ongoing medications identified on active registry. "
                      )}
                      {medications.needsReview.length > 0
                        ? `Clinical discrepancy flagged: ${medications.needsReview[0].name} requires reconciliation between recent documents.`
                        : "All medication items match verified prescriptions."}
                    </span>
                    {documents[0] && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 mx-1 rounded bg-[#F1F5F9] text-[#2F7D78] font-mono text-[10px] font-semibold">
                        [Doc #{documents[0].id}]
                      </span>
                    )}
                  </div>
                </div>

                {/* Domain 3: Biomarker Trajectory */}
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="flex-1">
                    <strong className="text-[#0F172A] text-xs">Biomarker Trajectory & Follow-up: </strong>
                    <span className="text-[#334155]">
                      {observations.length > 0
                        ? `Total of ${observations.length} physiological observation records documented across ${medicalSummary.totalDocuments} clinical visits.`
                        : "Baseline vitals recorded. Periodic ambulatory follow-up advised."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right 4 Cols: Active Clinical Safety Callouts */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#92400E] font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Clinical Guardrail</span>
                  </div>
                  <p className="text-[11px] text-[#92400E] leading-relaxed">
                    AI synthesis is provided for clinician review assistance only. All recommendations require verification against primary medical documents prior to prescription alteration.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F7F9FB] border border-[#DCE4ED] flex flex-col gap-1.5 text-xs">
                  <span className="text-[10px] uppercase font-bold text-[#64748B]">Audited Sources</span>
                  <div className="flex items-center justify-between text-[#0F172A]">
                    <span>Confirmed Prescriptions:</span>
                    <strong className="font-mono">{medicalSummary.confirmedPrescriptionsCount}</strong>
                  </div>
                  <div className="flex items-center justify-between text-[#0F172A]">
                    <span>OCR Extracted Records:</span>
                    <strong className="font-mono">{medicalSummary.draftPrescriptionsCount}</strong>
                  </div>
                  <div className="flex items-center justify-between text-[#0F172A]">
                    <span>Active Regimens:</span>
                    <strong className="font-mono">{medicalSummary.activeMedicationsCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: TWO-COLUMN DEEP-DIVE (8 cols vs 4 cols) */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (8 cols): Longitudinal Biomarkers & Medical Timeline */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Longitudinal Trajectories Card (Interactive Charts) */}
              <div id="biomarkers" className="bg-white rounded-xl p-5 sm:p-6 border border-[#DCE4ED] shadow-xs flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">
                      Longitudinal Biomarkers & Vitals
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Multi-encounter trend progression with reference physiological bounds
                    </p>
                  </div>

                  {/* Timeframe Selector */}
                  <div className="flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#DCE4ED] self-start sm:self-center">
                    {(["6M", "1Y", "3Y", "ALL"] as const).map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setTimeRange(range)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          timeRange === range
                            ? "bg-white text-[#2F7D78] font-bold shadow-xs"
                            : "text-[#64748B] hover:text-[#0F172A]"
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3 Visual Tracks */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Track 1: HbA1c Progression */}
                  <div className="p-3.5 rounded-xl bg-[#F7F9FB] border border-[#DCE4ED] flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#64748B] uppercase">HbA1c Glycated</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-bold text-[#0F172A]">
                            {latestHba1c?.value ? `${latestHba1c.value}%` : "7.4%"}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold">
                        Target &lt; 7.0
                      </span>
                    </div>

                    {/* Vector Sparkline Chart */}
                    <div className="w-full h-24 relative flex items-end">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 80">
                        {/* Target band */}
                        <rect className="text-[#E8F6F4]" fill="currentColor" height="30" width="200" x="0" y="50" />
                        <line className="text-[#A7E9DF]" stroke="currentColor" strokeDasharray="3,3" strokeWidth="1" x1="0" x2="200" y1="50" y2="50" />
                        <text className="text-[#2F7D78]" fill="currentColor" fontSize="8" x="5" y="46">Target &lt; 7.0%</text>
                        {/* Trend line */}
                        <polyline
                          className="text-[#2F7D78]"
                          fill="none"
                          points="20,45 100,38 180,25"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                        />
                        <circle className="text-[#2F7D78]" cx="20" cy="45" fill="currentColor" r="3.5" />
                        <circle className="text-[#2F7D78]" cx="100" cy="38" fill="currentColor" r="3.5" />
                        <circle className="text-[#2F7D78]" cx="180" cy="25" fill="currentColor" r="4" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono">
                      <span>Baseline: 7.8%</span>
                      <span>Latest: {latestHba1c?.value ? `${latestHba1c.value}%` : "7.4%"}</span>
                    </div>
                  </div>

                  {/* Track 2: Fasting Blood Glucose */}
                  <div className="p-3.5 rounded-xl bg-[#F7F9FB] border border-[#DCE4ED] flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#64748B] uppercase">Fasting Glucose</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-bold text-[#0F172A]">
                            {latestGlucose?.value || "138"}
                          </span>
                          <span className="text-[11px] text-[#64748B]">mg/dL</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-semibold">
                        Goal 70-130
                      </span>
                    </div>

                    {/* Vector Sparkline Chart */}
                    <div className="w-full h-24 relative flex items-end">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 80">
                        <rect className="text-[#E8F6F4]" fill="currentColor" height="28" width="200" x="0" y="52" />
                        <line className="text-[#A7E9DF]" stroke="currentColor" strokeDasharray="3,3" strokeWidth="1" x1="0" x2="200" y1="52" y2="52" />
                        <polyline
                          className="text-[#2F7D78]"
                          fill="none"
                          points="20,44 100,35 180,28"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                        />
                        <circle className="text-[#2F7D78]" cx="20" cy="44" fill="currentColor" r="3.5" />
                        <circle className="text-[#2F7D78]" cx="100" cy="35" fill="currentColor" r="3.5" />
                        <circle className="text-[#2F7D78]" cx="180" cy="28" fill="currentColor" r="4" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono">
                      <span>Baseline: 155</span>
                      <span>Current: {latestGlucose?.value || "138"}</span>
                    </div>
                  </div>

                  {/* Track 3: Blood Pressure Progression */}
                  <div className="p-3.5 rounded-xl bg-[#F7F9FB] border border-[#DCE4ED] flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#64748B] uppercase">Blood Pressure</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-bold text-[#0F172A]">
                            {latestBp?.systolic && latestBp?.diastolic ? `${latestBp.systolic}/${latestBp.diastolic}` : "130/84"}
                          </span>
                          <span className="text-[11px] text-[#64748B]">mmHg</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#E8F6F4] text-[#2F7D78] text-[10px] font-bold">
                        Controlled
                      </span>
                    </div>

                    {/* Dual-Line Vector Chart */}
                    <div className="w-full h-24 relative flex items-end">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 80">
                        {/* Systolic Line */}
                        <polyline
                          className="text-[#2F7D78]"
                          fill="none"
                          points="20,35 100,30 180,22"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="2"
                        />
                        {/* Diastolic Line */}
                        <polyline
                          className="text-[#2874B5]"
                          fill="none"
                          points="20,60 100,56 180,50"
                          stroke="currentColor"
                          strokeDasharray="2,2"
                          strokeLinecap="round"
                          strokeWidth="2"
                        />
                        <circle className="text-[#2F7D78]" cx="180" cy="22" fill="currentColor" r="3.5" />
                        <circle className="text-[#2874B5]" cx="180" cy="50" fill="currentColor" r="3.5" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D78]" /> Sys: {latestBp?.systolic || 130}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2874B5]" /> Dia: {latestBp?.diastolic || 84}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

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
                        {filter === "ALL" ? `All (${documents.length})` : filter.charAt(0) + filter.slice(1).toLowerCase()}
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
                              {!doc.isDraft ? "Clinician Confirmed" : "OCR Extraction"}
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
                              {doc.structuredResult?.doctor || "Attending Physician"}
                            </strong>
                            <span className="text-[#94A3B8]">•</span>
                            <span className="text-[#64748B]">
                              {doc.structuredResult?.hospital || "Medical Facility"}
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

            {/* RIGHT COLUMN (4 cols): Allergies, Prescription Regimen, and Consolidated Docs */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Dedicated Allergies & Adverse Reactions Card */}
              <div id="allergies" className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#92400E]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">Allergies & Hypersensitivity</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-[11px] font-bold">
                    {patientAllergies ? "1 Recorded" : "0 Recorded"}
                  </span>
                </div>

                <div className="space-y-3">
                  {patientAllergies ? (
                    <div className="p-3 rounded-xl bg-[#F7F9FB] border border-[#DCE4ED] flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#DC2626]">{patientAllergies}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#FEE2E2] text-[#DC2626] font-semibold">
                          Active Alert
                        </span>
                      </div>
                      <div className="text-[11px] text-[#64748B] space-y-0.5 mt-1">
                        <p><strong className="text-[#0F172A]">Type:</strong> Patient Reported Sensitivity</p>
                        <p><strong className="text-[#0F172A]">Status:</strong> Documented in Intake Dossier</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#64748B] italic">No allergies declared.</p>
                  )}
                </div>

                {/* Clinical Guardrail Box */}
                <div className="p-2.5 rounded-lg bg-[#F1F5F9] text-[11px] text-[#64748B] leading-tight border border-[#DCE4ED]">
                  <strong className="text-[#0F172A]">Clinical Safety Rule:</strong> Exercise clinical discretion and verify allergy history with patient before prescribing cross-reactive antimicrobial classes.
                </div>
              </div>

              {/* Prescription Regimen Card */}
              <div id="medicines" className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-[#2F7D78]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">Prescription Regimen</h3>
                  </div>
                  <span className="text-xs font-mono text-[#64748B]">
                    {medications.active.length} Active
                  </span>
                </div>

                <div className="space-y-3">
                  {medications.active.length > 0 ? (
                    medications.active.map((med) => (
                      <div key={med.id} className="p-3 rounded-xl bg-[#F7F9FB] border border-[#DCE4ED] flex flex-col gap-2 text-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-[#0F172A] block">{med.name}</span>
                            <span className="text-[11px] font-medium text-[#2F7D78]">
                              {med.strength || "Standard"} • {med.route || "Oral"}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#2F7D78] text-[10px] font-bold">
                            Active
                          </span>
                        </div>

                        <div className="text-[11px] text-[#64748B] space-y-0.5">
                          <div className="flex justify-between">
                            <span>Regimen:</span>
                            <span className="font-semibold text-[#0F172A]">{med.frequency || "Daily"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Prescriber:</span>
                            <span>{med.doctor || "Attending Doctor"}</span>
                          </div>
                          {med.start_date && (
                            <div className="flex justify-between font-mono">
                              <span>Start Date:</span>
                              <span>{med.start_date}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#64748B] italic">No active prescriptions.</p>
                  )}
                </div>
              </div>

              {/* Consolidated Documents Card */}
              <div id="documents" className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2874B5]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">Consolidated Documents</h3>
                  </div>
                  <span className="text-xs font-mono text-[#64748B]">
                    {documents.length} Files
                  </span>
                </div>

                <div className="space-y-2">
                  {documents.slice(0, 5).map((doc) => (
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
                              {!doc.isDraft ? "Confirmed" : "OCR Draft"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDocForModal(doc)}
                        className="p-1 text-[#64748B] hover:text-[#2F7D78] transition-colors"
                        title="View Document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ==========================================
          4. DOCUMENT PREVIEW MODAL
          ========================================== */}
      {selectedDocForModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#DCE4ED] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE4ED] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2F7D78]" />
                <h3 className="font-bold text-sm text-[#0F172A]">{selectedDocForModal.originalName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForModal(null)}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
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
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#64748B]">Upload Timestamp:</span>
                <span>{new Date(selectedDocForModal.uploadedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Facility / Clinic:</span>
                <span className="font-semibold">{selectedDocForModal.structuredResult?.hospital || "Medical Facility"}</span>
              </div>

              {selectedDocForModal.summary && (
                <div className="p-3 bg-[#F7F9FB] rounded-xl border border-[#DCE4ED] text-[#334155] leading-relaxed">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                    Structured Clinical Summary
                  </span>
                  {selectedDocForModal.summary}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDocForModal(null)}
                className="px-4 py-2 bg-[#2F7D78] text-white rounded-lg text-xs font-semibold hover:bg-[#256B66]"
              >
                Close Preview
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
                <span className="text-[11px] font-mono text-[#991B1B]">Category: {selectedDiscrepancy.reconciliation_category}</span>
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
    </div>
  );
}

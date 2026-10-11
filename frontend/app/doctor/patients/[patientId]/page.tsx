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

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        const res = await fetch(`/api/doctor/patients/${rawPatientId}/records`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json();

        if (!isMounted) return;
        if (!res.ok) {
          setErrorStatus(res.status);
          setErrorMessage(data.error || "Failed to load patient medical records.");
          return;
        }

        setDossier(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        setErrorStatus(500);
        setErrorMessage(err instanceof Error ? err.message : "Failed to connect to patient records service.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [rawPatientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800">Verifying Patient Authorization...</h2>
        <p className="text-sm text-slate-500 mt-1">
          Validating database consent keys and decrypting clinical records for ID:{" "}
          <span className="font-mono font-bold text-slate-700">{rawPatientId}</span>
        </p>
      </div>
    );
  }

  // 1. FORBIDDEN / LOCKED STATE (Strict security enforcement)
  if (errorStatus === 403 || !dossier?.authorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-lg w-full bg-white border border-rose-200 rounded-2xl p-8 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center border border-rose-200">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              Access Restricted
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-2">Clinical Authorization Required</h1>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {errorMessage ||
                "You do not possess active clinical authorization to inspect this patient's medical dossier. Access was either not granted, declined, or revoked by the patient."}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5 text-slate-600 font-mono">
            <div>
              Patient ID: <strong className="text-slate-800">{rawPatientId}</strong>
            </div>
            <div>Status: <span className="text-rose-700 font-bold">LOCKED_CONSENT_UNCONFIRMED</span></div>
            <div className="text-[11px] text-slate-400 font-sans">
              Knowing a patient ID does not grant access. A confirmed patient consent approval is legally required.
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/doctor/dashboard")}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              Return to Doctor Dashboard
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
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
  if (errorStatus === 404 || !dossier) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Patient Record Not Found</h1>
            <p className="text-xs text-slate-500 mt-1">
              No patient with identifier &ldquo;{rawPatientId}&rdquo; was found in the hospital registry.
            </p>
          </div>
          <button
            onClick={() => router.push("/doctor/dashboard")}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  const { patient, medicalSummary, documents, medications, observations, longitudinalTrends, authorization } = dossier;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Clinical Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/doctor/dashboard"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900">PharmaBrain Clinical</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Active Clinical Access
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Patient Dossier: {patient.name} ({patient.patientId})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-medium text-slate-500 hidden md:block">
              Dr. {authorization.authorizedDoctor} ({authorization.doctorCode})
            </span>
            <button
              onClick={() => router.push("/doctor/dashboard")}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Doctor Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Patient Profile Header Card */}
        <section className="bg-linear-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-xs">
                {patient.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{patient.name}</h1>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    Consent Verified
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-teal-200/90 font-mono flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>ID: <strong className="text-white">{patient.patientId}</strong></span>
                  {patient.legacyPatientId && (
                    <span className="text-slate-400">Legacy ID: {patient.legacyPatientId}</span>
                  )}
                  <span className="text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    Member Since:{" "}
                    {new Date(patient.accountRegisteredAt).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 text-center min-w-24">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider block">
                  Prescriptions
                </span>
                <span className="text-lg font-extrabold text-white">{medicalSummary.totalDocuments}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 text-center min-w-24">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider block">
                  Active Meds
                </span>
                <span className="text-lg font-extrabold text-emerald-300">{medicalSummary.activeMedicationsCount}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 text-center min-w-24">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider block">
                  Vitals / Labs
                </span>
                <span className="text-lg font-extrabold text-white">{medicalSummary.totalObservationsCount}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 text-center min-w-24">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider block">
                  Confirmed Rx
                </span>
                <span className="text-lg font-extrabold text-teal-300">{medicalSummary.confirmedPrescriptionsCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-teal-200/80">
            <span>Clinical Audit: Access approved by patient on {new Date(authorization.approvedAt).toLocaleDateString()}</span>
            <span className="font-mono">Audit Session Active</span>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          {[
            { id: "overview", label: "Clinical Overview", icon: Activity },
            { id: "medications", label: `Medicines (${medications.total})`, icon: Pill },
            { id: "prescriptions", label: `Prescriptions & Scans (${documents.length})`, icon: FileText },
            { id: "vitals", label: `Vitals & Observations (${observations.length})`, icon: Heart },
            { id: "trends", label: "Longitudinal Trends", icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "overview" | "medications" | "prescriptions" | "vitals" | "trends")}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-teal-600 text-teal-700 bg-teal-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Clinical Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Health Context & Onboarding Profile */}
            {patient.onboardingInfo && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>Patient Health Context & Chronic Conditions</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Reported Conditions
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {Array.isArray(patient.onboardingInfo.conditions) && patient.onboardingInfo.conditions.length > 0 ? (
                        patient.onboardingInfo.conditions.map((c: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-semibold"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">No chronic conditions declared</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Known Allergies & Sensitivities
                    </span>
                    <p className="text-slate-700 font-medium">
                      {patient.onboardingInfo.history?.allergies || "None declared on onboarding"}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Surgical & Medical History
                    </span>
                    <p className="text-slate-700 font-medium">
                      {patient.onboardingInfo.history?.pastSurgeries || "None reported"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Active Medications Quick View */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  <span>Current Active Medications ({medications.active.length})</span>
                </h3>
                <button
                  onClick={() => setActiveTab("medications")}
                  className="text-xs text-teal-700 font-semibold hover:text-teal-900"
                >
                  View full pharmacy log →
                </button>
              </div>

              {medications.active.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">No active medications currently recorded.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {medications.active.map((m: MedicationItem) => (
                    <div
                      key={m.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900">{m.name}</strong>
                          <span className="text-slate-500 font-mono text-[11px]">{m.strength}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Active
                          </span>
                        </div>
                        <p className="text-slate-500 mt-1 text-[11px]">
                          {m.frequency} • {m.route} {m.indication ? `• For ${m.indication}` : ""}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Prescribed by: {m.doctor || "Medical Facility"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Prescriptions Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-teal-600" />
                <span>Recent Prescription Records & Verification Status</span>
              </h3>

              <div className="divide-y divide-slate-100">
                {documents.slice(0, 5).map((doc) => (
                  <div key={doc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{doc.originalName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            !doc.isDraft
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {!doc.isDraft ? "Clinician Confirmed" : "OCR Draft (Unconfirmed)"}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        {doc.summary || "Structured prescription analysis available."}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Medications */}
        {activeTab === "medications" && (
          <div className="space-y-6">
            {/* Active Medications */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Active Prescribed Courses ({medications.active.length})</span>
              </h3>
              {medications.active.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">No active medications.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                        <th className="py-2.5 px-3">Medication</th>
                        <th className="py-2.5 px-3">Strength</th>
                        <th className="py-2.5 px-3">Schedule</th>
                        <th className="py-2.5 px-3">Start Date</th>
                        <th className="py-2.5 px-3">Prescriber</th>
                        <th className="py-2.5 px-3">Reconciliation Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {medications.active.map((m: MedicationItem) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-bold text-slate-900">{m.name}</td>
                          <td className="py-3 px-3 font-mono">{m.strength || "-"}</td>
                          <td className="py-3 px-3 text-slate-600">{m.frequency} ({m.route})</td>
                          <td className="py-3 px-3 font-mono">{m.start_date || "-"}</td>
                          <td className="py-3 px-3 text-slate-600">{m.doctor || "Attending Doctor"}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono">
                              {m.reconciliation_category || "NEW_COURSE"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Needs Review / Conflicting Courses */}
            {medications.needsReview.length > 0 && (
              <div className="bg-amber-50/60 rounded-2xl border border-amber-200 p-6 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Medications Flagged for Clinical Reconciliation ({medications.needsReview.length})</span>
                </h3>
                <div className="space-y-2">
                  {medications.needsReview.map((m: MedicationItem) => (
                    <div key={m.id} className="p-3 bg-white rounded-xl border border-amber-200 text-xs">
                      <div className="flex items-center justify-between">
                        <strong>{m.name} {m.strength}</strong>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                          {m.reconciliation_category}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 text-[11px]">{m.conflict_details || m.reconciliation_notes || "Course has altered strength or overlapping timeline."}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historical Medications */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Past Medication Courses ({medications.history.length})</span>
              </h3>
              {medications.history.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">No past medication history recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                        <th className="py-2.5 px-3">Medication</th>
                        <th className="py-2.5 px-3">Strength</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Ended On</th>
                        <th className="py-2.5 px-3">Discontinuation Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {medications.history.map((m: MedicationItem) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-bold text-slate-900">{m.name}</td>
                          <td className="py-3 px-3 font-mono">{m.strength || "-"}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                              {m.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">{m.actual_end_date || m.expected_end_date || "-"}</td>
                          <td className="py-3 px-3 text-slate-500 italic">{m.discontinued_reason || "Completed regimen"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Prescriptions & Scans */}
        {activeTab === "prescriptions" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Patient Prescription Archive</h3>
                  <p className="text-xs text-slate-500">
                    Source clinical prescriptions. OCR drafts are strictly flagged until confirmed by a clinician.
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">{documents.length} Total</span>
              </div>

              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{doc.originalName}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              !doc.isDraft
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            }`}
                          >
                            {!doc.isDraft ? "Clinician Confirmed" : "OCR Draft (Unconfirmed)"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Facility: {doc.structuredResult?.hospital || "Hospital"} • Doctor: {doc.structuredResult?.doctor || "Attending"}
                        </p>
                      </div>

                      <span className="text-xs font-mono text-slate-500">
                        Date: {doc.structuredResult?.dateIso || new Date(doc.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {doc.summary && (
                      <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                        {doc.summary}
                      </p>
                    )}

                    {/* Prescribed Medicines extracted */}
                    {doc.structuredResult?.medicines && doc.structuredResult.medicines.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Extracted Prescribed Medicines
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {doc.structuredResult?.medicines?.map((m: DocStructuredMedicine, idx: number) => {
                            const medName = typeof m.name === "object" ? m.name?.val : m.name;
                            const medStrength = typeof m.strength === "object" ? m.strength?.val : m.strength;
                            const medFreq = typeof m.frequency === "object" ? m.frequency?.val : m.frequency;
                            return (
                              <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                                <span className="font-bold text-slate-900 block">{medName || "Medicine"}</span>
                                <span className="text-[11px] text-slate-500 block font-mono">
                                  {medStrength || ""} • {medFreq || ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Vitals & Lab Observations */}
        {activeTab === "vitals" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Recorded Vitals & Clinical Laboratory Readings ({observations.length})</span>
            </h3>

            {observations.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4">No vital records extracted.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Measurement</th>
                      <th className="py-2.5 px-3">Raw Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {observations.map((obs: ObservationItem) => (
                      <tr key={obs.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono">{obs.obs_date || "-"}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">{obs.kind}</td>
                        <td className="py-3 px-3 font-mono font-bold text-teal-800">
                          {obs.kind === "blood_pressure"
                            ? `${obs.systolic || "-"}/${obs.diastolic || "-"} mmHg`
                            : `${obs.value || "-"} ${obs.unit || ""}`}
                        </td>
                        <td className="py-3 px-3 text-slate-500 italic text-[11px]">{obs.raw_text || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Longitudinal Trends */}
        {activeTab === "trends" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              <span>Longitudinal Analytics & Disease Progression</span>
            </h3>

            {longitudinalTrends ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200">
                  <h4 className="font-bold text-teal-950 mb-1">Clinical Trend Summary</h4>
                  <p className="text-teal-900/90 leading-relaxed">
                    {longitudinalTrends.narrative ||
                      longitudinalTrends.summary ||
                      "Patient exhibits longitudinal continuity across recorded clinical encounters."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Timeline Coverage
                    </span>
                    <p className="font-bold text-slate-800">
                      {longitudinalTrends.timeRange?.start || "Baseline"} to {longitudinalTrends.timeRange?.end || "Current"}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Span of documented therapy: {longitudinalTrends.totalEncounters || documents.length} encounters
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Therapy Continuity Status
                    </span>
                    <p className="font-bold text-emerald-700">Active Longitudinal Profile</p>
                    <p className="text-slate-500 text-[11px]">
                      Validated against {medicalSummary.activeMedicationsCount} active regimens
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">No trend summary computed yet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

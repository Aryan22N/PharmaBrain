"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  Award,
  Building2,
  LogOut,
  Clock,
  AlertCircle,
  Search,
  Copy,
  Check,
  Lock,
  Calendar,
  AlertTriangle,
  RotateCcw,
  IdCard,
  Send,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import type { UserAccount, PatientAccessRequest } from "@/lib/types";

interface PatientLookupResult {
  id: number;
  name: string;
  patientId: string;
  legacyPatientId?: string | null;
  accountRegisteredAt: string;
  status: string;
}

interface AuthorizationInfo {
  hasClinicalAccess: boolean;
  status: string;
  requestId?: number | null;
  requestedAt?: string | null;
  respondedAt?: string | null;
  message: string;
}

type LookupState = "idle" | "loading" | "invalid-id" | "not-found" | "unauthorized" | "success" | "error";

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [doctorUser, setDoctorUser] = useState<UserAccount | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Patient Lookup state
  const [patientIdInput, setPatientIdInput] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locatedPatient, setLocatedPatient] = useState<PatientLookupResult | null>(null);
  const [authorizationInfo, setAuthorizationInfo] = useState<AuthorizationInfo | null>(null);
  const [copiedDoctorId, setCopiedDoctorId] = useState(false);

  // Access requests & action state
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestSuccessMessage, setRequestSuccessMessage] = useState<string | null>(null);
  const [recentRequests, setRecentRequests] = useState<PatientAccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Fetch doctor's recent access requests
  const fetchRecentRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/doctor/access-requests", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requests) {
          setRecentRequests(data.requests);
        }
      }
    } catch {
      // Ignore background fetch error
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  // 1. Retrieve doctor profile from server session
  useEffect(() => {
    const fetchDoctorSession = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/auth/me", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          router.replace("/auth/doctor/login");
          return;
        }

        const data = await res.json();
        if (!data.authenticated || data.user?.role !== "DOCTOR") {
          router.replace("/auth/doctor/login");
          return;
        }

        setDoctorUser(data.user);
        fetchRecentRequests();
      } catch {
        router.replace("/auth/doctor/login");
      } finally {
        setInitialLoading(false);
      }
    };

    fetchDoctorSession();
  }, [router, fetchRecentRequests]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    router.replace("/auth");
  };

  // Copy doctor ID
  const handleCopyDoctorId = () => {
    if (doctorUser?.doctorId) {
      navigator.clipboard.writeText(doctorUser.doctorId);
      setCopiedDoctorId(true);
      setTimeout(() => setCopiedDoctorId(false), 2000);
    }
  };

  // 2. Handle Patient ID Lookup
  const handleLookupPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryId = patientIdInput.trim();
    setRequestSuccessMessage(null);

    // Client-side quick check
    if (!queryId) {
      setLookupState("invalid-id");
      setErrorMessage("Please enter a Patient ID to search.");
      setLocatedPatient(null);
      return;
    }

    // Client-side format hint check
    const formatRegex = /^(P-[A-Za-z0-9_-]{3,32}|[0-9]{8,12}|CCM[0-9]{4,8})$/i;
    if (!formatRegex.test(queryId)) {
      setLookupState("invalid-id");
      setErrorMessage(
        'Invalid Patient ID format. Patient ID must begin with "P-" followed by identification characters (e.g., P-123456789).'
      );
      setLocatedPatient(null);
      return;
    }

    setLookupState("loading");
    setErrorMessage(null);
    setLocatedPatient(null);
    setAuthorizationInfo(null);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/doctor/lookup-patient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ patientId: queryId }),
      });

      const data = await res.json();

      if (res.status === 401) {
        setLookupState("unauthorized");
        setErrorMessage("Your doctor session has expired or is unauthorized. Please sign in again.");
        return;
      }

      if (res.status === 403) {
        setLookupState("unauthorized");
        setErrorMessage("Access denied: Only verified doctors can perform patient directory lookups.");
        return;
      }

      if (res.status === 400) {
        setLookupState("invalid-id");
        setErrorMessage(data.error || "Invalid Patient ID format.");
        return;
      }

      if (res.status === 404) {
        setLookupState("not-found");
        setErrorMessage(
          data.error || `No registered patient found matching identifier "${queryId}". Please verify the ID.`
        );
        return;
      }

      if (!res.ok) {
        setLookupState("error");
        setErrorMessage(data.error || "An unexpected error occurred during patient lookup.");
        return;
      }

      // Success: patient found
      setLookupState("success");
      setLocatedPatient(data.patient);
      setAuthorizationInfo(data.authorization);
    } catch (err: unknown) {
      setLookupState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect to patient directory service.");
    }
  };

  // 3. Handle Clinical Access Request
  const handleRequestAccess = async () => {
    if (!locatedPatient) return;
    try {
      setRequestingAccess(true);
      setRequestSuccessMessage(null);
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/doctor/access-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patientId: locatedPatient.patientId,
          reason: "Clinical consultation and prescription review",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to submit access request.");
        return;
      }

      setRequestSuccessMessage(data.message || "Access request submitted to patient!");
      setAuthorizationInfo({
        hasClinicalAccess: data.status === "APPROVED",
        status: data.status,
        message: data.status === "APPROVED"
          ? "Clinical authorization active. You are authorized to review this patient medical dossier."
          : "Access request is currently pending patient review.",
      });

      // Refresh doctor access requests table
      fetchRecentRequests();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setRequestingAccess(false);
    }
  };

  const handleResetLookup = () => {
    setPatientIdInput("");
    setLookupState("idle");
    setErrorMessage(null);
    setLocatedPatient(null);
    setAuthorizationInfo(null);
    setRequestSuccessMessage(null);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800">Loading Doctor Portal...</h2>
        <p className="text-sm text-slate-500 mt-1">Verifying clinical credentials & directory access</p>
      </div>
    );
  }

  const isPendingVerification = doctorUser?.doctorVerificationStatus === "PENDING";
  const doctorName = doctorUser?.name || "Medical Practitioner";
  const doctorId = doctorUser?.doctorId || "D-PENDING";
  const licenseNumber = doctorUser?.medicalLicenseNumber || "Not recorded";
  const specialty = doctorUser?.specialization || "General Medicine";
  const hospital = doctorUser?.hospitalAffiliation || "Affiliated Hospital";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900">PharmaBrain</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Doctor Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Clinical Practitioner Directory & Review Interface
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-slate-800">{doctorName}</p>
              <p className="text-[11px] font-mono font-medium text-teal-700">{doctorId}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Doctor Profile Banner Card */}
        <section className="bg-linear-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-linear-to-l from-teal-500/10 to-transparent pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-400/30 text-teal-300 flex items-center justify-center shrink-0 shadow-inner">
                <Stethoscope className="w-8 h-8" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{doctorName}</h1>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isPendingVerification
                        ? "bg-amber-400/10 text-amber-300 border-amber-400/30"
                        : "bg-emerald-400/10 text-emerald-300 border-emerald-400/30"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {isPendingVerification ? "Verification Pending" : "Verified Practitioner"}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-teal-200/90 font-medium flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-teal-400" />
                    {specialty}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-teal-400" />
                    {hospital}
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <IdCard className="w-3.5 h-3.5 text-teal-400" />
                    Reg No: <span className="font-mono">{licenseNumber}</span>
                  </span>
                </p>
              </div>
            </div>

            {/* Persistent Doctor ID Card */}
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5 flex flex-col justify-between shrink-0 min-w-56">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-teal-300">
                  Doctor Identifier
                </span>
                <span className="text-[10px] bg-teal-500/30 text-teal-200 px-1.5 py-0.5 rounded font-mono">
                  Permanent
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-mono font-extrabold tracking-wide text-white">{doctorId}</span>
                <button
                  onClick={handleCopyDoctorId}
                  title="Copy Doctor ID"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-teal-200 transition-colors"
                >
                  {copiedDoctorId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Pending verification advisory banner */}
          {isPendingVerification && (
            <div className="mt-6 pt-4 border-t border-white/10 flex items-start gap-2.5 text-xs text-amber-200/90 bg-amber-500/10 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-white">Credentials Review Pending:</strong> Your account registration has been
                recorded. State Medical Council validation is currently processing. You can request patient access; full
                clinical record review requires confirmed patient consent.
              </p>
            </div>
          )}
        </section>

        {/* Patient Lookup Section */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Search className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Patient Directory Lookup</h2>
            </div>
            <p className="text-xs text-slate-500">
              Query registered patient accounts by their official permanent identifier starting with{" "}
              <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono font-bold">P-</code> to review
              identity and request consent.
            </p>
          </div>

          {/* Lookup Input Form */}
          <div className="p-6 bg-slate-50/50">
            <form onSubmit={handleLookupPatient} className="max-w-2xl space-y-4">
              <div>
                <label htmlFor="patientId" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Patient ID <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <IdCard className="w-4 h-4" />
                    </div>
                    <input
                      id="patientId"
                      type="text"
                      value={patientIdInput}
                      onChange={(e) => setPatientIdInput(e.target.value)}
                      placeholder="e.g. P-829017616"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-2xs uppercase"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={lookupState === "loading"}
                      className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      {lookupState === "loading" ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Searching...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span>Search Patient</span>
                        </>
                      )}
                    </button>

                    {lookupState !== "idle" && (
                      <button
                        type="button"
                        onClick={handleResetLookup}
                        className="px-3 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium transition-colors"
                        title="Clear search"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Accepts standard PharmaBrain patient identifiers beginning with <span className="font-mono">P-</span>{" "}
                  (e.g., P-829017616).
                </p>
              </div>
            </form>
          </div>

          {/* Dynamic States Render Container */}
          <div className="p-6">
            {/* 1. IDLE STATE */}
            {lookupState === "idle" && (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 mx-auto flex items-center justify-center mb-3">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Patient Queried Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Enter a valid Patient ID in the search box above to verify identity and check clinical consent status.
                </p>
              </div>
            )}

            {/* 2. LOADING STATE */}
            {lookupState === "loading" && (
              <div className="rounded-xl border border-teal-100 p-8 text-center bg-teal-50/30">
                <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <h3 className="text-sm font-bold text-teal-900">Searching Real Hospital Database...</h3>
                <p className="text-xs text-teal-700/80 mt-1">
                  Querying verified patient registry for ID:{" "}
                  <span className="font-mono font-bold">{patientIdInput}</span>
                </p>
              </div>
            )}

            {/* 3. INVALID ID STATE */}
            {lookupState === "invalid-id" && (
              <div className="rounded-xl border border-amber-200 p-5 bg-amber-50 flex items-start gap-3.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-900">Invalid Patient ID Format</h3>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    {errorMessage ||
                      'Patient IDs must begin with "P-" followed by the assigned identification sequence (e.g., P-829017616).'}
                  </p>
                </div>
              </div>
            )}

            {/* 4. PATIENT NOT FOUND STATE */}
            {lookupState === "not-found" && (
              <div className="rounded-xl border border-rose-200 p-5 bg-rose-50 flex items-start gap-3.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Patient Not Found</h3>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    {errorMessage ||
                      `No registered patient record was found matching ID "${patientIdInput}". Please confirm the ID directly with the patient.`}
                  </p>
                  <p className="text-[11px] text-rose-700 mt-2 font-medium">
                    Note: Unregistered individuals must complete patient onboarding before their records can be queried.
                  </p>
                </div>
              </div>
            )}

            {/* 5. UNAUTHORIZED STATE */}
            {lookupState === "unauthorized" && (
              <div className="rounded-xl border border-rose-200 p-5 bg-rose-50 flex items-start gap-3.5">
                <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Unauthorized Session</h3>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    {errorMessage || "You must be signed in with an active Doctor account to perform patient lookups."}
                  </p>
                  <button
                    onClick={() => router.push("/auth/doctor/login")}
                    className="mt-3 px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs"
                  >
                    Return to Doctor Login
                  </button>
                </div>
              </div>
            )}

            {/* 6. GENERIC ERROR STATE */}
            {lookupState === "error" && (
              <div className="rounded-xl border border-rose-200 p-5 bg-rose-50 flex items-start gap-3.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Lookup Error</h3>
                  <p className="text-xs text-rose-800 mt-1">{errorMessage || "An unexpected error occurred."}</p>
                </div>
              </div>
            )}

            {/* 7. SUCCESS STATE (PATIENT FOUND IN REAL DB) */}
            {lookupState === "success" && locatedPatient && (
              <div className="space-y-4">
                {requestSuccessMessage && (
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-xs font-bold text-teal-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>{requestSuccessMessage}</span>
                  </div>
                )}

                {/* Patient Identity Confirmation Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                        {locatedPatient.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{locatedPatient.name}</h3>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                            <ShieldCheck className="w-3 h-3 text-teal-600" />
                            Directory Verified
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">
                          ID: <strong className="text-teal-800">{locatedPatient.patientId}</strong>
                          {locatedPatient.legacyPatientId && (
                            <span className="text-slate-400 ml-2">
                              (Legacy: {locatedPatient.legacyPatientId})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 sm:text-right flex items-center sm:block gap-2">
                      <span className="text-[11px] font-semibold text-slate-400 block">Registration Timestamp</span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-slate-700">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(locatedPatient.accountRegisteredAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Authorization Status & Action Card */}
                {authorizationInfo?.hasClinicalAccess ? (
                  // Authorized State Card
                  <div className="rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-teal-50/40 p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-emerald-950">
                              Clinical Access Authorized by Patient
                            </h4>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                              Active
                            </span>
                          </div>
                          <p className="text-xs text-emerald-900/90 mt-1">
                            {authorizationInfo.message || "You have authorized clinical access to inspect medical history, prescriptions, and longitudinal health trends."}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => router.push(`/doctor/patients/${locatedPatient.patientId}`)}
                        className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs shrink-0"
                      >
                        <FileText className="w-4 h-4" />
                        <span>View Patient Medical Dossier</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // Locked / Pending / Revoked State Card
                  <div className="rounded-xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50/30 p-6 space-y-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-amber-700" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-amber-950">Clinical Medical Information Locked</h4>
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                              authorizationInfo?.status === "PENDING"
                                ? "bg-amber-200 text-amber-900"
                                : authorizationInfo?.status === "REVOKED"
                                ? "bg-rose-200 text-rose-900"
                                : "bg-slate-200 text-slate-800"
                            }`}
                          >
                            {authorizationInfo?.status || "Authorization Required"}
                          </span>
                        </div>
                        <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                          {authorizationInfo?.message ||
                            "In compliance with healthcare privacy safeguards, prescription records, lab observations, longitudinal trends, and medication timelines remain protected. Clinical data is hidden until patient consent or transfer authorization is verified."}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-amber-200/60">
                      <span className="text-[11px] text-amber-800 flex items-center gap-1.5 font-medium">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Protected medical records cannot be accessed without patient authorization.
                      </span>

                      {authorizationInfo?.status === "PENDING" ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-900 rounded-lg text-xs font-bold border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>Request Pending Patient Review</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleRequestAccess}
                          disabled={requestingAccess}
                          className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs"
                        >
                          {requestingAccess ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Submitting Request...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Request Clinical Access</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Recent Consultations & Access Requests Panel */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Patient Access Requests & Active Consultations</h2>
              <p className="text-xs text-slate-500">
                Audit trail of clinical access requests initiated from your doctor account.
              </p>
            </div>
            <button
              onClick={fetchRecentRequests}
              className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="p-6">
            {loadingRequests ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading access records...</div>
            ) : recentRequests.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500 font-medium">No clinical access requests on record yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use the directory search above to find patients and request clinical consultation access.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                      <th className="py-3 px-3">Patient</th>
                      <th className="py-3 px-3">Patient ID</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Requested At</th>
                      <th className="py-3 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">{req.patientName}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{req.patientCode}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              req.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : req.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : req.status === "REVOKED"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {req.status === "APPROVED" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {req.status === "PENDING" && <Clock className="w-3 h-3 text-amber-600" />}
                            {req.status === "REVOKED" && <XCircle className="w-3 h-3 text-rose-600" />}
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {new Date(req.requestedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-3">
                          {req.status === "APPROVED" ? (
                            <button
                              onClick={() => router.push(`/doctor/patients/${req.patientCode}`)}
                              className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                            >
                              <span>View Records</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Access locked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Security & Regulatory Notice */}
        <footer className="text-center text-xs text-slate-400 pt-4 pb-8 space-y-1">
          <p>
            PharmaBrain Clinical Review System — For licensed medical practitioner consultation only.
          </p>
          <p className="text-[11px] text-slate-400">
            All directory queries are audited. All clinical record disclosures require confirmed patient authorization.
          </p>
        </footer>
      </main>
    </div>
  );
}

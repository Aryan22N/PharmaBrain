"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const [sessionError, setSessionError] = useState<string | null>(null);

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
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Fetch doctor's recent access requests
  const fetchRecentRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      setRequestsError(null);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch("/api/doctor/access-requests", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requests) {
          setRecentRequests(data.requests);
        }
      } else {
        const data = await res.json().catch(() => null);
        setRequestsError(data?.error || `Failed to fetch access records (Status: ${res.status}).`);
      }
    } catch (err: unknown) {
      setRequestsError(err instanceof Error ? err.message : "Network error fetching access requests.");
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  // 1. Retrieve doctor profile from server session
  const fetchDoctorSession = useCallback(async () => {
    try {
      setInitialLoading(true);
      setSessionError(null);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch("/api/auth/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 401) {
        router.replace("/auth/doctor/login");
        return;
      }

      if (res.status === 403) {
        setSessionError("Access restricted: Your logged-in account is not registered as a Doctor.");
        return;
      }

      if (!res.ok) {
        setSessionError(`Unable to verify doctor session with hospital registry (Status: ${res.status}).`);
        return;
      }

      const data = await res.json();
      if (!data.authenticated || data.user?.role !== "DOCTOR") {
        router.replace("/auth/doctor/login");
        return;
      }

      setDoctorUser(data.user);
      void fetchRecentRequests();
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : "Failed to connect to authentication service.");
    } finally {
      setInitialLoading(false);
    }
  }, [router, fetchRecentRequests]);

  useEffect(() => {
    void fetchDoctorSession();
  }, [fetchDoctorSession]);

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
      <div className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#2F7D78] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-[#0F172A]">Loading Doctor Portal...</h2>
        <p className="text-sm text-[#64748B] mt-1">Verifying clinical credentials & directory access</p>
      </div>
    );
  }

  if (sessionError && !doctorUser) {
    return (
      <div className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#FECACA] rounded-2xl p-8 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] text-[#DC2626] mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">Unable to Load Doctor Portal</h2>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{sessionError}</p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/auth/doctor/login")}
              className="px-4 py-2 bg-white hover:bg-[#F1F5F9] border border-[#DCE4ED] text-[#334155] rounded-xl text-xs font-semibold transition-colors"
            >
              Sign In Again
            </button>
            <button
              onClick={fetchDoctorSession}
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

  const isPendingVerification = doctorUser?.doctorVerificationStatus === "PENDING";
  const doctorName = doctorUser?.name || "Medical Practitioner";
  const doctorId = doctorUser?.doctorId || "D-PENDING";
  const licenseNumber = doctorUser?.medicalLicenseNumber || "Not recorded";
  const specialty = doctorUser?.specialization || "General Medicine";
  const hospital = doctorUser?.hospitalAffiliation || "Affiliated Hospital";

  return (
    <div className="min-h-screen bg-[#F7F9FB] text-[#0F172A] font-sans antialiased flex flex-col">
      {/* Top Clinical Header */}
      <header className="bg-white border-b border-[#DCE4ED] sticky top-0 z-30 h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/doctor/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#2F7D78] text-white flex items-center justify-center shadow-xs">
                <Stethoscope className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-semibold text-base text-[#2F7D78] tracking-tight">
                Patient-Centric DMR
              </span>
            </Link>

            <div className="hidden sm:flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#DCE4ED]">
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

          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-[#0F172A]">{doctorName}</p>
              <p className="text-[11px] font-mono text-[#2F7D78] font-medium">{doctorId}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE4ED] text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Doctor Profile Banner Card */}
        <section className="bg-white rounded-xl p-6 sm:p-7 border border-[#DCE4ED] shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center shrink-0 shadow-xs">
                <Stethoscope className="w-8 h-8 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">{doctorName}</h1>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      isPendingVerification
                        ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                        : "bg-[#E8F6F4] text-[#2F7D78] border-[#A7E9DF]"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {isPendingVerification ? "Verification Pending" : "Verified Practitioner"}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#64748B] font-medium flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-[#2F7D78]" />
                    {specialty}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#2F7D78]" />
                    {hospital}
                  </span>
                  <span className="flex items-center gap-1 text-[#475569]">
                    <IdCard className="w-3.5 h-3.5 text-[#2F7D78]" />
                    Reg No: <span className="font-mono">{licenseNumber}</span>
                  </span>
                </p>
              </div>
            </div>

            {/* Persistent Doctor ID Card */}
            <div className="bg-[#F7F9FB] border border-[#DCE4ED] rounded-xl p-3.5 flex flex-col justify-between shrink-0 min-w-56">
              <div className="flex items-center justify-between text-xs text-[#64748B] mb-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-[#2F7D78]">
                  Doctor Identifier
                </span>
                <span className="text-[10px] bg-[#E8F6F4] text-[#2F7D78] px-1.5 py-0.5 rounded font-mono font-semibold">
                  Permanent
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-mono font-extrabold tracking-wide text-[#0F172A]">{doctorId}</span>
                <button
                  onClick={handleCopyDoctorId}
                  title="Copy Doctor ID"
                  className="p-1.5 rounded-lg bg-white hover:bg-[#E8F6F4] text-[#2F7D78] border border-[#DCE4ED] transition-colors"
                >
                  {copiedDoctorId ? <Check className="w-4 h-4 text-[#2F7D78]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Pending verification advisory banner */}
          {isPendingVerification && (
            <div className="mt-6 pt-4 border-t border-[#DCE4ED] flex items-start gap-2.5 text-xs text-[#92400E] bg-[#FFFBEB] rounded-xl p-3 border border-[#FDE68A]">
              <AlertCircle className="w-4 h-4 text-[#92400E] shrink-0 mt-0.5" />
              <p>
                <strong className="text-[#0F172A]">Credentials Review Pending:</strong> Your account registration has been
                recorded. State Medical Council validation is currently processing. You can request patient access; full
                clinical record review requires confirmed patient consent.
              </p>
            </div>
          )}
        </section>

        {/* Practice KPI Summary Cards (dynamically computed from real database records) */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Active Consultations</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">
                {recentRequests.filter((r) => r.status === "APPROVED").length}
              </h3>
              <p className="text-[11px] text-[#2F7D78] font-medium mt-0.5">Authorized medical records accessible</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Pending Authorizations</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">
                {recentRequests.filter((r) => r.status === "PENDING").length}
              </h3>
              <p className="text-[11px] text-[#92400E] font-medium mt-0.5">Awaiting patient consent response</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#FFFBEB] text-[#92400E] flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Total Directory Queries</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">
                {recentRequests.length}
              </h3>
              <p className="text-[11px] text-[#64748B] font-medium mt-0.5">Audit-logged patient access requests</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#F1F5F9] text-[#475569] flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* Patient Lookup Section */}
        <section className="bg-white rounded-xl border border-[#DCE4ED] shadow-xs overflow-hidden">
          <div className="p-6 border-b border-[#DCE4ED]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-[#E8F6F4] text-[#2F7D78] flex items-center justify-center">
                <Search className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A]">Patient Directory Lookup</h2>
            </div>
            <p className="text-xs text-[#64748B]">
              Query registered patient accounts by their official permanent identifier starting with{" "}
              <code className="bg-[#F1F5F9] text-[#0F172A] border border-[#DCE4ED] px-1 py-0.5 rounded font-mono font-bold">P-</code> to review
              identity and request consent.
            </p>
          </div>

          {/* Lookup Input Form */}
          <div className="p-6 bg-[#F8FAFC]">
            <form onSubmit={handleLookupPatient} className="max-w-2xl space-y-4">
              <div>
                <label htmlFor="patientId" className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Patient ID <span className="text-[#DC2626]">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                      <IdCard className="w-4 h-4" />
                    </div>
                    <input
                      id="patientId"
                      type="text"
                      value={patientIdInput}
                      onChange={(e) => setPatientIdInput(e.target.value)}
                      placeholder="e.g. P-829017616"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#DCE4ED] rounded-xl text-sm font-mono text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-sans focus:outline-hidden focus:ring-2 focus:ring-[#2F7D78] focus:border-transparent transition-all shadow-xs uppercase"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={lookupState === "loading"}
                      className="w-full sm:w-auto px-5 py-2.5 bg-[#2F7D78] hover:bg-[#256B66] disabled:bg-[#2F7D78]/60 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
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
                        className="px-3 py-2.5 bg-white hover:bg-[#F1F5F9] border border-[#DCE4ED] text-[#475569] rounded-xl text-xs font-medium transition-colors"
                        title="Clear search"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1.5">
                  Accepts standard PharmaBrain patient identifiers beginning with <span className="font-mono font-semibold">P-</span>{" "}
                  (e.g., P-829017616).
                </p>
              </div>
            </form>
          </div>

          {/* Dynamic States Render Container */}
          <div className="p-6">
            {/* 1. IDLE STATE */}
            {lookupState === "idle" && (
              <div className="rounded-xl border border-dashed border-[#DCE4ED] p-8 text-center bg-[#F8FAFC]">
                <div className="w-12 h-12 rounded-full bg-[#E8F6F4] text-[#2F7D78] mx-auto flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 stroke-[2.2]" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A]">No Patient Queried Yet</h3>
                <p className="text-xs text-[#64748B] max-w-md mx-auto mt-1">
                  Enter a valid Patient ID in the search box above to verify identity and check clinical consent status.
                </p>
              </div>
            )}

            {/* 2. LOADING STATE */}
            {lookupState === "loading" && (
              <div className="rounded-xl border border-[#A7E9DF] p-8 text-center bg-[#E8F6F4]/40">
                <div className="w-10 h-10 border-3 border-[#2F7D78] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <h3 className="text-sm font-bold text-[#0F172A]">Searching Hospital Registry...</h3>
                <p className="text-xs text-[#2F7D78] mt-1">
                  Querying verified patient registry for ID:{" "}
                  <span className="font-mono font-bold text-[#0F172A]">{patientIdInput}</span>
                </p>
              </div>
            )}
            {/* 3. INVALID ID STATE */}
            {lookupState === "invalid-id" && (
              <div className="rounded-xl border border-[#FDE68A] p-5 bg-[#FFFBEB] flex items-start gap-3.5">
                <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-[#92400E]">Invalid Patient ID Format</h3>
                  <p className="text-xs text-[#B45309] mt-1 leading-relaxed">
                    {errorMessage ||
                      'Patient IDs must begin with "P-" followed by the assigned identification sequence (e.g., P-829017616).'}
                  </p>
                </div>
              </div>
            )}

            {/* 4. PATIENT NOT FOUND STATE */}
            {lookupState === "not-found" && (
              <div className="rounded-xl border border-[#DCE4ED] p-5 bg-[#F8FAFC] flex items-start gap-3.5">
                <AlertCircle className="w-5 h-5 text-[#64748B] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Patient Not Found in Directory</h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    {errorMessage ||
                      `No registered patient record was found matching ID "${patientIdInput}". Please confirm the ID directly with the patient.`}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-2 font-medium">
                    Note: Unregistered individuals must complete patient onboarding before their records can be queried.
                  </p>
                </div>
              </div>
            )}

            {/* 5. UNAUTHORIZED STATE */}
            {lookupState === "unauthorized" && (
              <div className="rounded-xl border border-[#FECACA] p-5 bg-[#FEF2F2] flex items-start gap-3.5">
                <Lock className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-[#991B1B]">Unauthorized Session</h3>
                  <p className="text-xs text-[#7F1D1D] mt-1 leading-relaxed">
                    {errorMessage || "You must be signed in with an active Doctor account to perform patient lookups."}
                  </p>
                  <button
                    onClick={() => router.push("/auth/doctor/login")}
                    className="mt-3 px-3.5 py-1.5 bg-[#DC2626] text-white rounded-lg text-xs font-semibold hover:bg-[#B91C1C] transition-colors shadow-xs"
                  >
                    Return to Doctor Login
                  </button>
                </div>
              </div>
            )}

            {/* 6. GENERIC ERROR STATE WITH RETRY */}
            {lookupState === "error" && (
              <div className="rounded-xl border border-[#FECACA] p-5 bg-[#FEF2F2] flex items-start justify-between gap-3.5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-[#991B1B]">Directory Lookup Error</h3>
                    <p className="text-xs text-[#7F1D1D] mt-1">{errorMessage || "An unexpected error occurred while communicating with the patient directory."}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLookupPatient}
                  className="px-3 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* 7. SUCCESS STATE (PATIENT FOUND IN REAL DB) */}
            {lookupState === "success" && locatedPatient && (
              <div className="space-y-4">
                {requestSuccessMessage && (
                  <div className="rounded-xl border border-[#A7E9DF] bg-[#E8F6F4] p-4 text-xs font-semibold text-[#2F7D78] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2F7D78] shrink-0" />
                    <span>{requestSuccessMessage}</span>
                  </div>
                )}

                {/* Patient Identity Confirmation Card */}
                <div className="rounded-xl border border-[#DCE4ED] bg-white p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-[#2F7D78] text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                        {locatedPatient.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#0F172A]">{locatedPatient.name}</h3>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#2F7D78] border border-[#A7E9DF]">
                            <ShieldCheck className="w-3 h-3 text-[#2F7D78]" />
                            Directory Verified
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] font-mono mt-0.5">
                          ID: <strong className="text-[#2F7D78]">{locatedPatient.patientId}</strong>
                          {locatedPatient.legacyPatientId && (
                            <span className="text-[#94A3B8] ml-2">
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
        <section className="bg-white rounded-xl border border-[#DCE4ED] shadow-xs overflow-hidden">
          <div className="p-6 border-b border-[#DCE4ED] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Patient Access Requests & Active Consultations</h2>
              <p className="text-xs text-[#64748B]">
                Audit trail of clinical access requests initiated from your doctor account.
              </p>
            </div>
            <button
              onClick={fetchRecentRequests}
              disabled={loadingRequests}
              className="text-xs text-[#2F7D78] hover:text-[#256B66] font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE4ED] hover:bg-[#F1F5F9] transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loadingRequests ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="p-6">
            {loadingRequests ? (
              <div className="py-8 text-center text-xs text-[#64748B] flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-[#2F7D78] border-t-transparent rounded-full animate-spin" />
                <span>Loading access records from hospital database...</span>
              </div>
            ) : requestsError ? (
              <div className="rounded-xl border border-[#FECACA] p-5 bg-[#FEF2F2] flex items-start justify-between gap-3.5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-[#991B1B]">Failed to Load Clinical Requests</h3>
                    <p className="text-xs text-[#7F1D1D] mt-1">{requestsError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchRecentRequests}
                  className="px-3 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="py-8 text-center bg-[#F7F9FB] rounded-xl border border-dashed border-[#DCE4ED]">
                <p className="text-xs text-[#0F172A] font-semibold">No clinical access requests on record yet.</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Use the directory search above to find patients and request clinical consultation access.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#DCE4ED] text-[#64748B] uppercase tracking-wider font-bold text-[10px]">
                      <th className="py-3 px-3">Patient</th>
                      <th className="py-3 px-3">Patient ID</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Requested At</th>
                      <th className="py-3 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE4ED]">
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
                              className="px-3 py-1.5 bg-[#2F7D78] hover:bg-[#256B66] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
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

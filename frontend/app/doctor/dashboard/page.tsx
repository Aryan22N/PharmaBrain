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

/* ---------- UI-only helpers (no business logic) ---------- */

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap');";

const serif = { fontFamily: "'Source Serif 4', Georgia, serif" } as const;
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace" } as const;

const TONES = {
  amber: { box: "bg-[#FBF3DF] border-[#E8D49A]", icon: "text-[#8A5A00]", title: "text-[#5E3D00]", text: "text-[#6F4B08]" },
  red: { box: "bg-[#FBE9E7] border-[#EAB8B2]", icon: "text-[#A32A2A]", title: "text-[#7A1F1F]", text: "text-[#8A2B2B]" },
  slate: { box: "bg-white border-[#D9DDD6]", icon: "text-[#5F6B72]", title: "text-[#12202B]", text: "text-[#5F6B72]" },
} as const;

function Notice({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`rounded-md border-l-4 border ${t.box} p-4 flex items-start justify-between gap-4`}>
      <div className="flex items-start gap-3">
        <span className={`${t.icon} mt-0.5 shrink-0`}>{icon}</span>
        <div>
          <h3 className={`text-sm font-semibold ${t.title}`}>{title}</h3>
          <p className={`text-sm mt-0.5 leading-relaxed ${t.text}`}>{children}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: "bg-[#DDEFE9] text-[#0F5A4A]",
    PENDING: "bg-[#FBF3DF] text-[#6F4B08]",
    REVOKED: "bg-[#FBE9E7] text-[#8A2B2B]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${map[status] || "bg-[#ECEEEA] text-[#3B464D]"}`}>
      {status === "APPROVED" && <CheckCircle2 className="w-3.5 h-3.5" />}
      {status === "PENDING" && <Clock className="w-3.5 h-3.5" />}
      {status === "REVOKED" && <XCircle className="w-3.5 h-3.5" />}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

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
    } catch { }
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

  /* ---------- Loading / session error screens ---------- */

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F2] flex flex-col items-center justify-center p-4" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <div className="w-10 h-10 border-[3px] border-[#17635E] border-t-transparent rounded-full animate-spin mb-5" />
        <h2 className="text-xl text-[#12202B]" style={serif}>Opening your portal</h2>
        <p className="text-sm text-[#5F6B72] mt-1">Checking your credentials and directory access.</p>
      </div>
    );
  }

  if (sessionError && !doctorUser) {
    return (
      <div className="min-h-screen bg-[#F4F5F2] flex flex-col items-center justify-center p-4" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <div className="max-w-md w-full bg-white border border-[#D9DDD6] rounded-lg p-8">
          <div className="w-10 h-10 rounded-md bg-[#FBE9E7] text-[#A32A2A] flex items-center justify-center mb-4">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-xl text-[#12202B]" style={serif}>We couldn’t open the doctor portal</h2>
          <p className="text-sm text-[#5F6B72] mt-2 leading-relaxed">{sessionError}</p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={fetchDoctorSession}
              className="px-4 py-2 bg-[#17635E] hover:bg-[#0F4F4B] text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17635E]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Try again</span>
            </button>
            <button
              onClick={() => router.push("/auth/doctor/login")}
              className="px-4 py-2 border border-[#C5CBC3] hover:bg-[#F4F5F2] text-[#12202B] rounded-md text-sm font-medium transition-colors"
            >
              Sign in again
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

  const approvedCount = recentRequests.filter((r) => r.status === "APPROVED").length;
  const pendingCount = recentRequests.filter((r) => r.status === "PENDING").length;

  return (
    <div
      className="min-h-screen bg-[#F4F5F2] text-[#12202B] antialiased flex flex-col"
      style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <style>{FONT_IMPORT}</style>

      {/* Header */}
      <header className="bg-white border-b border-[#D9DDD6] sticky top-0 z-30 h-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          <Link href="/doctor/dashboard" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-[#17635E] text-white flex items-center justify-center">
              <Stethoscope className="w-[18px] h-[18px]" />
            </span>
            <span className="text-lg text-[#12202B]" style={serif}>Patient-Centric DMR</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block leading-tight">
              <p className="text-sm font-medium">{doctorName}</p>
              <p className="text-xs text-[#17635E]" style={mono}>{doctorId}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#C5CBC3] text-sm font-medium text-[#12202B] hover:bg-[#F4F5F2] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17635E]"
            >
              <LogOut className="w-4 h-4 text-[#5F6B72]" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Practitioner profile */}
        <section>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl sm:text-4xl tracking-tight" style={serif}>{doctorName}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isPendingVerification ? "bg-[#FBF3DF] text-[#6F4B08]" : "bg-[#DDEFE9] text-[#0F5A4A]"
                    }`}
                >
                  {isPendingVerification ? <Clock className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  {isPendingVerification ? "Verification pending" : "Verified practitioner"}
                </span>
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-[#5F6B72]">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#17635E]" />
                  <dt className="sr-only">Specialty</dt>
                  <dd>{specialty}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#17635E]" />
                  <dt className="sr-only">Hospital</dt>
                  <dd>{hospital}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <IdCard className="w-4 h-4 text-[#17635E]" />
                  <dt>Reg. no.</dt>
                  <dd className="text-[#12202B]" style={mono}>{licenseNumber}</dd>
                </div>
              </dl>
            </div>

            <div className="flex items-center gap-3 border border-[#D9DDD6] bg-white rounded-md pl-4 pr-2 py-2 self-start md:self-auto">
              <div className="leading-tight">
                <p className="text-xs text-[#5F6B72]">Your doctor ID</p>
                <p className="text-lg font-semibold" style={mono}>{doctorId}</p>
              </div>
              <button
                onClick={handleCopyDoctorId}
                title="Copy doctor ID"
                aria-label="Copy doctor ID"
                className="p-2 rounded-md hover:bg-[#E3EFEC] text-[#17635E] transition-colors focus-visible:outline-2 focus-visible:outline-[#17635E]"
              >
                {copiedDoctorId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isPendingVerification && (
            <div className="mt-5">
              <Notice tone="amber" icon={<AlertCircle className="w-5 h-5" />} title="Credential review in progress">
                Your registration is recorded and the State Medical Council is validating it. You can request patient
                access now, but viewing full records still needs the patient’s consent.
              </Notice>
            </div>
          )}
        </section>

        {/* Practice summary: one strip, not three cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#D9DDD6] rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-[#D9DDD6]">
          {[
            { label: "Active consultations", value: approvedCount, note: "Records you can open", icon: <CheckCircle2 className="w-5 h-5 text-[#17635E]" /> },
            { label: "Awaiting patient consent", value: pendingCount, note: "Requests not yet answered", icon: <Clock className="w-5 h-5 text-[#8A5A00]" /> },
            { label: "Access requests sent", value: recentRequests.length, note: "All logged for audit", icon: <FileText className="w-5 h-5 text-[#5F6B72]" /> },
          ].map((s) => (
            <div key={s.label} className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[#5F6B72]">{s.label}</p>
                <p className="text-4xl mt-1 leading-none" style={serif}>{s.value}</p>
                <p className="text-xs text-[#5F6B72] mt-2">{s.note}</p>
              </div>
              {s.icon}
            </div>
          ))}
        </section>

        {/* Patient lookup: the one bold element */}
        <section className="rounded-lg overflow-hidden border border-[#D9DDD6] bg-white">
          <div className="bg-[#0F2E2C] text-white p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl tracking-tight" style={serif}>Find a patient</h2>
            <p className="text-sm text-[#B8D3CF] mt-1.5 max-w-xl leading-relaxed">
              Enter the patient’s permanent ID (it starts with <span style={mono}>P-</span>) to confirm who they are and
              ask for access to their records.
            </p>

            <form onSubmit={handleLookupPatient} className="mt-6 max-w-2xl">
              <label htmlFor="patientId" className="block text-sm font-medium mb-2">Patient ID</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <IdCard className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#6B8E8A] pointer-events-none" />
                  <input
                    id="patientId"
                    type="text"
                    value={patientIdInput}
                    onChange={(e) => setPatientIdInput(e.target.value)}
                    placeholder="P-829017616"
                    className="w-full h-12 pl-12 pr-4 bg-white text-[#12202B] rounded-md text-lg uppercase placeholder:text-[#9AA5A3] focus:outline-none focus:ring-2 focus:ring-[#7FD1C7]"
                    style={mono}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={lookupState === "loading"}
                    className="h-12 flex-1 sm:flex-none px-6 bg-[#7FD1C7] hover:bg-[#9ADED5] disabled:opacity-60 text-[#0F2E2C] text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {lookupState === "loading" ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#0F2E2C] border-t-transparent rounded-full animate-spin" />
                        <span>Searching</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Search patient</span>
                      </>
                    )}
                  </button>
                  {lookupState !== "idle" && (
                    <button
                      type="button"
                      onClick={handleResetLookup}
                      className="h-12 w-12 flex items-center justify-center border border-[#3F6561] hover:bg-[#1A433F] text-white rounded-md transition-colors"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Results */}
          <div className="p-6 sm:p-8 bg-[#FAFBF9]">
            {lookupState === "idle" && (
              <p className="text-sm text-[#5F6B72]">
                Results appear here. You’ll see the patient’s identity and whether you already have their consent.
              </p>
            )}

            {lookupState === "loading" && (
              <div className="flex items-center gap-3 text-sm text-[#5F6B72]">
                <div className="w-5 h-5 border-2 border-[#17635E] border-t-transparent rounded-full animate-spin" />
                <span>
                  Searching the registry for <span className="text-[#12202B] font-semibold" style={mono}>{patientIdInput}</span>
                </span>
              </div>
            )}

            {lookupState === "invalid-id" && (
              <Notice tone="amber" icon={<AlertTriangle className="w-5 h-5" />} title="That ID doesn’t look right">
                {errorMessage || 'Patient IDs start with "P-" followed by the assigned number, for example P-829017616.'}
              </Notice>
            )}

            {lookupState === "not-found" && (
              <Notice tone="slate" icon={<AlertCircle className="w-5 h-5" />} title="No patient with that ID">
                {errorMessage || `We couldn’t find "${patientIdInput}". Check the ID with the patient.`} Patients must finish
                onboarding before their records can be searched.
              </Notice>
            )}

            {lookupState === "unauthorized" && (
              <Notice
                tone="red"
                icon={<Lock className="w-5 h-5" />}
                title="Your session isn’t authorized"
                action={
                  <button
                    onClick={() => router.push("/auth/doctor/login")}
                    className="shrink-0 px-3.5 py-1.5 bg-[#A32A2A] hover:bg-[#8A2222] text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Sign in
                  </button>
                }
              >
                {errorMessage || "Sign in with an active doctor account to search for patients."}
              </Notice>
            )}

            {lookupState === "error" && (
              <Notice
                tone="red"
                icon={<AlertCircle className="w-5 h-5" />}
                title="The search didn’t go through"
                action={
                  <button
                    type="button"
                    onClick={handleLookupPatient}
                    className="shrink-0 px-3.5 py-1.5 bg-[#A32A2A] hover:bg-[#8A2222] text-white rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try again</span>
                  </button>
                }
              >
                {errorMessage || "Something went wrong reaching the patient directory."}
              </Notice>
            )}

            {lookupState === "success" && locatedPatient && (
              <div className="space-y-5">
                {requestSuccessMessage && (
                  <div className="rounded-md bg-[#DDEFE9] text-[#0F5A4A] px-4 py-3 text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{requestSuccessMessage}</span>
                  </div>
                )}

                {/* Patient identity */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#17635E] text-white flex items-center justify-center text-lg font-semibold shrink-0" style={serif}>
                      {locatedPatient.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl leading-tight" style={serif}>{locatedPatient.name}</h3>
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#DDEFE9] text-[#0F5A4A]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Identity verified
                        </span>
                      </div>
                      <p className="text-sm text-[#5F6B72] mt-1" style={mono}>
                        <span className="text-[#17635E] font-semibold">{locatedPatient.patientId}</span>
                        {locatedPatient.legacyPatientId && <span className="ml-3">Legacy {locatedPatient.legacyPatientId}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-[#5F6B72] sm:text-right">
                    <p>Registered</p>
                    <p className="flex items-center gap-1.5 sm:justify-end text-[#12202B]">
                      <Calendar className="w-4 h-4 text-[#5F6B72]" />
                      {new Date(locatedPatient.accountRegisteredAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Consent status */}
                {authorizationInfo?.hasClinicalAccess ? (
                  <div className="rounded-md border border-[#9CD3C3] border-l-4 border-l-[#17635E] bg-[#EAF5F1] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-[#17635E] shrink-0" />
                      <div>
                        <h4 className="text-base font-semibold text-[#0C3D36]">
                          Access granted <span className="font-normal text-[#0F5A4A]">· active</span>
                        </h4>
                        <p className="text-sm text-[#0F5A4A] mt-0.5 leading-relaxed">
                          {authorizationInfo.message ||
                            "You can review this patient’s medical history, prescriptions and health trends."}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/doctor/patients/${locatedPatient.patientId}`)}
                      className="px-5 py-2.5 bg-[#17635E] hover:bg-[#0F4F4B] text-white rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17635E]"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Open medical dossier</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-md border border-[#E8D49A] border-l-4 border-l-[#C58A12] bg-[#FBF3DF] p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <Lock className="w-5 h-5 text-[#8A5A00] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-[#5E3D00]">Records are locked</h4>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${authorizationInfo?.status === "PENDING"
                              ? "bg-[#F3DFA6] text-[#5E3D00]"
                              : authorizationInfo?.status === "REVOKED"
                                ? "bg-[#F4CBC6] text-[#7A1F1F]"
                                : "bg-[#E4E7E2] text-[#3B464D]"
                              }`}
                          >
                            {authorizationInfo?.status
                              ? authorizationInfo.status.charAt(0) + authorizationInfo.status.slice(1).toLowerCase()
                              : "Consent needed"}
                          </span>
                        </div>
                        <p className="text-sm text-[#6F4B08] mt-1 leading-relaxed max-w-2xl">
                          {authorizationInfo?.message ||
                            "Prescriptions, lab results and medication history stay hidden until the patient consents or authorizes a transfer."}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E8D49A]">
                      <span className="text-sm text-[#6F4B08] flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        Nothing can be viewed without the patient’s authorization.
                      </span>

                      {authorizationInfo?.status === "PENDING" ? (
                        <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#F3DFA6] text-[#5E3D00] rounded-md text-sm font-medium">
                          <Clock className="w-4 h-4" />
                          <span>Waiting for the patient to respond</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleRequestAccess}
                          disabled={requestingAccess}
                          className="px-5 py-2.5 bg-[#12202B] hover:bg-[#1E3242] disabled:opacity-60 text-white rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12202B]"
                        >
                          {requestingAccess ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Sending request</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              <span>Request access</span>
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

        {/* Access requests */}
        <section>
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <h2 className="text-2xl tracking-tight" style={serif}>Your access requests</h2>
              <p className="text-sm text-[#5F6B72] mt-0.5">Every request you’ve sent, with its current status.</p>
            </div>
            <button
              onClick={fetchRecentRequests}
              disabled={loadingRequests}
              className="text-sm text-[#17635E] hover:bg-[#E3EFEC] font-medium flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#C5CBC3] transition-colors"
            >
              <RotateCcw className={`w-4 h-4 ${loadingRequests ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="bg-white border border-[#D9DDD6] rounded-lg overflow-hidden">
            {loadingRequests ? (
              <div className="py-10 text-center text-sm text-[#5F6B72] flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#17635E] border-t-transparent rounded-full animate-spin" />
                <span>Loading your requests…</span>
              </div>
            ) : requestsError ? (
              <div className="p-4">
                <Notice
                  tone="red"
                  icon={<AlertTriangle className="w-5 h-5" />}
                  title="Couldn’t load your requests"
                  action={
                    <button
                      type="button"
                      onClick={fetchRecentRequests}
                      className="shrink-0 px-3.5 py-1.5 bg-[#A32A2A] hover:bg-[#8A2222] text-white rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Try again</span>
                    </button>
                  }
                >
                  {requestsError}
                </Notice>
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <p className="text-base" style={serif}>No requests yet</p>
                <p className="text-sm text-[#5F6B72] mt-1">Search for a patient above to send your first access request.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-[#F4F5F2] text-[#5F6B72] text-xs font-medium">
                      <th className="py-3 px-5 font-medium">Patient</th>
                      <th className="py-3 px-5 font-medium">Patient ID</th>
                      <th className="py-3 px-5 font-medium">Status</th>
                      <th className="py-3 px-5 font-medium">Requested</th>
                      <th className="py-3 px-5 font-medium text-right">Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7E2]">
                    {recentRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-[#FAFBF9] transition-colors">
                        <td className="py-3.5 px-5 font-medium">{req.patientName}</td>
                        <td className="py-3.5 px-5 text-[#5F6B72]" style={mono}>{req.patientCode}</td>
                        <td className="py-3.5 px-5"><StatusPill status={req.status} /></td>
                        <td className="py-3.5 px-5 text-[#5F6B72]">
                          {new Date(req.requestedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {req.status === "APPROVED" ? (
                            <button
                              onClick={() => router.push(`/doctor/patients/${req.patientCode}`)}
                              className="px-3.5 py-1.5 bg-[#17635E] hover:bg-[#0F4F4B] text-white rounded-md text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                            >
                              <span>View records</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#7A858B]">
                              <Lock className="w-3.5 h-3.5" />
                              Locked
                            </span>
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

        <footer className="pt-2 pb-8 text-xs text-[#7A858B] leading-relaxed max-w-2xl">
          <p>PharmaBrain Clinical Review System, for licensed medical practitioners only.</p>
          <p>Every directory search is logged, and viewing any clinical record requires the patient’s confirmed authorization.</p>
        </footer>
      </main>
    </div>
  );
}
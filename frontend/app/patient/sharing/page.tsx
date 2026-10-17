"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Stethoscope,
  Building2,
  Award,
  UserCheck,
  UserX,
  Lock,
  Timer,
  Sparkles,
  ShieldAlert,
  Info,
  Check,
  Zap,
} from "lucide-react";
import type { PatientAccessRequest } from "@/lib/types";

// Auto-revoke preset durations with clinical guidance
const DURATION_PRESETS = [
  {
    days: 3,
    label: "3 Days",
    title: "Rapid / Urgent Care",
    badge: "Short Term",
    description: "Best for emergency visits, single second opinions, or urgent triage checks.",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    days: 8,
    label: "8 Days",
    title: "Standard Follow-up",
    badge: "Recommended",
    description: "Ideal for acute recovery, lab report analysis, and routine prescription follow-ups.",
    badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
    isRecommended: true,
  },
  {
    days: 30,
    label: "30 Days",
    title: "Comprehensive Care",
    badge: "Extended",
    description: "Designed for chronic condition monitoring, post-operative healing, or therapy.",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
];

export default function PatientSharingPage() {
  const [requests, setRequests] = useState<PatientAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Global default auto-revoke duration preference (default: 8 days)
  const [defaultDuration, setDefaultDuration] = useState<number>(8);

  // Per-pending-request duration override: { [requestId: number]: number }
  const [pendingDurations, setPendingDurations] = useState<Record<number, number>>({});

  // Active authorization inline editing for changing duration
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [adjustingDays, setAdjustingDays] = useState<number>(8);

  // Load default duration preference from DB profile (and localStorage fallback)
  useEffect(() => {
    let isMounted = true;
    const loadProfilePreference = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        const res = await fetch("/api/user/profile", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.defaultAutoRevokeDays && [3, 8, 30].includes(data.defaultAutoRevokeDays)) {
            setDefaultDuration(data.defaultAutoRevokeDays);
            if (typeof window !== "undefined") {
              localStorage.setItem("patient_default_access_days", data.defaultAutoRevokeDays.toString());
            }
            return;
          }
        }
      } catch {
        // Fallback to localStorage
      }
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("patient_default_access_days");
        if (saved) {
          const parsed = parseInt(saved, 10);
          if ([3, 8, 30].includes(parsed)) {
            setDefaultDuration(parsed);
          }
        }
      }
    };
    void loadProfilePreference();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSetDefaultDuration = async (days: number) => {
    setDefaultDuration(days);
    if (typeof window !== "undefined") {
      localStorage.setItem("patient_default_access_days", days.toString());
    }
    setBannerMessage({
      type: "success",
      text: `Default auto-revoke duration set to ${days} days. Saved to your profile.`,
    });
    // Persist to DB via profile API
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ defaultAutoRevokeDays: days }),
      });
    } catch {
      // Offline fallback preserved in localStorage
    }
  };

  const fetchRequests = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch("/api/patient/access-requests", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        if (data.requests) {
          setRequests(data.requests);
        }
      }
    } catch {
      // Ignore background fetch error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        const res = await fetch("/api/patient/access-requests", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.requests) {
            setRequests(data.requests);
          }
        }
      } catch {
        // Ignore background fetch error
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRespond = async (requestId: number, decision: "APPROVE" | "REJECT", customDuration?: number) => {
    try {
      setActionLoadingId(requestId);
      setBannerMessage(null);
      const token = localStorage.getItem("auth_token");
      const durationDays = customDuration ?? pendingDurations[requestId] ?? defaultDuration;

      const res = await fetch(`/api/patient/access-requests/${requestId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ decision, durationDays }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({ type: "error", text: data.error || "Failed to respond to request." });
        return;
      }

      setBannerMessage({
        type: "success",
        text: data.message || `Access request ${decision.toLowerCase()}d successfully.`,
      });
      fetchRequests();
    } catch (err: unknown) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Network error occurred.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (requestId: number) => {
    if (!confirm("Are you sure you want to revoke this doctor's access to your medical records immediately?")) {
      return;
    }
    try {
      setActionLoadingId(requestId);
      setBannerMessage(null);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/patient/access-requests/${requestId}/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({ type: "error", text: data.error || "Failed to revoke access." });
        return;
      }

      setBannerMessage({
        type: "success",
        text: data.message || "Clinical access revoked immediately.",
      });
      fetchRequests();
    } catch (err: unknown) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Network error occurred.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateDuration = async (requestId: number, durationDays: number) => {
    try {
      setActionLoadingId(requestId);
      setBannerMessage(null);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/patient/access-requests/${requestId}/duration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ durationDays }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({ type: "error", text: data.error || "Failed to update duration." });
        return;
      }

      setBannerMessage({
        type: "success",
        text: data.message || `Auto-revoke timer updated to ${durationDays} days.`,
      });
      setAdjustingId(null);
      fetchRequests();
    } catch (err: unknown) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Network error occurred.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (activeAuthorizations.length === 0) return;
    if (!confirm(`Are you sure you want to revoke access for all ${activeAuthorizations.length} active doctors right now?`)) {
      return;
    }

    try {
      setLoading(true);
      for (const auth of activeAuthorizations) {
        const token = localStorage.getItem("auth_token");
        await fetch(`/api/patient/access-requests/${auth.id}/revoke`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      }
      setBannerMessage({
        type: "success",
        text: "Emergency revoke complete: All active doctor authorizations have been terminated.",
      });
      fetchRequests();
    } catch {
      setBannerMessage({
        type: "error",
        text: "Error revoking some authorizations. Please refresh and check.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate days remaining from DB expiresAt
  const getDaysRemaining = (expiresAt?: string | null) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    if (diffTime <= 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Dynamically calculate preview dates relative to current date
  const getPreviewDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const activeAuthorizations = requests.filter((r) => r.status === "APPROVED");
  const pastRequests = requests.filter((r) => r.status === "REJECTED" || r.status === "REVOKED");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Doctor Access & Clinical Consent
            </h1>
            <span className="text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              HIPAA Privacy Controls
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 max-w-2xl">
            You hold total authority over your medical dossier. Authorize verified practitioners,
            configure automatic revocation deadlines, or revoke clinical visibility instantly.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh access records"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Banner Feedback Notification */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold border flex items-center justify-between gap-3 transition-all ${
            bannerMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {bannerMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-[11px] underline opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Metrics Ribbon (4 Real Cards from DB) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 leading-tight">
              {activeAuthorizations.length}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Active Doctors</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 leading-tight">
              {pendingRequests.length}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Pending Requests</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
            <Timer className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 leading-tight">
              {defaultDuration} Days
            </div>
            <div className="text-[11px] font-medium text-slate-500">Auto-Revoke Default</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
            <Lock className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 leading-tight">
              {pastRequests.length}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Revoked / Past Logs</div>
          </div>
        </div>
      </div>

      {/* Auto-Revoke Policy Control Card (Interactive Duration Selector) */}
      <section className="bg-gradient-to-br from-white via-slate-50/50 to-teal-50/30 rounded-2xl border border-teal-100/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/70">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-600/20">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Automated Consent Expiration & Auto-Revoke
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Patient Safety
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Set how long doctor permissions remain active before they are automatically revoked by the system.
                Select your preferred default policy below:
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-teal-600" />
              Active Policy: <strong>{defaultDuration} Days</strong>
            </span>
          </div>
        </div>

        {/* 3, 8, 30 Days Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
          {DURATION_PRESETS.map((preset) => {
            const isSelected = defaultDuration === preset.days;
            return (
              <div
                key={preset.days}
                onClick={() => handleSetDefaultDuration(preset.days)}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                  isSelected
                    ? "bg-white border-teal-600 shadow-sm ring-2 ring-teal-600/20"
                    : "bg-white/70 hover:bg-white border-slate-200/90 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${preset.badgeClass}`}
                    >
                      {preset.badge}
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-teal-600 border-teal-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-slate-900">{preset.label}</span>
                    <span className="text-xs font-medium text-slate-500">({preset.title})</span>
                  </div>

                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Revokes by:</span>
                  <strong className="text-slate-700 font-mono text-[10px]">
                    {getPreviewDate(preset.days)}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500 bg-teal-50/60 p-2.5 rounded-xl border border-teal-100">
          <Info className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            <strong>Zero Manual Effort:</strong> When this duration expires, doctor access cuts off immediately. You do not need to remember to revoke access manually.
          </span>
        </div>
      </section>

      {/* Main 2-Column Responsive Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Pending Requests & Active Authorizations */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Pending Doctor Consent Requests */}
          <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Pending Consent Requests ({pendingRequests.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Physicians requesting read permissions to inspect your prescription history.
                  </p>
                </div>
              </div>

              {pendingRequests.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Requires Review
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4 animate-spin text-teal-600" />
                <span>Loading pending requests...</span>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs text-slate-600 font-semibold">No pending doctor requests</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                  When a verified hospital physician searches for your Patient ID to provide consultation, their request will appear here with auto-revoke settings.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((req) => {
                  const selectedDays = pendingDurations[req.id] ?? defaultDuration;
                  return (
                    <div
                      key={req.id}
                      className="p-4 sm:p-5 rounded-xl border border-amber-200/90 bg-amber-50/30 hover:bg-amber-50/50 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                            <Stethoscope className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-sm font-bold text-slate-900">
                                {req.doctorName}
                              </strong>
                              <span className="font-mono text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                {req.doctorCode}
                              </span>
                            </div>
                            {(req.doctorSpecialization || req.doctorHospital) && (
                              <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                {req.doctorSpecialization && (
                                  <span className="flex items-center gap-1 font-medium text-slate-700">
                                    <Award className="w-3 h-3 text-slate-400" />
                                    {req.doctorSpecialization}
                                  </span>
                                )}
                                {req.doctorHospital && (
                                  <span className="flex items-center gap-1 text-slate-500">
                                    <Building2 className="w-3 h-3 text-slate-400" />
                                    {req.doctorHospital}
                                  </span>
                                )}
                              </div>
                            )}
                            {req.reason && (
                              <p className="text-[11px] text-slate-500 mt-1.5 italic bg-white/60 p-1.5 rounded border border-amber-100">
                                Clinical Purpose: {req.reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono self-start">
                          Requested: {new Date(req.requestedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Auto-Revoke Duration Selector for this Request */}
                      <div className="bg-white p-3 rounded-xl border border-amber-200/70 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-teal-600" />
                            Auto-Revoke Access After:
                          </span>
                          <span className="text-[11px] text-teal-700 font-medium">
                            Auto-revokes on <strong>{getPreviewDate(selectedDays)}</strong>
                          </span>
                        </div>

                        {/* Duration Pills */}
                        <div className="grid grid-cols-3 gap-2">
                          {[3, 8, 30].map((days) => {
                            const isChosen = selectedDays === days;
                            return (
                              <button
                                key={days}
                                type="button"
                                onClick={() =>
                                  setPendingDurations((prev) => ({ ...prev, [req.id]: days }))
                                }
                                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  isChosen
                                    ? "bg-teal-700 text-white border-teal-700 shadow-2xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {isChosen && <Check className="w-3 h-3 stroke-[3]" />}
                                <span>{days} Days</span>
                                {days === 8 && (
                                  <span className="text-[9px] opacity-80">(Recommended)</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-2.5 pt-1">
                        <button
                          onClick={() => handleRespond(req.id, "REJECT")}
                          disabled={actionLoadingId === req.id}
                          className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>

                        <button
                          onClick={() => handleRespond(req.id, "APPROVE", selectedDays)}
                          disabled={actionLoadingId === req.id}
                          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve for {selectedDays} Days</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 2: Active Doctor Authorizations */}
          <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Active Doctor Authorizations ({activeAuthorizations.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Clinicians currently granted temporary access to your timeline and prescriptions.
                  </p>
                </div>
              </div>

              {activeAuthorizations.length > 1 && (
                <button
                  onClick={handleRevokeAll}
                  className="text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Revoke All
                </button>
              )}
            </div>

            {activeAuthorizations.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs text-slate-600 font-semibold">No active doctor authorizations</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Your medical dossier is private. No doctors currently hold permission to view your records.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeAuthorizations.map((auth) => {
                  const daysRemaining = getDaysRemaining(auth.expiresAt);
                  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 2;
                  const isAdjusting = adjustingId === auth.id;

                  return (
                    <div key={auth.id} className="py-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-sm font-bold text-slate-900">
                                {auth.doctorName}
                              </strong>
                              <span className="font-mono text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                {auth.doctorCode}
                              </span>
                            </div>
                            {(auth.doctorSpecialization || auth.doctorHospital) && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {[auth.doctorSpecialization, auth.doctorHospital].filter(Boolean).join(" • ")}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              Authorized on: {new Date(auth.respondedAt || auth.requestedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Auto-Revoke Expiration Pill */}
                        <div className="flex flex-col sm:items-end gap-1.5 self-start sm:self-auto">
                          {auth.expiresAt ? (
                            <div
                              className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                                isExpiringSoon
                                  ? "bg-amber-50 text-amber-900 border-amber-300"
                                  : "bg-teal-50 text-teal-900 border-teal-200"
                              }`}
                            >
                              <Timer className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                              <span>
                                Auto-revokes in{" "}
                                <strong>
                                  {daysRemaining === 0 ? "Today" : `${daysRemaining} days`}
                                </strong>
                              </span>
                              <span className="text-[10px] opacity-70 font-mono">
                                ({new Date(auth.expiresAt).toLocaleDateString()})
                              </span>
                            </div>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Manual Revocation Only
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (isAdjusting) {
                                  setAdjustingId(null);
                                } else {
                                  setAdjustingId(auth.id);
                                  setAdjustingDays(auth.durationDays || 8);
                                }
                              }}
                              className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 underline cursor-pointer"
                            >
                              {isAdjusting ? "Cancel" : "Change Duration"}
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              onClick={() => handleRevoke(auth.id)}
                              disabled={actionLoadingId === auth.id}
                              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer disabled:opacity-50"
                            >
                              Revoke Now
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline Duration Adjustment Panel */}
                      {isAdjusting && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 mt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">
                              Update Auto-Revoke Duration:
                            </span>
                            <span className="text-[11px] text-teal-700">
                              New Expiry: <strong>{getPreviewDate(adjustingDays)}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {[3, 8, 30].map((days) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setAdjustingDays(days)}
                                className={`px-3 py-1 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                                  adjustingDays === days
                                    ? "bg-teal-700 text-white border-teal-700"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {days} Days
                              </button>
                            ))}

                            <button
                              onClick={() => handleUpdateDuration(auth.id, adjustingDays)}
                              disabled={actionLoadingId === auth.id}
                              className="ml-auto px-3 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Save Timer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 3: History & Revoked Access */}
          {pastRequests.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Access History & Revocation Logs ({pastRequests.length})
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Immutable record of expired authorizations and declined doctor requests.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                      <th className="py-2.5 px-3">Doctor</th>
                      <th className="py-2.5 px-3">Doctor ID</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Access Term</th>
                      <th className="py-2.5 px-3">Revoked Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pastRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {req.doctorName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{req.doctorCode}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === "REVOKED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500 font-mono">
                          {req.durationDays ? `${req.durationDays} Days` : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {new Date(
                            req.revokedAt || req.respondedAt || req.requestedAt
                          ).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Right Column (4 cols): Privacy Controls, Policy Guardrails & Tips */}
        <div className="lg:col-span-4 space-y-6">
          {/* Privacy Sovereign Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Patient Privacy Sovereign
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              No hospital, physician, or department can view your medical summary without your explicit authorization.
            </p>

            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-start gap-2 text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Automatic Expiration:</strong> Authorizations terminate automatically after 3, 8, or 30 days.
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Instant Cut-off:</strong> Revoking access instantly blocks doctor record inspection in real time.
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Audited Logs:</strong> All physician queries are permanently recorded for compliance.
                </span>
              </div>
            </div>
          </div>

          {/* Clinical Duration Recommendation Guide */}
          <div className="bg-gradient-to-br from-slate-50 to-teal-50/40 rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-bold text-slate-900">When to use which duration?</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>3 Days</span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Emergency</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ideal for one-time ER visits, urgent prescriptions, or second opinion consultations.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-teal-200">
                <div className="flex items-center justify-between font-bold text-teal-900">
                  <span>8 Days (Recommended)</span>
                  <span className="text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded font-bold">Standard</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Optimal window for pathology blood tests, diagnostic reviews, and 1-week follow-up checks.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>30 Days</span>
                  <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Continuous</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Reserved for ongoing chemotherapy, dialysis, post-op rehabilitation, or chronic illness.
                </p>
              </div>
            </div>
          </div>

          {/* Healthcare Governance Footer Note */}
          <footer className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 flex items-start gap-3">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong className="text-slate-700">Patient Rights:</strong> In accordance with national digital health standards, you may adjust auto-revoke periods or terminate authorizations at will without physician counter-approval.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

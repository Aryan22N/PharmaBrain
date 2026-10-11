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
} from "lucide-react";
import type { PatientAccessRequest } from "@/lib/types";

export default function PatientSharingPage() {
  const [requests, setRequests] = useState<PatientAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const handleRespond = async (requestId: number, decision: "APPROVE" | "REJECT") => {
    try {
      setActionLoadingId(requestId);
      setBannerMessage(null);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/patient/access-requests/${requestId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ decision }),
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
    if (!confirm("Are you sure you want to revoke this doctor's access to your medical records?")) {
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

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const activeAuthorizations = requests.filter((r) => r.status === "APPROVED");
  const pastRequests = requests.filter((r) => r.status === "REJECTED" || r.status === "REVOKED");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Doctor Access & Clinical Consent</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
              Privacy Controls
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review and control which verified healthcare practitioners have permission to inspect your medical dossier.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {bannerMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-2.5 ${
            bannerMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          {bannerMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{bannerMessage.text}</span>
        </div>
      )}

      {/* Section 1: Pending Access Requests */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pending Consent Requests ({pendingRequests.length})</h2>
              <p className="text-[11px] text-slate-500">Doctors requesting clinical permission to review your health records.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading access requests...</div>
        ) : pendingRequests.length === 0 ? (
          <div className="py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500 font-medium">No pending doctor requests.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              When a verified doctor requests access using your Patient ID, it will appear here for your review.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-slate-900">{req.doctorName}</strong>
                      <span className="font-mono text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {req.doctorCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Award className="w-3 h-3 text-slate-400" />
                        {req.doctorSpecialization || "General Medicine"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {req.doctorHospital || "Affiliated Hospital"}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      Purpose: {req.reason || "Clinical consultation"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleRespond(req.id, "APPROVE")}
                    disabled={actionLoadingId === req.id}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Approve Access</span>
                  </button>
                  <button
                    onClick={() => handleRespond(req.id, "REJECT")}
                    disabled={actionLoadingId === req.id}
                    className="px-3.5 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Active Doctor Authorizations */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Active Doctor Authorizations ({activeAuthorizations.length})</h2>
            <p className="text-[11px] text-slate-500">
              Doctors currently authorized to inspect your prescriptions, timeline, and health trends.
            </p>
          </div>
        </div>

        {activeAuthorizations.length === 0 ? (
          <div className="py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500 font-medium">No doctors currently have access to your records.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeAuthorizations.map((auth) => (
              <div key={auth.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-slate-900">{auth.doctorName}</strong>
                      <span className="font-mono text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {auth.doctorCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {auth.doctorSpecialization} • {auth.doctorHospital}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      Authorized on: {new Date(auth.respondedAt || auth.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleRevoke(auth.id)}
                  disabled={actionLoadingId === auth.id}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-colors shadow-2xs self-end sm:self-auto"
                >
                  Revoke Clinical Access
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: History & Revoked Access */}
      {pastRequests.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Access History & Revoked Authorizations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-2.5 px-3">Doctor</th>
                  <th className="py-2.5 px-3">Doctor ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{req.doctorName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{req.doctorCode}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === "REVOKED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {new Date(req.revokedAt || req.respondedAt || req.requestedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Healthcare Privacy Policy Note */}
      <footer className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-start gap-3">
        <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-700">Patient-Controlled Privacy:</strong> In accordance with health data
          governance standards, no practitioner can access your medical summary, prescriptions, or trends without
          your explicit consent. You maintain the right to revoke doctor access at any time with immediate effect.
        </p>
      </footer>
    </div>
  );
}

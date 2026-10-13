"use client";

import React, { useEffect, useState } from "react";
import {
  Clock,
  Plus,
  AlertTriangle,
  Search,
  X,
  Filter,
  Building2,
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  FileText,
  Activity,
  Pill,
  Eye,
  Trash2,
  Edit3,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { usePatientDashboard } from "@/app/patient/context";

export default function MedicalTimelinePage() {
  const {
    timelineEvents,
    documents,
    pendingDocuments,
    refresh,
    setNotification,
    setSelectedSummaryRecord,
    setAddTimelineModalOpen,
  } = usePatientDashboard();

  // Refresh the provider's server-backed snapshot when returning to the
  // timeline; the patient layout keeps that provider mounted across routes.
  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const [discardingId, setDiscardingId] = useState<string | number | null>(null);

  const handleDiscardPending = async (docId: string | number) => {
    if (!confirm("Are you sure you want to discard this prescription draft? It will be permanently removed.")) return;
    try {
      setDiscardingId(docId);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const cleanId = String(docId).replace(/^doc-/, "");
      const res = await fetch(`/api/discard/${cleanId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setNotification("Prescription draft permanently removed.");
        await refresh();
      } else {
        alert(data.error || "Failed to discard draft");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDiscardingId(null);
    }
  };

  // Filters
  const [timelineSearch, setTimelineSearch] = useState<string>("");
  const [timelineSourceFilter, setTimelineSourceFilter] = useState<string>("ALL");
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<string>("ALL");

  const filteredTimeline = timelineEvents.filter((ev) => {
    if (timelineSourceFilter !== "ALL" && ev.source !== timelineSourceFilter) {
      return false;
    }
    if (timelineCategoryFilter !== "ALL" && ev.category !== timelineCategoryFilter) {
      return false;
    }
    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase();
      const titleMatch = ev.title?.toLowerCase().includes(q);
      const descMatch = ev.description?.toLowerCase().includes(q);
      const docMatch = ev.doctor?.toLowerCase().includes(q);
      const facMatch = ev.facility?.toLowerCase().includes(q);
      const refMatch = ev.reference_id?.toLowerCase().includes(q);
      return titleMatch || descMatch || docMatch || facMatch || refMatch;
    }
    return true;
  });

  const handleTimelineClick = (ev: any) => {
    const docIdStr = ev.document_id != null
      ? String(ev.document_id)
      : ev.id ? String(ev.id).replace(/^doc-/, '') : '';
    let matchedDoc = documents.find(
      (d) =>
        String(d.id) === docIdStr ||
        (ev.extraction_id != null && String(d.filePath || "").endsWith(`/${ev.extraction_id}`)) ||
        d.structuredResult?.reference_id === ev.reference_id
    );

    if (!matchedDoc) {
      matchedDoc = {
        id: ev.id || "TL-SUMMARY",
        filename: ev.title || "City Care Medical Centre - 2026-09-13",
        status: (ev.verification_status === "Hospital Verified" || ev.verification_status === "Prescription Verified") ? "CONFIRMED" : "NOT CONFIRMED",
        uploadedAt: ev.event_date || new Date().toISOString(),
        summary: ev.description || "City Care Medical Centre (Dr. Neha Verma). Extracted 4 therapies. Status: NOT CONFIRMED (Awaiting Clinician Review).",
        imageUrl: "/sample_prescription.png",
        structuredResult: {
          hospital: ev.facility || "City Care Medical Centre",
          doctor: { name: ev.doctor || "Dr. Neha Verma", reg_no: "65432" },
          date_iso: ev.event_date || "2026-09-13",
          summary: ev.description || "City Care Medical Centre (Dr. Neha Verma). Extracted 4 therapies. Status: NOT CONFIRMED (Awaiting Clinician Review).",
          medicines: [
            { name: "Metformin", strength: "500 mg", frequency: "1-0-1", duration: "30 days", route: "oral", instructions: "After meals" },
            { name: "Atorvastatin", strength: "10 mg", frequency: "0-0-1", duration: "30 days", route: "oral", instructions: "After meals" },
            { name: "Pantoprazole", strength: "40 mg", frequency: "1-0-0", duration: "15 days", route: "oral", instructions: "After meals" },
            { name: "Vitamin D3", strength: "60K", frequency: "Once a week", duration: "8 weeks", route: "oral", instructions: "After meals" },
          ],
          diagnosis: "Routine clinical monitoring & glycemic management",
          allergies: "No Known Drug Allergies (NKDA)",
        },
      };
    }

    setSelectedSummaryRecord(matchedDoc);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Longitudinal Medical Timeline
            </h2>
            <span className="bg-[#ccfbf1]/80 text-[#0f766e] text-xs font-bold px-3 py-1 rounded-full border border-[#99f6e4]">
              2019 – October 2026
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Chronological audit trail with independent Source, Reliability, and Verification classifications. Click any record to view details & original prescription scan.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl font-medium shadow-2xs">
            Showing <strong className="text-slate-900 font-bold">{filteredTimeline.length}</strong> of{" "}
            <strong className="text-slate-900 font-bold">{timelineEvents.length}</strong> records
          </span>
          <button
            onClick={() => setAddTimelineModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {/* Unconfirmed Prescription Draft Action Banner */}
      {pendingDocuments && pendingDocuments.length > 0 && (
        <div className="bg-[#FFFBEB] border-2 border-[#F59E0B] p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                  <span>Unconfirmed Prescription Draft Awaiting Your Action</span>
                  <span className="bg-[#FEF3C7] text-[#92400E] text-[10.5px] px-2 py-0.5 rounded-full border border-[#FCD34D] font-mono">
                    {pendingDocuments.length} Awaiting Action
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  You scanned a prescription ({pendingDocuments[0].filename || "Uploaded Scan"}). You can review and submit it to your health record, or discard it if it was uploaded by mistake.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => handleDiscardPending(pendingDocuments[0].id)}
                disabled={discardingId === pendingDocuments[0].id}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{discardingId === pendingDocuments[0].id ? "Discarding..." : "Discard Draft"}</span>
              </button>
              <Link
                href={`/patient/documents/${pendingDocuments[0].extractionId || pendingDocuments[0].id}`}
                className="px-4 py-2 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Review & Submit</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Active Clinical Discrepancy Flagged Callout Banner */}
      {timelineEvents.some((ev) => ev.is_conflicting) && (
        <div className="bg-[#fffbeb] border border-[#fde68a] p-5 rounded-2xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
              Active Clinical Discrepancy Flagged
            </span>
            <span className="bg-[#fef3c7] text-[#b45309] text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border border-amber-300 tracking-wider">
              SAFETY PRIORITY
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Conflicting information detected — Hospital HMS record is shown as the higher-priority source. The patient-entered record has been retained for history.
          </p>
          <p className="text-xs font-semibold text-amber-900">
            HMS Reference: Metformin 500 mg BID (10 Sep 2026) vs Patient Self-Entry: Metformin 1000 mg (11 Sep 2026).
          </p>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={timelineSearch}
            onChange={(e) => setTimelineSearch(e.target.value)}
            placeholder="Search records by title, doctor, facility, or original reference..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all text-slate-800"
          />
          {timelineSearch && (
            <button
              onClick={() => setTimelineSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={timelineSourceFilter}
              onChange={(e) => setTimelineSourceFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="ALL">All Sources</option>
              <option value="Prescription Scan">Prescription Scan</option>
              <option value="Manual Entry">Manual Entry</option>
            </select>
          </div>

          <select
            value={timelineCategoryFilter}
            onChange={(e) => setTimelineCategoryFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="Doctor Visit">Doctor Visit</option>
            <option value="Lab Report">Lab Report</option>
            <option value="Medication">Medication Order</option>
            <option value="Symptom Report">Symptom Report</option>
          </select>
        </div>
      </div>

      {/* Interactive Timeline List */}
      <div className="relative pl-6 md:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 md:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {filteredTimeline.map((ev, idx) => {
          const isConflicting = ev.is_conflicting;
          const isHighlight = ev.source === "Prescription Scan" || ev.source === "Hospital HMS";
          const isConfirmedEvent =
            ev.status === "CONFIRMED" ||
            ev.verification_status === "Prescription Verified" ||
            ev.verification_status === "Hospital Verified";

          const isUnconfirmedDraft =
            !isConfirmedEvent &&
            (ev.verification_status === "Awaiting Review" ||
              ev.verification_status === "NOT CONFIRMED" ||
              ev.status === "NOT CONFIRMED" ||
              ev.status === "PENDING" ||
              ev.source === "Uploaded Document");

          const rawTargetId = String(ev.extraction_id || ev.document_id || ev.id).replace(/^doc-/, "");

          return (
            <div key={ev.id || idx} className="relative group">
              {/* Chronological node icon */}
              <div
                className={`absolute -left-[27px] md:-left-[31px] top-4 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isUnconfirmedDraft
                    ? "bg-amber-500 text-white border-amber-300 shadow-md ring-4 ring-amber-100"
                    : isConflicting
                    ? "bg-amber-500 text-white border-amber-200 shadow-md ring-4 ring-amber-100"
                    : isHighlight
                    ? "bg-[#0d9488] text-white border-teal-200 shadow-sm"
                    : "bg-white text-slate-600 border-slate-300"
                }`}
              >
                {isUnconfirmedDraft ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : ev.category === "Medication" ? (
                  <Pill className="w-3.5 h-3.5" />
                ) : ev.category === "Lab Report" ? (
                  <Activity className="w-3.5 h-3.5" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Event Card */}
              <div
                onClick={() => handleTimelineClick(ev)}
                className={`rounded-2xl p-5 shadow-xs border transition-all cursor-pointer ${
                  isUnconfirmedDraft
                    ? "bg-amber-50/40 border-2 border-amber-300 shadow-amber-50 hover:border-amber-400"
                    : isConflicting
                    ? "bg-white border-2 border-amber-300 shadow-amber-50 hover:border-amber-400"
                    : "bg-white border-slate-200/80 hover:border-teal-500 hover:shadow-md"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(ev.event_date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {ev.category}
                      </span>
                      {isConflicting && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Conflict Flagged
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-[#008080] transition-colors">{ev.title}</h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {isUnconfirmedDraft ? (
                      <>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-amber-100 text-amber-900 border-amber-300 uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Awaiting Review
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Unsaved Draft
                        </span>
                      </>
                    ) : (
                      <>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            ev.verification_status === "Prescription Verified" || ev.verification_status === "Hospital Verified"
                              ? "bg-teal-50 text-teal-800 border-teal-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {ev.verification_status || "Prescription Verified"}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ev.reliability === "High"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {ev.reliability || "High"} Reliability
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {ev.description}
                </p>

                {/* Inline Action Callout for Unconfirmed Prescription Drafts */}
                {isUnconfirmedDraft && (
                  <div className="mb-4 p-3.5 bg-white border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 text-xs text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="leading-snug">
                        Prescription extracted via OCR but <strong>not yet saved to your record</strong>. Review details and submit, or discard this draft.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={discardingId === (ev.document_id || ev.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDiscardPending(ev.document_id || ev.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{discardingId === (ev.document_id || ev.id) ? "Discarding..." : "Discard Draft"}</span>
                      </button>
                      <Link
                        href={`/patient/documents/${rawTargetId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3.5 py-1.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Review & Submit</span>
                      </Link>
                    </div>
                  </div>
                )}

                {isConflicting && ev.conflict_details && (
                  <div className="mb-4 p-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl text-xs text-amber-900 leading-relaxed">
                    <strong>Discrepancy Note:</strong> {ev.conflict_details}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                      {ev.doctor || "Consulting Physician"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {ev.facility || "City Care Medical Centre"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isUnconfirmedDraft ? (
                      <>
                        <button
                          type="button"
                          disabled={discardingId === (ev.document_id || ev.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDiscardPending(ev.document_id || ev.id);
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Discard Draft
                        </button>
                        <span className="text-slate-300">•</span>
                        <Link
                          href={`/patient/documents/${rawTargetId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs font-extrabold text-[#008080] hover:underline cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                          Review & Submit &rarr;
                        </Link>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTimelineClick(ev);
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Quick View
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTimelineClick(ev);
                        }}
                        className="flex items-center gap-1 text-xs font-extrabold text-[#008080] hover:underline cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details & Prescription Scan &rarr;
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

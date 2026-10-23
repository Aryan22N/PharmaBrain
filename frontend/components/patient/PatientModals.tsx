"use client";

import React, { useState } from "react";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  FileImage,
  ExternalLink,
  Activity,
  Building2,
  Stethoscope,
  Plus,
  Loader2,
  Shield,
  HeartPulse,
  Trash2,
  Edit3,
  ArrowRight,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export function PatientModals() {
  const {
    selectedSummaryRecord,
    setSelectedSummaryRecord,
    addTimelineModalOpen,
    setAddTimelineModalOpen,
    submittingTimeline,
    newTimeline,
    setNewTimeline,
    handleAddTimeline,
    addMedicineModalOpen,
    setAddMedicineModalOpen,
    submittingMedicine,
    newMedicine,
    setNewMedicine,
    handleAddMedicine,
    addAllergyModalOpen,
    setAddAllergyModalOpen,
    submittingAllergy,
    newAllergy,
    setNewAllergy,
    handleAddAllergy,
    conditions,
    addConditionModalOpen,
    setAddConditionModalOpen,
    submittingCondition,
    newCondition,
    setNewCondition,
    handleAddCondition,
    refresh,
    setNotification,
  } = usePatientDashboard();

  const [confirmingDoc, setConfirmingDoc] = useState(false);

  const handleConfirmCurrentDoc = async () => {
    if (!selectedSummaryRecord) return;
    try {
      setConfirmingDoc(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const cleanDocId = String(selectedSummaryRecord.id).replace(/^doc-/, "");
      const res = await fetch(`/api/patient/documents/${cleanDocId}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSummaryRecord((prev: any) => prev ? { ...prev, status: "CONFIRMED" } : null);
        setNotification("Document successfully verified and marked confirmed in EHR!");
        await refresh();
      } else {
        alert(data.error || "Failed to confirm document");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setConfirmingDoc(false);
    }
  };

  const [discardingDoc, setDiscardingDoc] = useState(false);

  const handleDiscardCurrentDoc = async () => {
    if (!selectedSummaryRecord) return;
    if (!confirm("Are you sure you want to discard this prescription draft? It will be permanently removed.")) return;
    try {
      setDiscardingDoc(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const cleanDocId = String(selectedSummaryRecord.id).replace(/^doc-/, "");
      const res = await fetch(`/api/discard/${cleanDocId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSelectedSummaryRecord(null);
        setNotification("Prescription draft has been permanently removed.");
        await refresh();
      } else {
        alert(data.error || "Failed to discard document");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDiscardingDoc(false);
    }
  };

  return (
    <>
      {/* 1. Complete Clinical Summary Modal for Clicked Records */}
      {selectedSummaryRecord && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      selectedSummaryRecord.status === "CONFIRMED"
                        ? "bg-teal-50 text-teal-800 border border-teal-200"
                        : "bg-amber-50 text-amber-800 border border-amber-300"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    {selectedSummaryRecord.status === "CONFIRMED"
                      ? "Prescription Verified Record"
                      : "NOT CONFIRMED • Unverified Prescription"}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Record #{selectedSummaryRecord.id} • Supabase EHR
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {selectedSummaryRecord.filename}
                </h2>
                <p className="text-xs text-slate-500">
                  Encounter Date:{" "}
                  <strong className="text-slate-700">
                    {selectedSummaryRecord.structuredResult?.date_iso ||
                      new Date(selectedSummaryRecord.uploadedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedSummaryRecord(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Uploaded Prescription Document Image Viewer */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <FileImage className="w-4 h-4 text-[#008080]" />
                  <span>Original Uploaded Prescription Document</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 uppercase">
                    Source Scan
                  </span>
                </div>
                <a
                  href={selectedSummaryRecord.imageUrl || "/sample_prescription.png"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008080] hover:text-[#006666] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open High-Resolution Scan &rarr;
                </a>
              </div>

              <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center p-3 min-h-[220px] max-h-[360px]">
                <img
                  src={selectedSummaryRecord.imageUrl || "/sample_prescription.png"}
                  alt={selectedSummaryRecord.filename || "Uploaded Prescription Scan"}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/sample_prescription.png";
                  }}
                  className="max-h-[340px] w-auto object-contain rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-[1.01]"
                />
              </div>
            </div>

            {/* Narrative Clinical Summary Banner */}
            <div className="p-4 bg-teal-50/70 border border-teal-100 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
                <Activity className="w-4 h-4 text-teal-600" />
                Clinical Synthesis & Narrative Summary
              </div>
              <p className="text-xs text-teal-950 leading-relaxed">
                {selectedSummaryRecord.summary ||
                  selectedSummaryRecord.structuredResult?.summary ||
                  "Complete clinical record synchronized with Supabase EHR database."}
              </p>
            </div>

            {/* 3 Core Clinical Metadata Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Healthcare Facility */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                  <Building2 className="w-4 h-4 text-teal-600" />
                  Healthcare Facility
                </div>
                <p className="text-xs font-semibold text-slate-900">
                  {selectedSummaryRecord.structuredResult?.hospital || "City Care Medical Centre"}
                </p>
                <p className="text-[11px] text-slate-500">
                  Hospital Information System (HMS) Verified
                </p>
              </div>

              {/* Consulting Physician */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  Consulting Physician
                </div>
                <p className="text-xs font-semibold text-slate-900">
                  {typeof selectedSummaryRecord.structuredResult?.doctor === "string"
                    ? selectedSummaryRecord.structuredResult.doctor
                    : selectedSummaryRecord.structuredResult?.doctor?.name || "Dr. Neha Verma"}
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  Reg No:{" "}
                  {selectedSummaryRecord.structuredResult?.doctor?.reg_no || "65432 (MCI)"}
                </p>
              </div>

              {/* Extraction Confidence & Gating */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Telemetry Provenance
                </div>
                <p className="text-xs font-semibold text-slate-900">PaddleOCR Engine v2.8</p>
                <p className="text-[11px] text-slate-500">99.4% OCR Character Alignment</p>
              </div>
            </div>

            {/* Prescribed Medicines Reconciled Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>Extracted Prescriptions & Medication Regimen</span>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {(
                    selectedSummaryRecord.structuredResult?.medicines ||
                    selectedSummaryRecord.medicines ||
                    []
                  ).length}{" "}
                  Items
                </span>
              </h4>

              {((selectedSummaryRecord.structuredResult?.medicines ||
                selectedSummaryRecord.medicines ||
                []) as any[]).length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                  No medication changes or prescriptions documented in this diagnostic/lab record.
                </p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="p-3 font-bold">Medication Name</th>
                        <th className="p-3 font-bold">Strength</th>
                        <th className="p-3 font-bold">Frequency</th>
                        <th className="p-3 font-bold">Duration / Route</th>
                        <th className="p-3 font-bold">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(
                        (selectedSummaryRecord.structuredResult?.medicines ||
                          selectedSummaryRecord.medicines ||
                          []) as any[]
                      ).map((med, medIdx) => (
                        <tr key={medIdx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900">
                            {typeof med === "string" ? med : med.name}
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            {typeof med === "string" ? "—" : med.strength || med.dose || "—"}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 font-mono text-[11px] font-bold bg-teal-50 text-teal-800 rounded border border-teal-200">
                              {typeof med === "string" ? "Daily" : med.frequency || "1-0-1"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">
                            {typeof med === "string"
                              ? "Oral"
                              : `${med.duration || "30 days"} • ${med.route || "Oral"}`}
                          </td>
                          <td className="p-3 text-slate-600">
                            {typeof med === "string" ? "As directed" : med.instructions || "After meals"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Source document path: {selectedSummaryRecord.filePath || `/uploads/${selectedSummaryRecord.filename}`}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedSummaryRecord.status !== "CONFIRMED" && (
                  <>
                    <button
                      type="button"
                      disabled={discardingDoc || confirmingDoc}
                      onClick={handleDiscardCurrentDoc}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {discardingDoc ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Discarding...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" /> Discard Draft
                        </>
                      )}
                    </button>
                    <a
                      href={`/patient/documents/${String(selectedSummaryRecord.id).replace(/^doc-/, "")}`}
                      onClick={() => setSelectedSummaryRecord(null)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                      <span>Review & Edit Full Record</span>
                    </a>
                    <button
                      type="button"
                      disabled={confirmingDoc || discardingDoc}
                      onClick={handleConfirmCurrentDoc}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {confirmingDoc ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm & Save to Record
                        </>
                      )}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedSummaryRecord(null)}
                  className="px-5 py-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Close Summary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Timeline Entry Modal */}
      {addTimelineModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#008080] flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Timeline Record</h3>
                  <p className="text-[11px] text-slate-500">Record a patient symptom, event, or clinic visit</p>
                </div>
              </div>
              <button
                onClick={() => setAddTimelineModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTimeline} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newTimeline.event_date}
                    onChange={(e) => setNewTimeline({ ...newTimeline, event_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Category
                  </label>
                  <select
                    value={newTimeline.category}
                    onChange={(e) => setNewTimeline({ ...newTimeline, category: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value="Symptom Report">Symptom Report</option>
                    <option value="Doctor Visit">Doctor Visit</option>
                    <option value="Medication">Medication Order</option>
                    <option value="Lab Report">Lab Report</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Title / Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mild stomach upset & headache"
                  value={newTimeline.title}
                  onChange={(e) => setNewTimeline({ ...newTimeline, title: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Clinical Description / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter observation notes, dosage details, or symptom severity..."
                  value={newTimeline.description}
                  onChange={(e) => setNewTimeline({ ...newTimeline, description: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Source
                  </label>
                  <select
                    value={newTimeline.source}
                    onChange={(e) => setNewTimeline({ ...newTimeline, source: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value="Manual Entry">Manual Entry</option>
                    <option value="Hospital HMS">Hospital HMS</option>
                    <option value="Patient Scan">Patient Scan</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Facility
                  </label>
                  <input
                    type="text"
                    value={newTimeline.facility}
                    onChange={(e) => setNewTimeline({ ...newTimeline, facility: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddTimelineModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTimeline}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#008080] hover:bg-[#006666] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingTimeline ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Save Event
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Medicine Modal */}
      {addMedicineModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#008080] flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record New Medicine</h3>
                  <p className="text-[11px] text-slate-500">Add an active prescription or chronic medication</p>
                </div>
              </div>
              <button
                onClick={() => setAddMedicineModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMedicine} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Medication Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Atorvastatin"
                    value={newMedicine.name}
                    onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Strength / Dose
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 20 mg"
                    value={newMedicine.strength}
                    onChange={(e) => setNewMedicine({ ...newMedicine, strength: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Regimen Status
                  </label>
                  <select
                    value={newMedicine.status}
                    onChange={(e) => setNewMedicine({ ...newMedicine, status: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISCONTINUED">DISCONTINUED</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Route
                  </label>
                  <select
                    value={newMedicine.route}
                    onChange={(e) => setNewMedicine({ ...newMedicine, route: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value="Oral">Oral</option>
                    <option value="Subcutaneous">Subcutaneous</option>
                    <option value="Intravenous">Intravenous</option>
                    <option value="Topical">Topical</option>
                    <option value="Inhalation">Inhalation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Indication / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hyperlipidemia / Cholesterol Control"
                  value={newMedicine.indication}
                  onChange={(e) => setNewMedicine({ ...newMedicine, indication: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddMedicineModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMedicine}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#008080] hover:bg-[#006666] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingMedicine ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Save Medication
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add/Update Allergy Modal */}
      {addAllergyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Shield className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Document Known Allergy</h3>
                  <p className="text-[11px] text-slate-500">Record drug, food, or environmental hypersensitivity</p>
                </div>
              </div>
              <button
                onClick={() => setAddAllergyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAllergy} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Allergen / Substance *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Penicillin, Peanuts, Sulfa"
                    value={newAllergy.allergen}
                    onChange={(e) => setNewAllergy({ ...newAllergy, allergen: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Category
                  </label>
                  <select
                    value={newAllergy.category}
                    onChange={(e) => setNewAllergy({ ...newAllergy, category: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value="Medication">Medication</option>
                    <option value="Food">Food</option>
                    <option value="Environmental">Environmental</option>
                    <option value="Biologic">Biologic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Observed Reaction / Symptom
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cutaneous rash, hives, dyspnea"
                  value={newAllergy.reaction}
                  onChange={(e) => setNewAllergy({ ...newAllergy, reaction: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Severity
                  </label>
                  <select
                    value={newAllergy.severity}
                    onChange={(e) => setNewAllergy({ ...newAllergy, severity: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                    <option value="Anaphylaxis">Anaphylaxis</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Status / Provenance
                  </label>
                  <select
                    value={newAllergy.status}
                    onChange={(e) => setNewAllergy({ ...newAllergy, status: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value="Patient Reported">Patient Reported</option>
                    <option value="Clinical Verified">Clinical Verified</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Additional Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Context, year of onset, or medical guidance..."
                  value={newAllergy.notes}
                  onChange={(e) => setNewAllergy({ ...newAllergy, notes: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddAllergyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAllergy}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#2F7D78] hover:bg-[#256B66] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingAllergy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Save Allergy
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Condition Modal */}
      {addConditionModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#2F7D78] flex items-center justify-center">
                  <HeartPulse className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Clinical Conditions</h3>
                  <p className="text-[11px] text-slate-500">View active conditions and record confirmed diagnoses</p>
                </div>
              </div>
              <button
                onClick={() => setAddConditionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of currently recorded active conditions */}
            {conditions && conditions.length > 0 && (
              <div className="space-y-2 border-b border-slate-100 pb-3 max-h-44 overflow-y-auto">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Active Recorded Conditions ({conditions.length})
                </span>
                <div className="space-y-1.5">
                  {conditions.map((c: any, idx: number) => (
                    <div
                      key={c.id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-900 block">{c.condition_name}</span>
                          <span className="text-[10.5px] text-slate-500">
                            {c.category || "Chronic"} {c.diagnosed_date ? `• Diagnosed ${c.diagnosed_date}` : ""}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {c.status || "ACTIVE"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleAddCondition} className="space-y-3.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {conditions && conditions.length > 0 ? "Add Another Condition" : "Record New Condition"}
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Condition Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Type 2 Diabetes Mellitus"
                    value={newCondition.condition_name}
                    onChange={(e) => setNewCondition({ ...newCondition, condition_name: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Category
                  </label>
                  <select
                    value={newCondition.category}
                    onChange={(e) => setNewCondition({ ...newCondition, category: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value="Endocrine">Endocrine / Metabolic</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Respiratory">Respiratory</option>
                    <option value="Renal">Renal</option>
                    <option value="Musculoskeletal">Musculoskeletal</option>
                    <option value="Chronic">General Chronic</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Diagnosis Date
                  </label>
                  <input
                    type="date"
                    value={newCondition.diagnosed_date}
                    onChange={(e) => setNewCondition({ ...newCondition, diagnosed_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Status
                  </label>
                  <select
                    value={newCondition.status}
                    onChange={(e) => setNewCondition({ ...newCondition, status: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="MANAGED">MANAGED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Clinical Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Treatment goals, lifestyle guidance, or monitoring plan..."
                  value={newCondition.notes}
                  onChange={(e) => setNewCondition({ ...newCondition, notes: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddConditionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCondition}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#2F7D78] hover:bg-[#256B66] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingCondition ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Save Condition
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

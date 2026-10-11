"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Upload,
  HeartPulse,
  Pill,
  FileText,
  AlertCircle,
  ArrowRight,
  Shield,
  TrendingUp,
  FileCheck,
  CheckCircle2,
  Stethoscope,
  ChevronRight,
  HelpCircle,
  ExternalLink,
  Plus,
  Clock,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

// Dynamic SVG Sparkline Generator based on DB history points
function Sparkline({
  points,
  color = "#2F7D78",
}: {
  points?: { value: number; date: string }[];
  color?: string;
}) {
  if (!points || points.length === 0) {
    return (
      <div className="w-full h-10 flex items-center justify-center">
        <div className="w-full border-b border-dashed border-[#DCE4ED]" />
      </div>
    );
  }

  if (points.length === 1) {
    return (
      <div className="w-full h-10 flex items-center justify-center">
        <svg className="w-full h-full overflow-visible" fill="none" viewBox="0 0 240 36">
          <line x1="10" y1="18" x2="230" y2="18" stroke={color} strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="120" cy="18" r="4.5" fill={color} stroke="white" strokeWidth="2" />
        </svg>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 240;
  const height = 36;
  const paddingX = 10;
  const paddingY = 8;

  const coords = points.map((p, idx) => {
    const x = paddingX + (idx / (points.length - 1)) * (width - paddingX * 2);
    // Invert y: higher value is higher up (lower Y)
    const normalized = (p.value - min) / range;
    const y = height - paddingY - normalized * (height - paddingY * 2);
    return { x, y };
  });

  const pathD = coords.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ""
  );

  return (
    <div className="w-full h-10 py-1">
      <svg
        className="w-full h-full overflow-visible"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 240 36"
      >
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

export default function OverviewPage() {
  const router = useRouter();
  const {
    userData,
    metrics,
    documents,
    pendingDocuments,
    conditions,
    allergies,
    vitals,
    doctorSharing,
    longitudinalSummary,
    timelineEvents,
    recordedMedicines,
    conflictingMedicines,
    setSelectedSummaryRecord,
    setAddAllergyModalOpen,
    setAddConditionModalOpen,
  } = usePatientDashboard();

  const conflictingMedsList = React.useMemo(() => {
    if (conflictingMedicines && conflictingMedicines.length > 0) {
      return conflictingMedicines;
    }
    return (recordedMedicines || []).filter(
      (m: any) => m.is_conflicting || m.status === "NEEDS_REVIEW"
    );
  }, [conflictingMedicines, recordedMedicines]);

  const userName = userData?.name || "Patient";
  const firstName = userName.split(" ")[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const activeConditionsCount =
    metrics.activeConditionsCount ??
    conditions.filter((c) => c.status === "ACTIVE").length;

  const activeMedicinesCount =
    metrics.activeMeds ??
    recordedMedicines.filter((m) => m.status === "ACTIVE").length;

  const totalRecordsCount = metrics.totalRecords ?? documents.length;

  const recordsToReviewCount =
    metrics.recordsToReviewCount ?? pendingDocuments.length;

  const activeMedsList = recordedMedicines
    .filter((m) => m.status === "ACTIVE")
    .slice(0, 3);

  const displayTimeline = timelineEvents.slice(0, 4);

  return (
    <div className="flex flex-col w-full space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Welcome Area */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[28px] font-bold text-[#111827] tracking-tight">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-[14px] text-[#64748B]">
              Here&apos;s an overview of your health records and recent clinical updates.
            </p>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => router.push("/patient/timeline")}
              className="h-10 px-4 rounded-xl bg-white border border-[#DCE4ED] text-[#2F7D78] hover:text-[#256B66] hover:border-[#A7E9DF] font-semibold text-[13px] shadow-xs hover:bg-[#F7F9FB] transition-all flex items-center gap-2 cursor-pointer"
              type="button"
            >
              <Calendar className="w-[19px] h-[19px] text-[#2F7D78]" />
              <span>View Health Timeline</span>
            </button>
            <button
              onClick={() => router.push("/upload")}
              className="h-10 px-4 rounded-xl bg-[#2F7D78] text-white font-semibold text-[13px] shadow-xs hover:bg-[#256B66] transition-all flex items-center gap-2 cursor-pointer"
              type="button"
            >
              <Upload className="w-[19px] h-[19px]" />
              <span>+ Upload Medical Record</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Compact Health Overview Cards (4 Columns) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Conditions */}
        <div className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-[#E8F6F4] flex items-center justify-center text-[#2F7D78]">
              <HeartPulse className="w-[22px] h-[22px]" />
            </div>
            <span className="text-[28px] text-[#111827] font-bold">
              {activeConditionsCount}
            </span>
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Active Conditions</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              {activeConditionsCount > 0
                ? `${activeConditionsCount} active condition${activeConditionsCount > 1 ? "s" : ""}`
                : "No active conditions recorded"}
            </p>
          </div>
          <button
            onClick={() => setAddConditionModalOpen(true)}
            className="text-[13px] text-[#2F7D78] hover:text-[#256B66] hover:underline inline-flex items-center gap-1 pt-1 font-semibold text-left cursor-pointer"
          >
            <span>{activeConditionsCount > 0 ? "View & manage conditions" : "+ Add condition"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 2: Active Medicines */}
        <div className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-[#E8F6F4] flex items-center justify-center text-[#2F7D78]">
              <Pill className="w-[22px] h-[22px]" />
            </div>
            <span className="text-[28px] text-[#111827] font-bold">
              {activeMedicinesCount}
            </span>
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Active Medicines</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              {activeMedicinesCount > 0
                ? `${activeMedicinesCount} active medicine${activeMedicinesCount > 1 ? "s" : ""}`
                : "No active medicines"}
            </p>
          </div>
          <Link
            href="/patient/medicines"
            className="text-[13px] text-[#2F7D78] hover:text-[#256B66] hover:underline inline-flex items-center gap-1 pt-1 font-semibold"
          >
            <span>Review medicines</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card 3: Medical Records */}
        <div className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-[#F3F6F9] flex items-center justify-center text-[#2F7D78]">
              <FileText className="w-[22px] h-[22px]" />
            </div>
            <span className="text-[28px] text-[#111827] font-bold">
              {totalRecordsCount}
            </span>
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Medical Records</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              {totalRecordsCount > 0 ? `${totalRecordsCount} records` : "No medical records yet"}
            </p>
          </div>
          <Link
            href="/patient/documents"
            className="text-[13px] text-[#2F7D78] hover:text-[#256B66] hover:underline inline-flex items-center gap-1 pt-1 font-semibold"
          >
            <span>View all records</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card 4: Records to Review */}
        <div className={`bg-white rounded-xl p-5 border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3 ${
          recordsToReviewCount > 0 ? "border-[#FDE68A]" : "border-[#DCE4ED]"
        }`}>
          <div className="flex items-center justify-between">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              recordsToReviewCount > 0 ? "bg-[#FFFBEB] text-[#F59E0B]" : "bg-[#E8F6F4] text-[#2F7D78]"
            }`}>
              {recordsToReviewCount > 0 ? (
                <AlertCircle className="w-[22px] h-[22px]" />
              ) : (
                <CheckCircle2 className="w-[22px] h-[22px]" />
              )}
            </div>
            <span className={`text-[28px] font-bold ${
              recordsToReviewCount > 0 ? "text-[#F59E0B]" : "text-[#111827]"
            }`}>
              {recordsToReviewCount}
            </span>
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Records to Review</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              {recordsToReviewCount > 0
                ? `${recordsToReviewCount} document${recordsToReviewCount > 1 ? "s" : ""} awaiting review`
                : "All documents confirmed"}
            </p>
          </div>
          <Link
            href="/patient/documents"
            className={`text-[13px] hover:underline inline-flex items-center gap-1 pt-1 font-semibold ${
              recordsToReviewCount > 0 ? "text-[#92400E]" : "text-[#2F7D78]"
            }`}
          >
            <span>{recordsToReviewCount > 0 ? "Review uploaded records" : "All documents reviewed"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 3. Asymmetric Dashboard Content (Col 8/12 & Col 4/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT PRIMARY REGION (Col 8/12) */}
        <div className="lg:col-span-8 space-y-5">
          {/* A. Active Medicines & My Allergies (Side-by-Side Cards) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Medicines Card */}
            <div className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pill className="w-[22px] h-[22px] text-[#2F7D78]" />
                    <h2 className="text-[17px] font-semibold text-[#111827]">Active Medicines</h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#256B66] text-[11px] font-semibold">
                    {activeMedicinesCount} Current
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activeMedsList.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#F3F6F9] border border-[#DCE4ED]/60 text-center space-y-1">
                      <p className="text-[12.5px] font-medium text-[#64748B]">
                        No active medicines recorded in your electronic record.
                      </p>
                      <Link
                        href="/upload"
                        className="text-[11.5px] text-[#2F7D78] font-semibold hover:underline inline-block pt-1"
                      >
                        Upload a prescription to record therapies &rarr;
                      </Link>
                    </div>
                  ) : (
                    activeMedsList.map((med: any, idx: number) => {
                      const medSource =
                        med.source === "Hospital HMS"
                          ? "Prescription Scan"
                          : med.source || "Prescription Scan";
                      return (
                        <div
                          key={med.id || idx}
                          className="p-3 rounded-lg bg-[#F3F6F9] border border-[#DCE4ED]/60 space-y-1"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[13px] text-[#111827] font-semibold">
                              {med.name} {med.strength}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10.5px] bg-[#E8F6F4] text-[#256B66] font-semibold">
                              Active
                            </span>
                          </div>
                          <p className="text-[12px] text-[#64748B]">
                            {med.route || "Oral"} • {med.frequency || "Once daily"}
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-[#64748B]">
                            <FileText className="w-3.5 h-3.5 text-[#2F7D78]" />
                            <span>
                              Source: {medSource} ({med.doctor || "Physician"})
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-[#DCE4ED]">
                <Link
                  href="/patient/medicines"
                  className="text-[13px] text-[#2F7D78] hover:text-[#256B66] hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  <span>View All Medicines ({activeMedicinesCount})</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* My Allergies Card */}
            <div className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-[22px] h-[22px] text-[#F59E0B]" />
                    <h2 className="text-[17px] font-semibold text-[#111827]">My Allergies</h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] text-[11px] font-semibold">
                    {allergies.length} Documented
                  </span>
                </div>

                <div className="space-y-2.5">
                  {allergies.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#F3F6F9] border border-[#DCE4ED]/60 text-center space-y-1">
                      <p className="text-[12.5px] font-medium text-[#64748B]">
                        No known drug or food allergies documented in database.
                      </p>
                      <button
                        onClick={() => setAddAllergyModalOpen(true)}
                        className="text-[11.5px] text-[#2F7D78] font-semibold hover:underline inline-block pt-1 cursor-pointer"
                      >
                        + Record an allergy sensitivity &rarr;
                      </button>
                    </div>
                  ) : (
                    allergies.map((allergy: any, idx: number) => {
                      const isVerified =
                        allergy.verification_status === "Clinical Verified" ||
                        allergy.verification_status === "Hospital Verified" ||
                        allergy.status === "Clinical Verified" ||
                        allergy.status === "Hospital Verified";
                      return (
                        <div
                          key={allergy.id || idx}
                          className="p-3 rounded-lg bg-[#F3F6F9] border border-[#DCE4ED]/60 space-y-1"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[13px] text-[#111827] font-semibold">
                              {allergy.allergen}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10.5px] bg-[#DCE4ED] text-[#111827] font-medium">
                              {allergy.category || "Medication"}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#64748B]">
                            Reaction: {allergy.reaction || "Not documented"}
                          </p>
                          <div className="flex items-center justify-between pt-0.5 text-[11px] text-[#64748B]">
                            {isVerified ? (
                              <span className="flex items-center gap-1 font-semibold text-[#2F7D78]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Clinically Verified
                              </span>
                            ) : (
                              <span>Status: {allergy.status || "Patient Reported"}</span>
                            )}
                            <span className="font-mono text-[11px]">
                              Added: {allergy.added_date || "Recorded in EHR"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <p className="text-[11px] leading-tight text-[#64748B] italic pt-0.5">
                  * Not recorded does not necessarily mean no known allergies. Always verify with your care team.
                </p>
              </div>

              <div className="pt-2 border-t border-[#DCE4ED] flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => setAddAllergyModalOpen(true)}
                  className="h-7 px-2.5 rounded-lg bg-[#F3F6F9] border border-[#DCE4ED] text-[#2F7D78] hover:bg-[#E8F6F4] text-[11.5px] font-semibold transition-colors cursor-pointer"
                  type="button"
                >
                  Update Allergy Information
                </button>
                <button
                  onClick={() => setAddAllergyModalOpen(true)}
                  className="text-[13px] text-[#2F7D78] hover:text-[#256B66] hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <span>Manage Allergies</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>

          {/* B. Latest Health Measurements (Vitals & Biomarkers) */}
          <section className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#2F7D78]" />
                <h2 className="text-[17px] font-semibold text-[#111827]">
                  Latest Health Measurements
                </h2>
              </div>
              <Link
                href="/patient/trends"
                className="text-[13px] text-[#2F7D78] hover:text-[#256B66] hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <span>View Full Trends & Insights</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* 4 Biomarker Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Fasting Glucose */}
              <div className="p-4 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED]/70 hover:bg-[#F3F6F9]/90 transition-colors space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[14px] font-semibold text-[#111827] block">
                      Fasting Blood Glucose
                    </span>
                    <span className="text-[11.5px] text-[#64748B]">
                      {vitals.glucose.targetRange}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[20px] text-[#111827] font-bold">
                      {vitals.glucose.latestValue}
                    </span>
                    <span className="font-mono text-[11px] text-[#64748B] block">
                      {vitals.glucose.date || "No date recorded"}
                    </span>
                  </div>
                </div>

                <Sparkline points={vitals.glucose.history} color="#2F7D78" />

                <div className="flex items-center justify-between pt-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      vitals.glucose.numericValue != null && vitals.glucose.numericValue > 130
                        ? "bg-[#FFFBEB] text-[#92400E]"
                        : "bg-[#E8F6F4] text-[#256B66]"
                    }`}
                  >
                    {vitals.glucose.statusLabel}
                  </span>
                  <span className="text-[12px] text-[#64748B]">
                    {vitals.glucose.trendNote}
                  </span>
                </div>
              </div>

              {/* Card 2: HbA1c */}
              <div className="p-4 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED]/70 hover:bg-[#F3F6F9]/90 transition-colors space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[14px] font-semibold text-[#111827] block">
                      Glycated Hemoglobin (HbA1c)
                    </span>
                    <span className="text-[11.5px] text-[#64748B]">
                      {vitals.hba1c.targetRange}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[20px] text-[#111827] font-bold">
                      {vitals.hba1c.latestValue}
                    </span>
                    <span className="font-mono text-[11px] text-[#64748B] block">
                      {vitals.hba1c.date || "No date recorded"}
                    </span>
                  </div>
                </div>

                <Sparkline points={vitals.hba1c.history} color="#2F7D78" />

                <div className="flex items-center justify-between pt-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      vitals.hba1c.numericValue != null && vitals.hba1c.numericValue > 7.0
                        ? "bg-[#FFFBEB] text-[#92400E]"
                        : "bg-[#E8F6F4] text-[#256B66]"
                    }`}
                  >
                    {vitals.hba1c.statusLabel}
                  </span>
                  <span className="text-[12px] text-[#64748B]">
                    {vitals.hba1c.trendNote}
                  </span>
                </div>
              </div>

              {/* Card 3: Blood Pressure */}
              <div className="p-4 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED]/70 hover:bg-[#F3F6F9]/90 transition-colors space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[14px] font-semibold text-[#111827] block">
                      Blood Pressure (Systolic / Diastolic)
                    </span>
                    <span className="text-[11.5px] text-[#64748B]">
                      {vitals.bp.targetRange}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[20px] text-[#111827] font-bold">
                      {vitals.bp.latestValue}
                    </span>
                    <span className="font-mono text-[11px] text-[#64748B] block">
                      {vitals.bp.date || "No date recorded"}
                    </span>
                  </div>
                </div>

                <Sparkline points={vitals.bp.history} color="#2F7D78" />

                <div className="flex items-center justify-between pt-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      vitals.bp.numericValue != null && vitals.bp.numericValue >= 130
                        ? "bg-[#FFFBEB] text-[#92400E]"
                        : "bg-[#E8F6F4] text-[#256B66]"
                    }`}
                  >
                    {vitals.bp.statusLabel}
                  </span>
                  <span className="text-[12px] text-[#64748B]">
                    {vitals.bp.trendNote}
                  </span>
                </div>
              </div>

              {/* Card 4: Weight & BMI */}
              <div className="p-4 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED]/70 hover:bg-[#F3F6F9]/90 transition-colors space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[14px] font-semibold text-[#111827] block">
                      Body Weight & Estimated BMI
                    </span>
                    <span className="text-[11.5px] text-[#64748B]">
                      {vitals.weight.targetRange}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[20px] text-[#111827] font-bold">
                      {vitals.weight.latestValue}
                    </span>
                    <span className="font-mono text-[11px] text-[#64748B] block">
                      {vitals.weight.date || "No date recorded"}
                    </span>
                  </div>
                </div>

                <Sparkline points={vitals.weight.history} color="#2F7D78" />

                <div className="flex items-center justify-between pt-1">
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#256B66] text-[11px] font-semibold">
                    {vitals.weight.statusLabel}
                  </span>
                  <span className="text-[12px] text-[#64748B]">
                    {vitals.weight.trendNote}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* C. Recent Medical Activity (Bottom of Main Column) */}
          <section className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#2F7D78]" />
                <h2 className="text-[17px] font-semibold text-[#111827]">
                  Recent Medical Activity
                </h2>
              </div>
              <Link
                href="/patient/timeline"
                className="text-[13px] text-[#2F7D78] hover:text-[#256B66] hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <span>View full timeline ({timelineEvents.length} events)</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {displayTimeline.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED]/70 text-center space-y-2">
                  <FileText className="w-8 h-8 text-[#94A3B8] mx-auto" />
                  <h4 className="text-[13.5px] font-semibold text-[#111827]">
                    No recent medical events found in database
                  </h4>
                  <p className="text-[12px] text-[#64748B] max-w-sm mx-auto">
                    Upload paper prescriptions or lab reports to populate your medical timeline.
                  </p>
                  <button
                    onClick={() => router.push("/upload")}
                    className="h-8 px-4 rounded-lg bg-[#2F7D78] text-white text-[12px] font-semibold hover:bg-[#256B66] transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Upload Document
                  </button>
                </div>
              ) : (
                displayTimeline.map((event: any, idx: number) => {
                  const rawSource = event.source || "";
                  const sourceClean =
                    rawSource === "Hospital HMS"
                      ? "Prescription Scan"
                      : rawSource || "Prescription Scan";
                  const isPrescription =
                    sourceClean === "Prescription Scan" ||
                    event.category === "Prescription" ||
                    event.category === "Medication";
                  const isLab =
                    event.category === "Lab Result" || event.category === "Lab Report";

                  return (
                    <div
                      key={event.id || idx}
                      className="p-4 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED]/70 hover:bg-[#F3F6F9]/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] text-[#64748B]">
                            {event.event_date || "Date logged"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                              isPrescription
                                ? "bg-[#EFF6FF] text-[#1D4ED8]"
                                : isLab
                                ? "bg-[#F1F5F9] text-[#475569]"
                                : "bg-[#FFFBEB] text-[#92400E]"
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                            {sourceClean}
                          </span>
                        </div>
                        <h3 className="text-[14px] font-semibold text-[#111827]">
                          {event.title}
                        </h3>
                        <p className="text-[12px] text-[#64748B]">
                          {event.doctor} • {event.facility}
                        </p>
                        {event.description && (
                          <p className="text-[13px] text-[#111827]">
                            {event.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          const doc = documents.find(
                            (d) => d.id === event.document_id || `doc-${d.id}` === event.id
                          );
                          if (doc) {
                            setSelectedSummaryRecord(doc);
                          } else {
                            router.push("/patient/timeline");
                          }
                        }}
                        className="shrink-0 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer bg-white border border-[#DCE4ED] text-[#2F7D78] hover:bg-[#E8F6F4]"
                        type="button"
                      >
                        View Consultation Note
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* RIGHT SECONDARY REGION (Col 4/12) */}
        <aside className="lg:col-span-4 space-y-5">
          {/* A. Conflicting Medicines Card (from /patient/medicines) */}
          <section className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#D97706]" />
                <h2 className="text-[17px] font-semibold text-[#111827]">
                  Conflicting Medicines
                </h2>
              </div>
              <span
                className={`w-6 h-6 rounded-full font-mono text-[11px] font-bold flex items-center justify-center ${
                  conflictingMedsList.length > 0
                    ? "bg-[#F59E0B] text-white"
                    : "bg-[#E8F6F4] text-[#256B66]"
                }`}
              >
                {conflictingMedsList.length}
              </span>
            </div>

            <div className="space-y-3">
              {conflictingMedsList.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-[#E8F6F4] border border-[#A7E9DF] flex items-center gap-2.5 text-[#111827]">
                  <CheckCircle2 className="w-4 h-4 text-[#2F7D78] shrink-0" />
                  <div>
                    <p className="text-[12.5px] text-[#256B66] font-semibold">
                      No Medication Conflicts Detected
                    </p>
                    <p className="text-[11.5px] text-[#64748B] mt-0.5">
                      All active prescription regimens and dosages are clinically aligned.
                    </p>
                  </div>
                </div>
              ) : (
                conflictingMedsList.slice(0, 3).map((med: any, idx: number) => (
                  <div
                    key={med.id || idx}
                    className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[13.5px] text-[#111827] font-bold">
                          {med.name}{" "}
                          {med.strength && (
                            <span className="text-[#92400E] font-mono text-[12px]">
                              ({med.strength})
                            </span>
                          )}
                        </h3>
                        <span className="font-mono text-[11px] text-[#78350F] block mt-0.5">
                          {med.doctor || "Consulting Physician"} •{" "}
                          {med.prescription_date || med.start_date || "Active Regimen"}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[10.5px] font-extrabold uppercase tracking-wider shrink-0 border border-[#FCD34D]">
                        Needs Review
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/90 border border-[#FDE68A]/70 text-[11.5px] text-[#92400E] leading-relaxed flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
                      <span>
                        {med.conflict_details ||
                          med.reconciliation_notes ||
                          "Concurrent active treatment or dosage discrepancy detected across clinical encounters."}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11.5px]">
                      <span className="text-[11px] text-[#92400E] font-medium font-mono">
                        {med.reference_id || `MED-${med.id}`}
                      </span>
                      <Link
                        href="/patient/medicines"
                        className="font-bold text-[#0F766E] hover:text-[#115E59] hover:underline flex items-center gap-1"
                      >
                        <span>Resolve in Medicines</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}

              {conflictingMedsList.length > 0 && (
                <div className="pt-1">
                  <Link
                    href="/patient/medicines"
                    className="w-full h-8.5 rounded-lg bg-[#008080] hover:bg-[#006666] text-white text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>View All {conflictingMedsList.length} Conflicting Medicines</span>
                  </Link>
                </div>
              )}

              {pendingDocuments.length > 0 && (
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2 text-[#111827] mt-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCheck className="w-4 h-4 text-[#0284C7] shrink-0" />
                    <p className="text-[11.5px] text-[#334155] truncate">
                      {pendingDocuments.length} document{pendingDocuments.length > 1 ? "s" : ""} awaiting review
                    </p>
                  </div>
                  <Link
                    href="/patient/documents"
                    className="text-[11px] font-bold text-[#0284C7] hover:underline shrink-0"
                  >
                    Review &rarr;
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* B. Longitudinal Health Status Summary */}
          <article className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#2F7D78]" />
                <h2 className="text-[17px] font-semibold text-[#111827]">
                  Longitudinal Health Summary
                </h2>
              </div>
              <span className="text-[11px] text-[#64748B]">Updated Live</span>
            </div>

            {/* Concise 3-bullet clinical summary */}
            <ul className="space-y-2 text-[12.5px] text-[#111827] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D78] mt-2 shrink-0"></span>
                <span>
                  <strong>Diagnoses:</strong> {longitudinalSummary.diagnoses}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D78] mt-2 shrink-0"></span>
                <span>
                  <strong>Glycemic Status:</strong> {longitudinalSummary.glycemicStatus}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D78] mt-2 shrink-0"></span>
                <span>
                  <strong>Ongoing Regimen:</strong> {longitudinalSummary.regimen}
                </span>
              </li>
            </ul>

            <div className="pt-2 border-t border-[#DCE4ED] flex flex-col gap-2">
              <p className="text-[11px] leading-tight text-[#64748B] italic">
                AI-assisted synthesis is for organizational and explanatory support only. Clinical decisions must be confirmed with your licensed physician.
              </p>
              <Link
                href="/patient/trends"
                className="text-[12px] text-[#2F7D78] font-semibold hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>View Full Summary & Citations</span>
                <ArrowRight className="w-[15px] h-[15px]" />
              </Link>
            </div>
          </article>

          {/* C. Sharing with Your Doctor */}
          <section className="bg-white rounded-xl p-5 border border-[#DCE4ED] shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-[#2F7D78]" />
              <h2 className="text-[17px] font-semibold text-[#111827]">
                Sharing with Your Doctor
              </h2>
            </div>

            {doctorSharing ? (
              <div className="p-3.5 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#2F7D78] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {doctorSharing.doctor_name
                        ?.split(" ")
                        .filter((p: string) => !p.startsWith("Dr."))
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "MD"}
                    </div>
                    <div className="truncate">
                      <span className="text-[13px] text-[#111827] font-semibold block truncate">
                        {doctorSharing.doctor_name}
                      </span>
                      <span className="text-[11.5px] text-[#64748B] truncate">
                        {doctorSharing.doctor_specialization || "General Medicine"} • {doctorSharing.doctor_hospital || "Hospital"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-1 space-y-1 text-[12px]">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Scope:</span>
                    <span className="font-medium text-[#111827]">
                      {doctorSharing.reason || "Full Longitudinal (Labs, Rx, Trends)"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Consent Status:</span>
                    <span className="font-medium text-[#256B66]">
                      {doctorSharing.status === "APPROVED" ? "Active Consent" : doctorSharing.status}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F6F4] text-[#256B66] text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#2F7D78]"></span>
                    <span>
                      Active Sharing • Consented{" "}
                      {doctorSharing.expires_at
                        ? `until ${new Date(doctorSharing.expires_at).toLocaleDateString()}`
                        : "Longitudinal Access"}
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED] space-y-2 text-center">
                <p className="text-[12.5px] text-[#64748B]">
                  No doctor currently linked to your patient portal.
                </p>
                <Link
                  href="/patient/sharing"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2F7D78] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Connect with Physician
                </Link>
              </div>
            )}

            <button
              onClick={() => router.push("/patient/sharing")}
              className="w-full h-9 rounded-lg bg-white border border-[#DCE4ED] text-[#2F7D78] text-[12px] font-semibold hover:bg-[#F3F6F9] transition-colors flex items-center justify-center gap-1 cursor-pointer"
              type="button"
            >
              <span>Manage Permissions</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>

          {/* D. Patient Care Helpline Notice */}
          <div className="p-4 rounded-xl bg-[#F3F6F9] border border-[#DCE4ED] text-[#64748B] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[13px] text-[#2F7D78] font-semibold">
              <HelpCircle className="w-[18px] h-[18px]" />
              <span>Need interpretative assistance?</span>
            </div>
            <p className="text-[12px] leading-relaxed">
              Always consult your physician before altering medication regimens. Emergency helpline:{" "}
              <strong className="text-[#111827]">112</strong> / Hospital Desk:{" "}
              <strong className="text-[#111827]">+91 22 5550 1200</strong>.
            </p>
          </div>
        </aside>
      </div>

      {/* Bottom Regulatory Disclaimer Footer */}
      <footer className="pt-4 pb-2 text-center">
        <p className="text-[11px] text-[#64748B]">
          HealthRecord AI Patient Clinical Portal • Secure HIPAA & ABDM Compliant Architecture
        </p>
      </footer>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  User,
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  Award,
  ChevronRight,
  LogIn,
  UserPlus,
} from "lucide-react";

export default function AuthRoleSelectionPage() {
  return (
    <div className="min-h-screen bg-[#f4f7f6] flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans relative overflow-hidden">
      {/* Soft Background Accents */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[750px] h-[380px] bg-teal-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Top Brand Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between relative z-10 pt-2 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#008080] text-white flex items-center justify-center shadow-md shadow-teal-700/20">
            <Activity className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight block">
              pharmaBrain
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Medical & Clinical Intelligence Portal
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-white/90 border border-slate-200/80 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-[#008080]" />
          <span>HIPAA & Supabase Encrypted</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full relative z-10 my-auto py-4 sm:py-8 space-y-8">
        {/* Title Section */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/70 text-teal-800 text-xs font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
            Unified Authentication Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Select Your Portal Access
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Welcome to pharmaBrain. Choose whether you are accessing your personal medical records as a patient or reviewing clinical records as a medical practitioner.
          </p>
        </div>

        {/* Two-Column Responsive Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {/* Card 1: Patient Portal */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50/70 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />

            <div className="space-y-5 relative z-10">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-[#008080] text-white flex items-center justify-center shadow-lg shadow-teal-700/20">
                  <User className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  Personal DMR
                </span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-slate-900 group-hover:text-[#008080] transition-colors">
                  Patient Portal
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Manage your personal prescriptions, inspect high-resolution physical scans, track medication courses, and monitor longitudinal vital trends.
                </p>
              </div>

              {/* Feature Highlights */}
              <ul className="space-y-2.5 pt-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008080] shrink-0" />
                  <span>Prescription Upload & AI Digitization</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008080] shrink-0" />
                  <span>Longitudinal Vitals & BP/Glucose Trajectories</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008080] shrink-0" />
                  <span>Active Medication Schedules & Reminders</span>
                </li>
              </ul>
            </div>

            {/* Separate Actions: Login and Signup */}
            <div className="pt-6 mt-6 border-t border-slate-100 space-y-2.5 relative z-10">
              <Link
                href="/auth/patient/login"
                className="w-full py-3 px-4 rounded-xl bg-[#008080] hover:bg-[#006666] text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In as Patient</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Link>

              <Link
                href="/auth/patient/signup"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-slate-500" />
                <span>Create New Patient Account</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Doctor Portal */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50/70 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />

            <div className="space-y-5 relative z-10">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-[#0f766e] text-white flex items-center justify-center shadow-lg shadow-teal-900/20">
                  <Stethoscope className="w-7 h-7 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  Clinical Support
                </span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-slate-900 group-hover:text-[#0f766e] transition-colors">
                  Doctor / Clinician Portal
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Review extracted prescription drafts, verify clinical dosages with Medicine Master, confirm observations, and audit patient histories.
                </p>
              </div>

              {/* Feature Highlights */}
              <ul className="space-y-2.5 pt-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <span>Clinical Prescription Review & Confirmation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <span>Raw OCR Line Inspection & Dosage Validation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <span>Credential-Backed Reviewer Identity</span>
                </li>
              </ul>
            </div>

            {/* Separate Actions: Login and Signup */}
            <div className="pt-6 mt-6 border-t border-slate-100 space-y-2.5 relative z-10">
              <Link
                href="/auth/doctor/login"
                className="w-full py-3 px-4 rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In as Doctor</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Link>

              <Link
                href="/auth/doctor/signup"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Award className="w-4 h-4 text-slate-500" />
                <span>Register with Medical License</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Notice */}
      <footer className="max-w-5xl mx-auto w-full pt-6 pb-2 text-center relative z-10">
        <p className="text-xs text-slate-500">
          Clinical Decision Support Platform • All extraction outputs are drafts until confirmed by a licensed clinician.
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          pharmaBrain DMR • Single-Hospital-Pro
        </p>
      </footer>
    </div>
  );
}

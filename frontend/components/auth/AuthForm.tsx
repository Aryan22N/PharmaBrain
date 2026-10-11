"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ShieldCheck,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Stethoscope,
  Building2,
  Award,
  ArrowLeft,
} from "lucide-react";

interface AuthFormProps {
  role: "PATIENT" | "DOCTOR";
  mode: "login" | "signup";
}

export function AuthForm({ role, mode }: AuthFormProps) {
  const router = useRouter();
  const isDoctor = role === "DOCTOR";
  const isLogin = mode === "login";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    medicalLicenseNumber: "",
    specialization: "",
    hospitalAffiliation: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const theme = isDoctor
    ? {
        primary: "bg-[#0f766e] hover:bg-[#115e59]",
        primaryBorder: "focus:border-[#0f766e]",
        accentBg: "bg-teal-50 border-teal-200 text-teal-800",
        badgeBg: "bg-teal-700/10 text-teal-800 border border-teal-300/60",
        iconBg: "bg-[#0f766e] text-white shadow-teal-900/20",
        roleTitle: "Doctor & Clinician Portal",
        roleTag: "Licensed Medical Personnel Only",
        portalDesc: isLogin
          ? "Sign in to review prescription drafts and audit clinical data."
          : "Register your clinical credentials for prescription verification support.",
      }
    : {
        primary: "bg-[#008080] hover:bg-[#006666]",
        primaryBorder: "focus:border-[#008080]",
        accentBg: "bg-teal-50 border-teal-200 text-teal-800",
        badgeBg: "bg-teal-700/10 text-teal-800 border border-teal-300/60",
        iconBg: "bg-[#008080] text-white shadow-teal-700/20",
        roleTitle: "Patient DMR Portal",
        roleTag: "Personal Health Records & Care",
        portalDesc: isLogin
          ? "Access your longitudinal medical records, medication courses, and trends."
          : "Create your personal medical portal to track prescriptions and health trends.",
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (!formData.email || !formData.email.includes("@")) {
      setError("Please provide a valid email address.");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    if (!isLogin && (!formData.name || formData.name.trim().length < 2)) {
      setError("Please enter your full name (at least 2 characters).");
      setLoading(false);
      return;
    }

    if (!isLogin && isDoctor && (!formData.medicalLicenseNumber || formData.medicalLicenseNumber.trim().length < 3)) {
      setError("Valid Medical License / Council Registration Number is required.");
      setLoading(false);
      return;
    }

    const endpoint = isDoctor
      ? (isLogin ? "/api/auth/doctor/login" : "/api/auth/doctor/register")
      : (isLogin ? "/api/auth/login" : "/api/auth/register");

    try {
      const payload: Record<string, unknown> = {
        email: formData.email.trim(),
        password: formData.password,
      };

      if (!isLogin) {
        payload.name = formData.name.trim();
        if (isDoctor) {
          payload.medicalLicenseNumber = formData.medicalLicenseNumber.trim();
          payload.specialization = formData.specialization.trim() || undefined;
          payload.hospitalAffiliation = formData.hospitalAffiliation.trim() || undefined;
        }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed. Please check your credentials.");
      }

      if (data.token) {
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      if (isLogin) {
        setSuccess("Signed in successfully! Redirecting...");
        setTimeout(() => {
          if (isDoctor) {
            router.push("/doctor/dashboard");
          } else {
            router.push("/patient/overview");
          }
        }, 800);
      } else {
        if (isDoctor) {
          setSuccess("Account registered successfully! Redirecting to doctor dashboard...");
          setTimeout(() => {
            router.push("/doctor/dashboard");
          }, 1000);
        } else {
          setSuccess("Account created successfully! Redirecting to initial profile setup...");
          setTimeout(() => {
            router.push("/onboarding");
          }, 900);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred during authentication.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const switchModeHref = isLogin
    ? `/auth/${isDoctor ? "doctor" : "patient"}/signup`
    : `/auth/${isDoctor ? "doctor" : "patient"}/login`;

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-teal-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 relative z-10 space-y-6">
        {/* Navigation & Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <Link
            href="/auth"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Switch Role</span>
          </Link>

          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${theme.badgeBg}`}>
            {theme.roleTag}
          </span>
        </div>

        {/* Brand Banner */}
        <div className="flex flex-col items-center text-center pt-1">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md mb-3 ${theme.iconBg}`}>
            {isDoctor ? (
              <Stethoscope className="w-7 h-7 stroke-[2.5]" />
            ) : (
              <Activity className="w-7 h-7 stroke-[2.5]" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
            pharmaBrain
          </h1>
          <h2 className="text-sm font-bold text-slate-700 mt-1">
            {theme.roleTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {theme.portalDesc}
          </p>
        </div>

        {/* Mode Toggle Switch (Sign In vs Sign Up) */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-semibold">
          <Link
            href={`/auth/${isDoctor ? "doctor" : "patient"}/login`}
            className={`flex-1 py-2 text-center rounded-xl transition-all ${
              isLogin
                ? `${isDoctor ? "bg-[#0f766e]" : "bg-[#008080]"} text-white shadow-xs font-extrabold`
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            Sign In
          </Link>
          <Link
            href={`/auth/${isDoctor ? "doctor" : "patient"}/signup`}
            className={`flex-1 py-2 text-center rounded-xl transition-all ${
              !isLogin
                ? `${isDoctor ? "bg-[#0f766e]" : "bg-[#008080]"} text-white shadow-xs font-extrabold`
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            Create Account
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* Main Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Full Name {isDoctor ? "(with Title)" : ""}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder={isDoctor ? "Dr. Priya Deshmukh, MD" : "Rahul Sharma"}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none ${theme.primaryBorder} focus:bg-white transition-all`}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder={isDoctor ? "doctor@hospital.org" : "patient@pharmabrain.org"}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none ${theme.primaryBorder} focus:bg-white transition-all`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none ${theme.primaryBorder} focus:bg-white transition-all`}
              />
            </div>
            {!isLogin && (
              <p className="text-[10px] text-slate-400 mt-1">Minimum 6 characters</p>
            )}
          </div>

          {/* Doctor-Specific Verification Credential Fields */}
          {!isLogin && isDoctor && (
            <div className="pt-2 border-t border-slate-100 space-y-3.5">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-700" />
                <span className="text-xs font-bold text-slate-800">
                  Clinical Verification Credentials
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Medical License / Council Registration No. <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Award className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. MCI-2019-48201 or State Council Reg"
                    value={formData.medicalLicenseNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, medicalLicenseNumber: e.target.value })
                    }
                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none ${theme.primaryBorder} focus:bg-white transition-all`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cardiology"
                    value={formData.specialization}
                    onChange={(e) =>
                      setFormData({ ...formData, specialization: e.target.value })
                    }
                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none ${theme.primaryBorder} focus:bg-white transition-all`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Hospital / Clinic Affiliation
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. Apex Hospital"
                      value={formData.hospitalAffiliation}
                      onChange={(e) =>
                        setFormData({ ...formData, hospitalAffiliation: e.target.value })
                      }
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none ${theme.primaryBorder} focus:bg-white transition-all`}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Doctor accounts are registered with <strong>PENDING</strong> status until credentials are administratively verified.
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-xl text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer disabled:opacity-50 ${theme.primary}`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <span>
                  {isLogin
                    ? `Sign In as ${isDoctor ? "Doctor" : "Patient"}`
                    : `Create ${isDoctor ? "Doctor" : "Patient"} Account`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Secondary Links & Helper Text */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            {isLogin ? "Need a new account?" : "Already have an account?"}{" "}
            <Link
              href={switchModeHref}
              className="font-bold text-teal-700 hover:text-teal-900 hover:underline"
            >
              {isLogin ? "Create account" : "Sign in here"}
            </Link>
          </p>
        </div>

        {/* Security & Regulatory Footer Badge */}
        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>Encrypted HIPAA & Clinical Data Protection</span>
          </p>
        </div>
      </div>
    </div>
  );
}

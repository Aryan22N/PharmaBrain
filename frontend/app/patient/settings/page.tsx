"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Droplets,
  Calendar,
  Edit3,
  Save,
  X,
  Plus,
  FileText,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Activity,
  Shield,
  Heart,
  Stethoscope,
  Trash2,
  RefreshCw,
  Hospital,
  Phone,
  MapPin,
} from "lucide-react";

/* ─── Types ─── */
interface Demographics {
  name: string;
  email: string;
  age: string | number;
  gender: string;
  bloodGroup: string;
  dob: string;
  occupation: string;
  maritalStatus: string;
  nationality: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface ConditionInfo {
  hasDiabetes: boolean;
  diabetesType: string;
  diabetesYear: string;
  currentHba1c: string;
  hasHypertension: boolean;
  hypertensionYear: string;
  currentBp: string;
  hasDyslipidemia: boolean;
}

interface HistoryInfo {
  surgeries: string;
  allergies: string;
  smoking: string;
  alcohol: string;
  familyHistory: string;
}

interface CustomCondition {
  id: string;
  name: string;
  year: string;
  details: string;
}

interface Visit {
  id: string | number;
  date: string;
  hospital: string;
  doctor: string;
  documentType: string;
  status: string;
  summary: string;
}

type TabId = "profile" | "medical" | "visits";

/* ─── Defaults ─── */
const DEFAULT_DEMO: Demographics = {
  name: "", email: "", age: "", gender: "Male", bloodGroup: "",
  dob: "", occupation: "", maritalStatus: "", nationality: "Indian",
  phone: "", emergencyName: "", emergencyPhone: "",
  address: "", city: "", state: "", pincode: "",
};

const DEFAULT_COND: ConditionInfo = {
  hasDiabetes: false, diabetesType: "", diabetesYear: "", currentHba1c: "",
  hasHypertension: false, hypertensionYear: "", currentBp: "", hasDyslipidemia: false,
};

const DEFAULT_HIST: HistoryInfo = {
  surgeries: "", allergies: "", smoking: "", alcohol: "", familyHistory: "",
};

export default function PatientSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [userMeta, setUserMeta] = useState({ name: "", email: "", patientId: "" });
  const [demo, setDemo] = useState<Demographics>(DEFAULT_DEMO);
  const [conditions, setConditions] = useState<ConditionInfo>(DEFAULT_COND);
  const [customConds, setCustomConds] = useState<CustomCondition[]>([]);
  const [history, setHistory] = useState<HistoryInfo>(DEFAULT_HIST);
  const [visits, setVisits] = useState<Visit[]>([]);

  const [editProfile, setEditProfile] = useState(false);
  const [editMedical, setEditMedical] = useState(false);
  const [showAddCond, setShowAddCond] = useState(false);
  const [newCond, setNewCond] = useState({ name: "", year: "", details: "" });

  // Snapshots for cancel
  const [snapDemo, setSnapDemo] = useState<Demographics>(DEFAULT_DEMO);
  const [snapConds, setSnapConds] = useState<ConditionInfo>(DEFAULT_COND);
  const [snapCustom, setSnapCustom] = useState<CustomCondition[]>([]);
  const [snapHist, setSnapHist] = useState<HistoryInfo>(DEFAULT_HIST);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Load Profile ── */
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch("/api/user/profile", {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load profile");

      setUserMeta(data.user || {});
      setDemo({ ...DEFAULT_DEMO, ...(data.demographics || {}) });
      setConditions({ ...DEFAULT_COND, ...(data.conditions || {}) });
      setCustomConds(Array.isArray(data.customConditions) ? data.customConditions : []);
      setHistory({ ...DEFAULT_HIST, ...(data.history || {}) });
      setVisits(data.visits || []);
    } catch (err: any) {
      console.error("loadProfile error:", err);
      showToast("error", err.message || "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  /* ── Edit handlers ── */
  const startEditProfile = () => { setSnapDemo({ ...demo }); setEditProfile(true); };
  const cancelEditProfile = () => { setDemo(snapDemo); setEditProfile(false); };

  const startEditMedical = () => {
    setSnapConds({ ...conditions });
    setSnapCustom([...customConds]);
    setSnapHist({ ...history });
    setEditMedical(true);
  };
  const cancelEditMedical = () => {
    setConditions(snapConds);
    setCustomConds(snapCustom);
    setHistory(snapHist);
    setEditMedical(false);
  };

  /* ── Save ── */
  const saveProfile = async () => {
    setSaving(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ demographics: demo, conditions, customConditions: customConds, history }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed");
      showToast("success", "Profile saved successfully!");
      setEditProfile(false);
      setEditMedical(false);
      await loadProfile();
    } catch (err: any) {
      showToast("error", err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ── Custom conditions ── */
  const addCustomCond = () => {
    if (!newCond.name.trim()) return;
    setCustomConds([...customConds, {
      id: `c-${Date.now()}`,
      name: newCond.name.trim(),
      year: newCond.year.trim() || new Date().getFullYear().toString(),
      details: newCond.details.trim() || "Patient reported",
    }]);
    setNewCond({ name: "", year: "", details: "" });
    setShowAddCond(false);
  };

  /* ── Helpers ── */
  const rawId = userMeta.patientId || "";
  const cleanId = rawId.replace(/^(ABHA:|UHID:)\s*/gi, "").trim();
  const idDisplay = cleanId.startsWith("P-")
    ? `UHID: ${cleanId}`
    : cleanId.length === 9
    ? `ABHA: 91-${cleanId.slice(0, 4)}-${cleanId.slice(4, 8)}-${cleanId.slice(8)}`
    : cleanId ? `ID: ${cleanId}` : "—";

  const inp = (editable: boolean) =>
    `w-full text-[13px] px-3 py-2.5 rounded-xl border font-medium transition-all ${
      editable
        ? "border-[#2F7D78] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2F7D78]/20 shadow-sm"
        : "border-[#DCE4ED] bg-[#F7F9FB] text-[#334155] cursor-default"
    }`;

  const sel = (editable: boolean) =>
    `w-full text-[13px] px-3 py-2.5 rounded-xl border font-medium transition-all ${
      editable
        ? "border-[#2F7D78] bg-white text-[#111827] focus:outline-none"
        : "border-[#DCE4ED] bg-[#F7F9FB] text-[#334155] cursor-default"
    }`;

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Demographics", icon: User },
    { id: "medical", label: "Medical History", icon: Heart },
    { id: "visits", label: "Previous Visits", icon: Clock },
  ];

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#2F7D78] animate-spin" />
          <span className="text-[13px] text-[#64748B] font-medium">Loading your profile…</span>
        </div>
      </div>
    );
  }

  const initials = (demo.name || userMeta.name || "P")
    .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-[13px] font-semibold animate-in slide-in-from-top-2 ${
          toast.type === "success" ? "bg-[#2F7D78] text-white" : "bg-rose-600 text-white"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* ─── Profile Header ─── */}
      <div className="bg-white rounded-2xl border border-[#DCE4ED] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2F7D78] to-[#1a5c58] flex items-center justify-center text-white text-xl font-bold shadow-md">
              {initials}
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#111827]">
                {demo.name || userMeta.name || "Patient"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {idDisplay !== "—" && (
                  <span className="text-[12px] font-mono text-[#64748B] bg-[#F3F6F9] px-2.5 py-1 rounded-lg border border-[#DCE4ED]">
                    {idDisplay}
                  </span>
                )}
                <span className="text-[12px] text-[#64748B]">{demo.email || userMeta.email}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push("/upload")}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2F7D78] hover:bg-[#256B66] text-white text-[13px] font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Add Medical Record
          </button>
        </div>

        {/* Quick stats */}
        <div className="mt-4 pt-4 border-t border-[#DCE4ED] grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Blood Group", value: demo.bloodGroup || "—", icon: Droplets, color: "text-rose-500" },
            { label: "Age", value: demo.age ? `${demo.age} yrs` : "—", icon: Calendar, color: "text-blue-500" },
            { label: "Gender", value: demo.gender || "—", icon: User, color: "text-indigo-500" },
            { label: "Previous Visits", value: String(visits.length), icon: Clock, color: "text-amber-500" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 bg-[#F7F9FB] rounded-xl p-3 border border-[#DCE4ED]">
              <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
              <div className="min-w-0">
                <div className="text-[11px] text-[#64748B] font-medium">{s.label}</div>
                <div className="text-[13px] font-bold text-[#111827] truncate">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="bg-white rounded-2xl border border-[#DCE4ED] shadow-sm overflow-hidden">
        <div className="flex border-b border-[#DCE4ED]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? "text-[#2F7D78] border-b-2 border-[#2F7D78] bg-[#F8FDFC]"
                    : "text-[#64748B] hover:text-[#334155] hover:bg-[#F3F6F9]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">

          {/* ══════════════ DEMOGRAPHICS TAB ══════════════ */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#2F7D78]" /> Personal Demographics
                </h2>
                {!editProfile ? (
                  <button
                    onClick={startEditProfile}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-[#2F7D78] bg-[#E8F6F4] hover:bg-[#C8EAE5] px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEditProfile}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B] bg-[#F3F6F9] hover:bg-[#E8EDF3] px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#2F7D78] hover:bg-[#256B66] px-4 py-1.5 rounded-lg cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Changes
                    </button>
                  </div>
                )}
              </div>

              {editProfile && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] text-blue-800">
                  <Edit3 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Fields are now editable. Make your changes and click <strong>Save Changes</strong> to update your profile.</span>
                </div>
              )}

              {/* Personal Info */}
              <div>
                <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Full Legal Name</label>
                    <input type="text" value={demo.name} onChange={(e) => setDemo((p) => ({ ...p, name: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Email Address</label>
                    <input type="email" value={demo.email} onChange={(e) => setDemo((p) => ({ ...p, email: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Date of Birth</label>
                    <input type={editProfile ? "date" : "text"} value={demo.dob} onChange={(e) => setDemo((p) => ({ ...p, dob: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Age (years)</label>
                    <input type="number" value={demo.age} onChange={(e) => setDemo((p) => ({ ...p, age: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Biological Sex</label>
                    <select value={demo.gender} onChange={(e) => setDemo((p) => ({ ...p, gender: e.target.value }))} disabled={!editProfile} className={sel(editProfile)}>
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Blood Group</label>
                    <select value={demo.bloodGroup} onChange={(e) => setDemo((p) => ({ ...p, bloodGroup: e.target.value }))} disabled={!editProfile} className={sel(editProfile)}>
                      <option value="">— Select —</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Marital Status</label>
                    <select value={demo.maritalStatus} onChange={(e) => setDemo((p) => ({ ...p, maritalStatus: e.target.value }))} disabled={!editProfile} className={sel(editProfile)}>
                      <option value="">— Select —</option>
                      <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Occupation</label>
                    <input type="text" value={demo.occupation} onChange={(e) => setDemo((p) => ({ ...p, occupation: e.target.value }))} readOnly={!editProfile} placeholder="e.g. Software Engineer" className={inp(editProfile)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Nationality</label>
                    <input type="text" value={demo.nationality} onChange={(e) => setDemo((p) => ({ ...p, nationality: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div>
                <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Mobile Number</label>
                    <input type="text" value={demo.phone} onChange={(e) => setDemo((p) => ({ ...p, phone: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Emergency Contact Name</label>
                    <input type="text" value={demo.emergencyName} onChange={(e) => setDemo((p) => ({ ...p, emergencyName: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Emergency Contact Phone</label>
                    <input type="text" value={demo.emergencyPhone} onChange={(e) => setDemo((p) => ({ ...p, emergencyPhone: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Residential Address
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Street / Area Address</label>
                    <input type="text" value={demo.address} onChange={(e) => setDemo((p) => ({ ...p, address: e.target.value }))} readOnly={!editProfile} placeholder="e.g. Flat 402, Sunshine Heights" className={inp(editProfile)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] mb-1.5">City</label>
                      <input type="text" value={demo.city} onChange={(e) => setDemo((p) => ({ ...p, city: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] mb-1.5">State</label>
                      <input type="text" value={demo.state} onChange={(e) => setDemo((p) => ({ ...p, state: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] mb-1.5">Pincode</label>
                      <input type="text" value={demo.pincode} onChange={(e) => setDemo((p) => ({ ...p, pincode: e.target.value }))} readOnly={!editProfile} className={inp(editProfile)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ MEDICAL HISTORY TAB ══════════════ */}
          {activeTab === "medical" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                  <Heart className="w-4 h-4 text-[#2F7D78]" /> Medical History & Conditions
                </h2>
                {!editMedical ? (
                  <button onClick={startEditMedical} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#2F7D78] bg-[#E8F6F4] hover:bg-[#C8EAE5] px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                    <Edit3 className="w-3.5 h-3.5" /> Edit Medical Info
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={cancelEditMedical} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B] bg-[#F3F6F9] px-3 py-1.5 rounded-lg cursor-pointer">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button onClick={saveProfile} disabled={saving} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#2F7D78] hover:bg-[#256B66] px-4 py-1.5 rounded-lg cursor-pointer disabled:opacity-60">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
                    </button>
                  </div>
                )}
              </div>

              {/* Chronic Conditions */}
              <div>
                <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Chronic Conditions
                </h3>
                <div className="space-y-3">
                  {/* Diabetes */}
                  <div className={`p-4 rounded-xl border ${conditions.hasDiabetes ? "border-amber-300 bg-amber-50/60" : "border-[#DCE4ED] bg-[#F7F9FB]"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-600" />
                        <span className="text-[13px] font-semibold text-[#111827]">Diabetes Mellitus</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={conditions.hasDiabetes}
                          onChange={(e) => editMedical && setConditions((c) => ({ ...c, hasDiabetes: e.target.checked }))}
                          disabled={!editMedical}
                          className="sr-only peer"
                        />
                        <div className={`w-9 h-5 rounded-full transition-colors peer-checked:bg-[#2F7D78] bg-gray-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 ${!editMedical ? "opacity-60" : ""}`} />
                      </label>
                    </div>
                    {conditions.hasDiabetes && (
                      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-amber-200">
                        {[
                          { label: "Type", key: "diabetesType", placeholder: "e.g. Type 2" },
                          { label: "Year Diagnosed", key: "diabetesYear", placeholder: "e.g. 2019" },
                          { label: "Latest HbA1c", key: "currentHba1c", placeholder: "e.g. 7.2%" },
                        ].map(({ label, key, placeholder }) => (
                          <div key={key}>
                            <label className="block text-[11px] font-bold text-[#334155] mb-1">{label}</label>
                            <input type="text" value={(conditions as any)[key] || ""} onChange={(e) => editMedical && setConditions((c) => ({ ...c, [key]: e.target.value }))} readOnly={!editMedical} placeholder={placeholder} className={inp(editMedical)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hypertension */}
                  <div className={`p-4 rounded-xl border ${conditions.hasHypertension ? "border-rose-300 bg-rose-50/60" : "border-[#DCE4ED] bg-[#F7F9FB]"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-600" />
                        <span className="text-[13px] font-semibold text-[#111827]">Hypertension</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={conditions.hasHypertension} onChange={(e) => editMedical && setConditions((c) => ({ ...c, hasHypertension: e.target.checked }))} disabled={!editMedical} className="sr-only peer" />
                        <div className={`w-9 h-5 rounded-full transition-colors peer-checked:bg-[#2F7D78] bg-gray-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 ${!editMedical ? "opacity-60" : ""}`} />
                      </label>
                    </div>
                    {conditions.hasHypertension && (
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-rose-200">
                        {[
                          { label: "Year Onset", key: "hypertensionYear", placeholder: "e.g. 2020" },
                          { label: "Typical BP", key: "currentBp", placeholder: "e.g. 140/90" },
                        ].map(({ label, key, placeholder }) => (
                          <div key={key}>
                            <label className="block text-[11px] font-bold text-[#334155] mb-1">{label}</label>
                            <input type="text" value={(conditions as any)[key] || ""} onChange={(e) => editMedical && setConditions((c) => ({ ...c, [key]: e.target.value }))} readOnly={!editMedical} placeholder={placeholder} className={inp(editMedical)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dyslipidemia */}
                  <div className={`p-4 rounded-xl border ${conditions.hasDyslipidemia ? "border-purple-300 bg-purple-50/60" : "border-[#DCE4ED] bg-[#F7F9FB]"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-purple-600" />
                        <span className="text-[13px] font-semibold text-[#111827]">Dyslipidemia (High Cholesterol)</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={conditions.hasDyslipidemia} onChange={(e) => editMedical && setConditions((c) => ({ ...c, hasDyslipidemia: e.target.checked }))} disabled={!editMedical} className="sr-only peer" />
                        <div className={`w-9 h-5 rounded-full transition-colors peer-checked:bg-[#2F7D78] bg-gray-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 ${!editMedical ? "opacity-60" : ""}`} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Conditions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" /> Other Diagnosed Conditions
                  </h3>
                  {editMedical && (
                    <button onClick={() => setShowAddCond(true)} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#2F7D78] bg-[#E8F6F4] hover:bg-[#C8EAE5] px-3 py-1.5 rounded-lg cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> Add Condition
                    </button>
                  )}
                </div>

                {showAddCond && editMedical && (
                  <div className="p-4 bg-[#E8F6F4] border border-[#C8EAE5] rounded-xl mb-3 space-y-3">
                    <h4 className="text-[12px] font-bold text-[#256B66]">New Condition</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Condition Name *", key: "name", placeholder: "e.g. Hypothyroidism" },
                        { label: "Year Diagnosed", key: "year", placeholder: "e.g. 2022" },
                        { label: "Clinical Notes", key: "details", placeholder: "Optional" },
                      ].map(({ label, key, placeholder }) => (
                        <div key={key}>
                          <label className="block text-[11px] font-bold text-[#334155] mb-1">{label}</label>
                          <input type="text" value={(newCond as any)[key]} onChange={(e) => setNewCond((c) => ({ ...c, [key]: e.target.value }))} placeholder={placeholder} className="w-full text-[13px] px-3 py-2 rounded-lg border border-[#2F7D78] bg-white focus:outline-none" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddCond(false)} className="text-[12px] font-semibold text-[#64748B] px-3 py-1.5 rounded-lg bg-white border border-[#DCE4ED] cursor-pointer">Cancel</button>
                      <button onClick={addCustomCond} className="text-[12px] font-semibold text-white px-4 py-1.5 rounded-lg bg-[#2F7D78] cursor-pointer">Save</button>
                    </div>
                  </div>
                )}

                {customConds.length === 0 && (
                  <p className="text-center py-5 text-[13px] text-[#94A3B8] bg-[#F7F9FB] rounded-xl border border-dashed border-[#DCE4ED]">
                    No additional conditions recorded.{editMedical && " Click 'Add Condition' to add one."}
                  </p>
                )}
                <div className="space-y-2">
                  {customConds.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-white border border-[#DCE4ED] rounded-xl">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#111827]">{c.name}</span>
                          <span className="text-[11px] bg-[#F3F6F9] text-[#64748B] px-2 py-0.5 rounded border border-[#DCE4ED]">{c.year}</span>
                        </div>
                        {c.details && <p className="text-[12px] text-[#64748B] mt-0.5">{c.details}</p>}
                      </div>
                      {editMedical && (
                        <button onClick={() => setCustomConds(customConds.filter((x) => x.id !== c.id))} className="p-1.5 text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Past Medical History */}
              <div>
                <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Past Medical History
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Known Allergies & Drug Reactions", key: "allergies", placeholder: "e.g. Penicillin, Sulfa drugs…" },
                    { label: "Past Surgeries & Hospitalizations", key: "surgeries", placeholder: "e.g. Appendectomy 2015…" },
                    { label: "Family Medical History", key: "familyHistory", placeholder: "e.g. Father – Type 2 DM, Mother – HTN…" },
                    { label: "Smoking Status", key: "smoking", placeholder: "e.g. Non-smoker / 10 cigarettes/day" },
                    { label: "Alcohol Use", key: "alcohol", placeholder: "e.g. Occasional / Social drinker" },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[11px] font-bold text-[#334155] mb-1.5">{label}</label>
                      <textarea
                        rows={2}
                        value={(history as any)[key] || ""}
                        onChange={(e) => editMedical && setHistory((h) => ({ ...h, [key]: e.target.value }))}
                        readOnly={!editMedical}
                        placeholder={placeholder}
                        className={`${inp(editMedical)} resize-none`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ PREVIOUS VISITS TAB ══════════════ */}
          {activeTab === "visits" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#2F7D78]" /> Previous Hospital Visits
                  <span className="text-[13px] font-normal text-[#64748B]">({visits.length})</span>
                </h2>
                <div className="flex gap-2">
                  <button onClick={loadProfile} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B] bg-[#F3F6F9] hover:bg-[#E8EDF3] px-3 py-1.5 rounded-lg cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                  <button onClick={() => router.push("/upload")} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#2F7D78] hover:bg-[#256B66] px-3 py-1.5 rounded-lg cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Add Visit Record
                  </button>
                </div>
              </div>

              {visits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 bg-[#F7F9FB] rounded-2xl border-2 border-dashed border-[#DCE4ED]">
                  <div className="w-14 h-14 rounded-2xl bg-[#E8F6F4] flex items-center justify-center">
                    <FileText className="w-7 h-7 text-[#2F7D78]" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#334155]">No visit records found</p>
                    <p className="text-[12px] text-[#64748B] mt-1">Upload prescriptions or documents to log your hospital visits.</p>
                  </div>
                  <button onClick={() => router.push("/upload")} className="flex items-center gap-2 px-4 py-2.5 bg-[#2F7D78] text-white text-[13px] font-semibold rounded-xl cursor-pointer">
                    <Upload className="w-4 h-4" /> Upload Medical Record
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {visits.map((visit) => {
                    const d = new Date(visit.date);
                    const dateStr = isNaN(d.getTime()) ? visit.date : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                    const statusColor =
                      visit.status === "CONFIRMED" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : visit.status === "DISCARDED" ? "text-rose-700 bg-rose-50 border-rose-200"
                        : "text-amber-700 bg-amber-50 border-amber-200";
                    return (
                      <div key={visit.id} className="p-4 bg-white border border-[#DCE4ED] rounded-xl hover:border-[#2F7D78]/40 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#E8F6F4] flex items-center justify-center shrink-0">
                              <Hospital className="w-4 h-4 text-[#2F7D78]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-bold text-[#111827]">{visit.hospital}</span>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>{visit.status || "Pending"}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-[12px] text-[#64748B] flex items-center gap-1"><User className="w-3 h-3" />{visit.doctor}</span>
                                <span className="text-[12px] text-[#64748B] flex items-center gap-1"><FileText className="w-3 h-3" />{visit.documentType}</span>
                                <span className="text-[12px] text-[#64748B] flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</span>
                              </div>
                              {visit.summary && <p className="text-[12px] text-[#64748B] mt-1.5 line-clamp-2">{visit.summary}</p>}
                            </div>
                          </div>
                          <button onClick={() => router.push("/patient/documents")} className="shrink-0 p-1.5 text-[#94A3B8] hover:text-[#2F7D78] hover:bg-[#E8F6F4] rounded-lg cursor-pointer transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button onClick={() => router.push("/upload")} className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[#C8EAE5] rounded-xl text-[13px] font-semibold text-[#2F7D78] hover:bg-[#E8F6F4] transition-colors cursor-pointer">
                    <Plus className="w-4 h-4" /> Add Another Visit Record via OCR Upload
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

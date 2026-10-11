"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Activity,
  Home,
  FolderSync,
  Clock,
  TrendingUp,
  Pill,
  FileText,
  ShieldCheck,
  Settings,
  Search,
  Bell,
  Plus,
  LogOut,
  CheckCircle2,
  X,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { PatientDashboardProvider, usePatientDashboard } from "./context";
import { PatientModals } from "@/components/patient/PatientModals";

function Sidebar() {
  const { userData, documents, recordedMedicines, doctorSharing } = usePatientDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const userName = userData?.name ?? "Rahul Sharma";
  const userInitials =
    userData?.initials ??
    (userData?.name
      ? userData.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
      : "RS");
  const patientCode = userData?.patientId ?? userData?.patientCode ?? "483027156";
  const abhaId = patientCode.length === 9
    ? `91-${patientCode.slice(0, 4)}-${patientCode.slice(4, 8)}-${patientCode.slice(8)}`
    : `ABHA: ${patientCode}`;

  const activeMedsCount = recordedMedicines.filter((m: { status?: string }) => m.status === "ACTIVE").length;

  const navItems = [
    { name: "Home", href: "/patient/overview", icon: Home },
    {
      name: "My Medical Records",
      href: "/patient/documents",
      icon: FolderSync,
      badge: documents.length > 0 ? String(documents.length) : undefined,
    },
    { name: "Health Timeline", href: "/patient/timeline", icon: Clock },
    {
      name: "Medicines",
      href: "/patient/medicines",
      icon: Pill,
      badge: activeMedsCount > 0 ? String(activeMedsCount) : undefined,
    },
    { name: "Vitals & Trends", href: "/patient/trends", icon: TrendingUp },
    { name: "Reports", href: "/patient/documents", icon: FileText },
    {
      name: "Share with Doctor",
      href: "/patient/sharing",
      icon: ShieldCheck,
      statusBadge: doctorSharing?.status === "APPROVED" ? "Connected" : undefined,
    },
    { name: "Settings", href: "/patient/onboarding", icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { }
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
    }
    router.push("/auth");
  };

  return (
    <aside className="w-[260px] bg-white border-r border-[#DCE4ED] flex flex-col justify-between shrink-0 shadow-[0_1px_6px_rgba(0,0,0,0.03)] z-20 min-h-screen">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-[68px] px-5 flex items-center gap-3 border-b border-[#DCE4ED]">
          <div className="w-9 h-9 rounded-lg bg-[#2F7D78] flex items-center justify-center text-white shadow-xs">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-[#111827] tracking-tight">
              PharmaBrain
            </span>
            <span className="text-[11px] text-[#64748B]">
              Patient Clinical Portal
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/patient/overview" && pathname === "/patient");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all group relative ${isActive
                    ? "bg-[#E8F6F4] text-[#256B66] font-semibold before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-[#2F7D78] before:rounded-r"
                    : "text-[#334155] hover:bg-[#F3F6F9] hover:text-[#111827]"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-[19px] h-[19px] transition-colors ${isActive ? "text-[#2F7D78]" : "text-[#94A3B8] group-hover:text-[#2F7D78]"
                      }`}
                  />
                  <span className={`text-[13px] ${isActive ? "font-semibold" : "font-medium"}`}>
                    {item.name}
                  </span>
                </div>

                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F3F6F9] text-[11px] text-[#334155] font-semibold">
                    {item.badge}
                  </span>
                )}

                {item.statusBadge && (
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#256B66] text-[11px] font-semibold">
                    {item.statusBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Patient Profile Box at Bottom */}
      <div className="p-3 m-3 bg-[#F3F6F9] border border-[#DCE4ED] rounded-xl flex items-center justify-between gap-2 relative">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#2F7D78] text-white font-semibold text-xs flex items-center justify-center shrink-0">
            {userInitials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold text-[#111827] truncate">
              {userName}
            </span>
            <span className="font-mono text-[11px] text-[#64748B] truncate">
              ABHA: {abhaId}
            </span>
          </div>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Profile Options"
          className="text-[#64748B] hover:text-[#111827] p-1 rounded hover:bg-[#E8F6F4] transition-colors shrink-0 cursor-pointer"
          type="button"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border border-[#DCE4ED] rounded-xl shadow-lg p-1.5 z-30">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function TopHeader() {
  const router = useRouter();
  const { userData, pendingDocuments } = usePatientDashboard();
  const [searchQuery, setSearchQuery] = useState("");

  const userInitials =
    userData?.initials ??
    (userData?.name
      ? userData.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
      : "RS");

  return (
    <header className="h-[68px] bg-white backdrop-blur-md border-b border-[#DCE4ED] shadow-[0_1px_4px_rgba(0,0,0,0.02)] sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[#64748B] text-[13px]">
          <span className="font-medium">Portal</span>
          <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
          <span className="text-[#2F7D78] font-semibold">Clinical Overview</span>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="relative flex items-center w-72 md:w-80">
          <Search className="w-4 h-4 absolute left-3 text-[#94A3B8]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#F3F6F9] border border-[#DCE4ED] rounded-lg text-[13px] text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2F7D78] focus:bg-white transition-all"
            placeholder="Search records, medications, lab tests... (Cmd+K)"
            type="text"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/patient/documents"
            aria-label="Notifications"
            className="relative p-2 rounded-lg text-[#64748B] hover:bg-[#F3F6F9] hover:text-[#111827] transition-colors"
          >
            <Bell className="w-5 h-5" />
            {pendingDocuments.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#F59E0B] text-white font-mono text-[10px] flex items-center justify-center font-bold">
                {pendingDocuments.length}
              </span>
            )}
          </Link>

          <button
            onClick={() => router.push("/upload")}
            className="h-9 px-4 rounded-lg bg-[#2F7D78] text-white hover:bg-[#256B66] transition-all flex items-center gap-1.5 shadow-sm font-medium text-[13px] cursor-pointer"
            type="button"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Upload Medical Record</span>
          </button>

          <div
            title={userData?.name || "Patient Profile"}
            className="w-8 h-8 rounded-full bg-[#2F7D78] text-white flex items-center justify-center shrink-0 text-xs font-semibold cursor-pointer shadow-xs"
          >
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}

function PatientLayoutContent({ children }: { children: React.ReactNode }) {
  const { notification, setNotification } = usePatientDashboard();

  return (
    <div className="min-h-screen bg-[#F7F9FB] text-[#111827] font-sans flex flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Notification Toast */}
        {notification && (
          <div className="bg-[#2F7D78] text-white text-xs font-semibold px-6 py-2.5 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#A7E9DF]" />
              <span>{notification}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-[#E8F6F4] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <TopHeader />

        <main className="flex-1 p-6 pb-12 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Modals */}
      <PatientModals />
    </div>
  );
}

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PatientDashboardProvider>
      <PatientLayoutContent>{children}</PatientLayoutContent>
    </PatientDashboardProvider>
  );
}

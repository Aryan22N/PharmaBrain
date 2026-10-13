"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Doctor Patient Dossier Render Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-[#FECACA] rounded-2xl p-8 shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] text-[#DC2626] mx-auto flex items-center justify-center border border-[#FCA5A5]">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
            Clinical Dossier Error
          </span>
          <h2 className="text-lg font-bold text-[#0F172A] mt-2">Unable to Render Patient Dossier</h2>
          <p className="text-xs text-[#DC2626] mt-2 font-mono bg-[#FEF2F2] p-2.5 rounded-lg text-left break-words border border-[#FECACA]">
            {error?.message || "An unexpected error occurred while rendering the clinical dossier."}
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/doctor/dashboard"
            className="px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Doctor Dashboard
          </Link>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-[#2F7D78] hover:bg-[#256B66] text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}

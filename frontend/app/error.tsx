"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Render Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center p-4 text-[#0F172A]">
      <div className="max-w-md w-full bg-white border border-[#DCE4ED] rounded-2xl p-8 shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] text-[#DC2626] mx-auto flex items-center justify-center border border-[#FECACA]">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">Something went wrong</h2>
          <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
            {error?.message || "An unexpected error occurred while loading this page."}
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 bg-white hover:bg-[#F1F5F9] border border-[#DCE4ED] text-[#334155] rounded-xl text-xs font-semibold transition-colors"
          >
            Home
          </Link>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-[#2F7D78] hover:bg-[#256B66] text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Page</span>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { usePatientDashboard } from "@/app/patient/context";
import { LongitudinalTrendsDashboard } from "@/components/trends/LongitudinalTrendsDashboard";

export default function TrendsPage() {
  const { documents } = usePatientDashboard();

  return <LongitudinalTrendsDashboard documents={documents} />;
}

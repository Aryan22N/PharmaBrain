"use client";

import React from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function PatientLoginPage() {
  return <AuthForm role="PATIENT" mode="login" />;
}

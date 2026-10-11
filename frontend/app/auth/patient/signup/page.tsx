"use client";

import React from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function PatientSignupPage() {
  return <AuthForm role="PATIENT" mode="signup" />;
}

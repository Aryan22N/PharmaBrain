"use client";

import React from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function DoctorSignupPage() {
  return <AuthForm role="DOCTOR" mode="signup" />;
}

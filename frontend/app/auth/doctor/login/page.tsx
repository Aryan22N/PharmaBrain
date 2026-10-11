"use client";

import React from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function DoctorLoginPage() {
  return <AuthForm role="DOCTOR" mode="login" />;
}

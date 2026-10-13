"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface DashboardMetrics {
  totalRecords: number;
  hospitalVerified: number;
  activeMeds: number;
  lastHbA1c: string;
  bloodPressure: string;
  historyCoverage: string;
  activeConditionsCount?: number;
  recordsToReviewCount?: number;
}

export interface BiomarkerMetric {
  latestValue: string;
  numericValue: number | null;
  unit: string;
  date: string | null;
  targetRange: string;
  statusLabel: string;
  trendNote: string;
  history: { value: number; date: string }[];
}

export interface VitalsState {
  glucose: BiomarkerMetric;
  hba1c: BiomarkerMetric;
  bp: BiomarkerMetric;
  weight: BiomarkerMetric;
}

export interface PatientDashboardContextType {
  loading: boolean;
  userData: any | null;
  metrics: DashboardMetrics;
  documents: any[];
  pendingDocuments: any[];
  conditions: any[];
  allergies: any[];
  vitals: VitalsState;
  doctorSharing: any | null;
  longitudinalSummary: {
    diagnoses: string;
    glycemicStatus: string;
    regimen: string;
  };
  timelineEvents: any[];
  recordedMedicines: any[];
  conflictingMedicines: any[];
  refresh: () => Promise<void>;

  // Modals & detail states
  selectedSummaryRecord: any | null;
  setSelectedSummaryRecord: (doc: any | null) => void;

  addTimelineModalOpen: boolean;
  setAddTimelineModalOpen: (open: boolean) => void;
  submittingTimeline: boolean;
  newTimeline: any;
  setNewTimeline: React.Dispatch<React.SetStateAction<any>>;
  handleAddTimeline: (e: React.FormEvent) => Promise<void>;

  addMedicineModalOpen: boolean;
  setAddMedicineModalOpen: (open: boolean) => void;
  submittingMedicine: boolean;
  newMedicine: any;
  setNewMedicine: React.Dispatch<React.SetStateAction<any>>;
  handleAddMedicine: (e: React.FormEvent) => Promise<void>;

  addAllergyModalOpen: boolean;
  setAddAllergyModalOpen: (open: boolean) => void;
  submittingAllergy: boolean;
  newAllergy: any;
  setNewAllergy: React.Dispatch<React.SetStateAction<any>>;
  handleAddAllergy: (e: React.FormEvent) => Promise<void>;

  addConditionModalOpen: boolean;
  setAddConditionModalOpen: (open: boolean) => void;
  submittingCondition: boolean;
  newCondition: any;
  setNewCondition: React.Dispatch<React.SetStateAction<any>>;
  handleAddCondition: (e: React.FormEvent) => Promise<void>;

  ocrModalOpen: boolean;
  setOcrModalOpen: (open: boolean) => void;
  notification: string | null;
  setNotification: (msg: string | null) => void;
}

const defaultVitals: VitalsState = {
  glucose: {
    latestValue: "--",
    numericValue: null,
    unit: "mg/dL",
    date: null,
    targetRange: "70 - 130 mg/dL (Fasting)",
    statusLabel: "No data",
    trendNote: "No fasting glucose recorded",
    history: [],
  },
  hba1c: {
    latestValue: "--",
    numericValue: null,
    unit: "%",
    date: null,
    targetRange: "< 7.0 % (Type 2 DM)",
    statusLabel: "No data",
    trendNote: "No HbA1c lab result recorded",
    history: [],
  },
  bp: {
    latestValue: "-- / --",
    numericValue: null,
    unit: "mmHg",
    date: null,
    targetRange: "< 130 / 80 mmHg",
    statusLabel: "No data",
    trendNote: "No blood pressure recorded",
    history: [],
  },
  weight: {
    latestValue: "--",
    numericValue: null,
    unit: "kg",
    date: null,
    targetRange: "62.0 - 72.0 kg (BMI 18.5 - 24.9)",
    statusLabel: "No data",
    trendNote: "No body weight recorded",
    history: [],
  },
};

const PatientDashboardContext = createContext<PatientDashboardContextType | null>(null);

export function usePatientDashboard(): PatientDashboardContextType {
  const ctx = useContext(PatientDashboardContext);
  if (!ctx) {
    throw new Error("usePatientDashboard must be used within a PatientDashboardProvider");
  }
  return ctx;
}

export const useDashboard = usePatientDashboard;

export function PatientDashboardProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRecords: 0,
    hospitalVerified: 0,
    activeMeds: 0,
    lastHbA1c: "--",
    bloodPressure: "--",
    historyCoverage: "0%",
    activeConditionsCount: 0,
    recordsToReviewCount: 0,
  });
  const [documents, setDocuments] = useState<any[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<any[]>([]);
  const [conditions, setConditions] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [vitals, setVitals] = useState<VitalsState>(defaultVitals);
  const [doctorSharing, setDoctorSharing] = useState<any | null>(null);
  const [longitudinalSummary, setLongitudinalSummary] = useState({
    diagnoses: "No active clinical conditions recorded in electronic health record.",
    glycemicStatus: "Glycemic biomarkers not yet documented in laboratory history.",
    regimen: "No ongoing pharmacotherapy recorded.",
  });
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [recordedMedicines, setRecordedMedicines] = useState<any[]>([]);
  const [conflictingMedicines, setConflictingMedicines] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Selected summary record for full detail modal
  const [selectedSummaryRecord, setSelectedSummaryRecord] = useState<any | null>(null);

  // Add Timeline Entry Modal state
  const [addTimelineModalOpen, setAddTimelineModalOpen] = useState(false);
  const [submittingTimeline, setSubmittingTimeline] = useState(false);
  const [newTimeline, setNewTimeline] = useState({
    event_date: new Date().toISOString().split("T")[0],
    category: "Symptom Report",
    title: "",
    description: "",
    source: "Manual Entry",
    facility: "Patient Home Portal",
    doctor: "Patient Self-Report",
    reliability: "Low",
    verification_status: "Patient Confirmed",
    reference_id: "",
    is_conflicting: false,
    conflict_details: "",
  });

  // Add Medicine Modal state
  const [addMedicineModalOpen, setAddMedicineModalOpen] = useState(false);
  const [submittingMedicine, setSubmittingMedicine] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: "",
    strength: "",
    status: "ACTIVE",
    indication: "",
    frequency: "Once daily",
    route: "Oral",
    start_date: new Date().toISOString().split("T")[0],
    doctor: "Consulting Physician",
    reference_id: "",
    source: "Manual Entry",
    reliability: "Medium",
    verification_status: "Patient Confirmed",
    is_conflicting: false,
    conflict_details: "",
  });

  // Add Allergy Modal state
  const [addAllergyModalOpen, setAddAllergyModalOpen] = useState(false);
  const [submittingAllergy, setSubmittingAllergy] = useState(false);
  const [newAllergy, setNewAllergy] = useState({
    allergen: "",
    category: "Medication",
    reaction: "",
    severity: "Moderate",
    status: "Patient Reported",
    notes: "",
  });

  // Add Condition Modal state
  const [addConditionModalOpen, setAddConditionModalOpen] = useState(false);
  const [submittingCondition, setSubmittingCondition] = useState(false);
  const [newCondition, setNewCondition] = useState({
    condition_name: "",
    category: "Chronic",
    status: "ACTIVE",
    diagnosed_date: new Date().toISOString().split("T")[0],
    severity: "Moderate",
    doctor: "Consulting Physician",
    facility: "Clinical Care Center",
    notes: "",
  });

  // OCR quick scan modal state
  const [ocrModalOpen, setOcrModalOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        if (typeof window !== "undefined") {
          window.location.href = "/auth/patient/login";
        }
        return;
      }

      const res = await fetch("/api/user/dashboard", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user");
          window.location.href = "/auth/patient/login";
        }
        return;
      }

      if (res.status === 403) {
        if (typeof window !== "undefined") {
          window.location.href = "/doctor/dashboard";
        }
        return;
      }

      const data = await res.json();
      if (data.success) {
        if (data.user) setUserData(data.user);
        if (data.metrics) setMetrics(data.metrics);
        if (data.documents) setDocuments(data.documents);
        if (data.pendingDocuments) setPendingDocuments(data.pendingDocuments);
        if (data.conditions) setConditions(data.conditions);
        if (data.allergies) setAllergies(data.allergies);
        if (data.vitals) setVitals(data.vitals);
        if (data.doctorSharing) setDoctorSharing(data.doctorSharing);
        if (data.longitudinalSummary) setLongitudinalSummary(data.longitudinalSummary);
        if (data.timelineEvents) setTimelineEvents(data.timelineEvents);
        if (data.recordedMedicines) setRecordedMedicines(data.recordedMedicines);
        if (data.conflictingMedicines) setConflictingMedicines(data.conflictingMedicines);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleAddTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTimeline.title.trim()) return;
    try {
      setSubmittingTimeline(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        window.location.href = "/auth/patient/login";
        return;
      }
      const res = await fetch("/api/patient/timeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTimeline),
      });
      const resData = await res.json();
      if (resData.success) {
        setAddTimelineModalOpen(false);
        setNewTimeline({
          event_date: new Date().toISOString().split("T")[0],
          category: "Symptom Report",
          title: "",
          description: "",
          source: "Manual Entry",
          facility: "Patient Home Portal",
          doctor: "Patient Self-Report",
          reliability: "Low",
          verification_status: "Patient Confirmed",
          reference_id: "",
          is_conflicting: false,
          conflict_details: "",
        });
        setNotification("Timeline note added successfully!");
        await fetchDashboardData();
      } else {
        alert(resData.error || "Failed to save timeline entry");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingTimeline(false);
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedicine.name.trim()) return;
    try {
      setSubmittingMedicine(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        window.location.href = "/auth/patient/login";
        return;
      }
      const res = await fetch("/api/patient/medicines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newMedicine),
      });
      const resData = await res.json();
      if (resData.success) {
        setAddMedicineModalOpen(false);
        setNewMedicine({
          name: "",
          strength: "",
          status: "ACTIVE",
          indication: "",
          frequency: "Once daily",
          route: "Oral",
          start_date: new Date().toISOString().split("T")[0],
          doctor: "Consulting Physician",
          reference_id: "",
          source: "Manual Entry",
          reliability: "Medium",
          verification_status: "Patient Confirmed",
          is_conflicting: false,
          conflict_details: "",
        });
        setNotification("New medication order recorded successfully!");
        await fetchDashboardData();
      } else {
        alert(resData.error || "Failed to save medicine record");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingMedicine(false);
    }
  };

  const handleAddAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllergy.allergen.trim()) return;
    try {
      setSubmittingAllergy(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        window.location.href = "/auth/patient/login";
        return;
      }
      const res = await fetch("/api/patient/allergies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newAllergy),
      });
      const resData = await res.json();
      if (resData.success) {
        setAddAllergyModalOpen(false);
        setNewAllergy({
          allergen: "",
          category: "Medication",
          reaction: "",
          severity: "Moderate",
          status: "Patient Reported",
          notes: "",
        });
        setNotification("Allergy record saved successfully!");
        await fetchDashboardData();
      } else {
        alert(resData.error || "Failed to save allergy");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingAllergy(false);
    }
  };

  const handleAddCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCondition.condition_name.trim()) return;
    try {
      setSubmittingCondition(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        window.location.href = "/auth/patient/login";
        return;
      }
      const res = await fetch("/api/patient/conditions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newCondition),
      });
      const resData = await res.json();
      if (resData.success) {
        setAddConditionModalOpen(false);
        setNewCondition({
          condition_name: "",
          category: "Chronic",
          status: "ACTIVE",
          diagnosed_date: new Date().toISOString().split("T")[0],
          severity: "Moderate",
          doctor: "Consulting Physician",
          facility: "Clinical Care Center",
          notes: "",
        });
        setNotification("Clinical condition added successfully!");
        await fetchDashboardData();
      } else {
        alert(resData.error || "Failed to add condition");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingCondition(false);
    }
  };

  return (
    <PatientDashboardContext.Provider
      value={{
        loading,
        userData,
        metrics,
        documents,
        pendingDocuments,
        conditions,
        allergies,
        vitals,
        doctorSharing,
        longitudinalSummary,
        timelineEvents,
        recordedMedicines,
        conflictingMedicines,
        refresh: fetchDashboardData,
        selectedSummaryRecord,
        setSelectedSummaryRecord,
        addTimelineModalOpen,
        setAddTimelineModalOpen,
        submittingTimeline,
        newTimeline,
        setNewTimeline,
        handleAddTimeline,
        addMedicineModalOpen,
        setAddMedicineModalOpen,
        submittingMedicine,
        newMedicine,
        setNewMedicine,
        handleAddMedicine,
        addAllergyModalOpen,
        setAddAllergyModalOpen,
        submittingAllergy,
        newAllergy,
        setNewAllergy,
        handleAddAllergy,
        addConditionModalOpen,
        setAddConditionModalOpen,
        submittingCondition,
        newCondition,
        setNewCondition,
        handleAddCondition,
        ocrModalOpen,
        setOcrModalOpen,
        notification,
        setNotification,
      }}
    >
      {children}
    </PatientDashboardContext.Provider>
  );
}

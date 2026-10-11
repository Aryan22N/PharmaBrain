/**
 * Returns the database patient identifiers that belong to the authenticated
 * account. The canonical patient ID is preferred, while the legacy ID keeps
 * existing prescription records accessible during the ID migration.
 */
export interface PatientIdentity {
  patientId?: string | null;
  legacyPatientId?: string | null;
}

export function getPatientIds(user: PatientIdentity): string[] {
  return Array.from(
    new Set(
      [user.patientId, user.legacyPatientId]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  );
}

export function getPrimaryPatientId(user: PatientIdentity): string | null {
  return getPatientIds(user)[0] || null;
}

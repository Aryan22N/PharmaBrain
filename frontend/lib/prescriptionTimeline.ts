import { pool } from "@/lib/db";

type TimelineEvent = {
  id?: string | number;
  document_id?: string | number;
  extraction_id?: string | number;
  reference_id?: string | null;
  title?: string;
  status?: string;
  verification_status?: string;
  source?: string;
  [key: string]: unknown;
};

type ConfirmedPrescriptionEvent = {
  patientId: string;
  userId: number;
  extractionId: string | number | null;
  documentId: string | number;
  eventDate: string;
  title: string;
  description: string;
  facility: string;
  doctor: string;
};

export function getPrescriptionTimelineReference(
  extractionId: string | number | null | undefined,
  documentId: string | number
): string {
  const normalizedExtractionId = String(extractionId ?? "").trim();
  return /^\d+$/.test(normalizedExtractionId)
    ? `RX-EXTRACTION-${normalizedExtractionId}`
    : `RX-DOCUMENT-${String(documentId).trim()}`;
}

/**
 * Writes one confirmed timeline event per prescription in a transaction.
 * The partial unique index is installed by the idempotent timeline migration.
 */
export async function upsertConfirmedPrescriptionTimelineEvent(
  event: ConfirmedPrescriptionEvent
): Promise<void> {
  const referenceId = getPrescriptionTimelineReference(
    event.extractionId,
    event.documentId
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0));",
      [`prescription-timeline:${event.userId}:${referenceId}`]
    );
    await client.query(
      `INSERT INTO patient_timeline_events (
        patient_id, user_id, event_date, category, title, description,
        source, reliability, verification_status, facility, doctor, reference_id,
        is_conflicting, conflict_details
      ) VALUES ($1, $2, $3, 'Medication', $4, $5, 'Prescription Scan', 'High',
        'Prescription Verified', $6, $7, $8, false, null)
      ON CONFLICT (user_id, reference_id)
        WHERE user_id IS NOT NULL
          AND source = 'Prescription Scan'
          AND verification_status = 'Prescription Verified'
          AND reference_id LIKE 'RX-%'
      DO UPDATE SET
        patient_id = EXCLUDED.patient_id,
        event_date = EXCLUDED.event_date,
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        reliability = EXCLUDED.reliability,
        facility = EXCLUDED.facility,
        doctor = EXCLUDED.doctor,
        is_conflicting = EXCLUDED.is_conflicting,
        conflict_details = EXCLUDED.conflict_details;`,
      [
        event.patientId,
        event.userId,
        event.eventDate,
        event.title,
        event.description,
        event.facility,
        event.doctor,
        referenceId,
      ]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function confirmedRank(event: TimelineEvent): number {
  if (
    event.status === "CONFIRMED" ||
    event.verification_status === "Prescription Verified" ||
    event.verification_status === "Hospital Verified"
  ) {
    return 2;
  }
  return event.status === "NOT CONFIRMED" || event.status === "PENDING" ? 0 : 1;
}

/** Merge document-derived and persisted events by prescription identity. */
export function mergeTimelineEvents(
  persistedEvents: TimelineEvent[],
  documentEvents: TimelineEvent[]
): TimelineEvent[] {
  const extractionByDocumentId = new Map<string, string>();
  for (const event of documentEvents) {
    if (event.document_id != null && event.extraction_id != null) {
      extractionByDocumentId.set(
        String(event.document_id),
        String(event.extraction_id)
      );
    }
  }

  const identityFor = (event: TimelineEvent, index: number): string => {
    if (event.extraction_id != null) {
      return `prescription:${String(event.extraction_id)}`;
    }
    if (event.document_id != null) {
      const documentId = String(event.document_id);
      return `prescription:${extractionByDocumentId.get(documentId) || `document-${documentId}`}`;
    }

    const referenceId = String(event.reference_id || "");
    const extractionMatch = referenceId.match(
      /^(?:RX-EXTRACTION-|HMS-RX-)(\d+)$/
    );
    if (extractionMatch) return `prescription:${extractionMatch[1]}`;

    const documentMatch = referenceId.match(/^(?:RX-DOCUMENT-|HMS-DOC-)(\d+)$/);
    if (documentMatch) {
      const documentId = documentMatch[1];
      return `prescription:${extractionByDocumentId.get(documentId) || `document-${documentId}`}`;
    }

    // Non-prescription/manual events remain distinct, even when their title
    // and date happen to match another event.
    return `timeline-event:${String(event.id ?? index)}`;
  };

  const merged = new Map<string, TimelineEvent>();
  [...persistedEvents, ...documentEvents].forEach((event, index) => {
    const key = identityFor(event, index);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, event);
      return;
    }

    const winner = confirmedRank(event) > confirmedRank(existing) ? event : existing;
    const other = winner === event ? existing : event;
    merged.set(key, {
      ...other,
      ...winner,
      document_id: winner.document_id ?? other.document_id,
      extraction_id: winner.extraction_id ?? other.extraction_id,
    });
  });

  return Array.from(merged.values()).sort(
    (a, b) =>
      new Date(String(b.event_date || "")).getTime() -
      new Date(String(a.event_date || "")).getTime()
  );
}

-- Normalize legacy prescription event identifiers, collapse duplicate
-- system-generated confirmation events, then enforce one event per user/Rx.
BEGIN;

-- Allow the migration to normalize duplicate legacy identifiers even if the
-- index was installed separately before this data cleanup ran.
DROP INDEX IF EXISTS uq_patient_timeline_confirmed_rx_user_ref;

UPDATE patient_timeline_events
SET reference_id = 'RX-EXTRACTION-' || substring(reference_id FROM 8)
WHERE source = 'Prescription Scan'
  AND verification_status = 'Prescription Verified'
  AND reference_id ~ '^HMS-RX-[0-9]+$';

UPDATE patient_timeline_events AS event
SET reference_id = CASE
    WHEN document."filePath" ~ '^/extractions/[0-9]+$'
      THEN 'RX-EXTRACTION-' || substring(document."filePath" FROM 14)
    ELSE 'RX-DOCUMENT-' || document.id::text
  END
FROM "Document" AS document
WHERE event.source = 'Prescription Scan'
  AND event.verification_status = 'Prescription Verified'
  AND event.reference_id ~ '^HMS-DOC-[0-9]+$'
  AND document.id = substring(event.reference_id FROM 9)::integer
  AND (document."userId" = event.user_id OR document."patientId" = event.patient_id);

-- These verified prescription events are generated mirrors, not independent
-- manual encounters. Keep the most recently updated mirror for each Rx.
WITH ranked_events AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, reference_id
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS event_rank
  FROM patient_timeline_events
  WHERE user_id IS NOT NULL
    AND source = 'Prescription Scan'
    AND verification_status = 'Prescription Verified'
    AND reference_id LIKE 'RX-%'
)
DELETE FROM patient_timeline_events AS event
USING ranked_events AS ranked
WHERE event.id = ranked.id
  AND ranked.event_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_timeline_confirmed_rx_user_ref
    ON patient_timeline_events(user_id, reference_id)
    WHERE user_id IS NOT NULL
      AND source = 'Prescription Scan'
      AND verification_status = 'Prescription Verified'
      AND reference_id LIKE 'RX-%';

COMMIT;

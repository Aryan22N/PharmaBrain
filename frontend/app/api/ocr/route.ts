import { NextRequest, NextResponse } from "next/server";
import { pythonBackendFetch } from "@/lib/api";
import { requirePatientSession } from "@/lib/serverAuth";
import type { ExtractionPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 360; // 6 minutes for CPU vision transformer + LLM structuring

const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "image/pjpeg"]);

type UploadExtractionPayload = ExtractionPayload & {
  record: ExtractionPayload["record"] & { image_url?: string | null };
};

interface ExistingDocument {
  id: number;
  storedFilename: string | null;
  status: string;
}

export async function GET() {
  return NextResponse.json({
    status: "ready",
    message: "Prescription OCR endpoint. Submit prescription images via POST with multipart/form-data.",
    web_interface: "/upload",
  });
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user, payload } = authResult;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientPatientId = formData.get("patient_id") as string | null;
    const patientName = formData.get("patient_name") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Prescription image file is required" },
        { status: 400 }
      );
    }

    const userId = user.id;
    const verifiedPatientId = user.patientId || payload.patientId || "P-000000000";
    const verifiedPatientName = user.name || patientName || "Patient";
    const effectivePatientId = verifiedPatientId || (clientPatientId?.trim() || "P-000000000");

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type (${file.type}). Allowed formats: JPEG, PNG, WebP.` },
        { status: 415 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of ${MAX_UPLOAD_MB} MB.` },
        { status: 413 }
      );
    }

    // The OCR service owns exact-image deduplication because it can distinguish an
    // existing draft from raw OCR that needs recovery. Filename matching here blocked
    // retries after a failed Gemini call and also rejected different files with the
    // same filename.
    const fileBytes = Buffer.from(await file.arrayBuffer());

    // Prepare outbound multipart form data for Python FastAPI
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] [API/OCR] Processing prescription image (size=${file.size} bytes, type=${file.type})`);

    const backendFormData = new FormData();
    const uploadBlob = new Blob([fileBytes], { type: file.type });
    backendFormData.append("file", uploadBlob, file.name);
    backendFormData.append("patient_id", effectivePatientId);
    backendFormData.append("patient_name", verifiedPatientName);

    const result = await pythonBackendFetch<UploadExtractionPayload>(
      "ocr",
      {
        method: "POST",
        body: backendFormData,
      },
      360000 // 6 minutes timeout for PaddleOCR vision model + Gemini
    );

    const elapsedMs = Date.now() - startTime;

    if (!result.ok) {
      console.warn(`[${new Date().toISOString()}] [API/OCR] Pipeline returned error status ${result.status} after ${elapsedMs}ms: ${result.error}`);
      return NextResponse.json(
        {
          error: result.error || "OCR and structuring failed",
          raw_ocr_id: result.rawOcrId,
        },
        { status: result.status }
      );
    }

    console.log(`[${new Date().toISOString()}] [API/OCR] Pipeline completed successfully in ${elapsedMs}ms`);

    const extractionData = result.data;
    const extractionId = extractionData?.extraction_id;
    const rec = extractionData?.record;
    if (!extractionData || !extractionId || !rec) {
      return NextResponse.json(
        { error: "The OCR service returned no extraction ID. Retry this image to recover the saved processing attempt." },
        { status: 502 }
      );
    }

    const { query } = await import("@/lib/db");
    const extractionPath = `/extractions/${extractionId}`;
    let existingDoc: ExistingDocument | null = null;
    try {
      const existingRows = await query(
        `SELECT id, "storedFilename", status
         FROM "Document"
         WHERE "userId" = $1 AND "filePath" = $2
         ORDER BY id DESC
         LIMIT 1;`,
        [userId, extractionPath]
      );
      existingDoc = existingRows[0] || null;
    } catch (lookupErr) {
      console.warn("Could not check for an existing document for this extraction:", lookupErr);
    }

    // Avoid uploading the same image again when this request recovered an existing draft.
    let publicImageUrl = "/sample_prescription.png";
    if (existingDoc?.storedFilename && existingDoc.storedFilename !== "/sample_prescription.png") {
      publicImageUrl = existingDoc.storedFilename;
    } else try {
      const { uploadPrescriptionImageToSupabase } = await import("@/lib/supabaseStorage");
      const storageRes = await uploadPrescriptionImageToSupabase(
        fileBytes,
        file.name,
        file.type || "image/png"
      );

      if (storageRes.success && storageRes.publicUrl) {
        publicImageUrl = storageRes.publicUrl;
        console.log(`[API/OCR] Prescription image stored in Supabase Bucket: ${publicImageUrl}`);
      } else {
        console.warn("[API/OCR] Supabase storage upload warning:", storageRes.error, "Falling back to local public/uploads");
        const path = await import("path");
        const fs = await import("fs/promises");
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        await fs.mkdir(uploadsDir, { recursive: true });

        const ext = path.extname(file.name) || ".png";
        const cleanBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const safeFilename = `${cleanBase}_${Date.now()}${ext}`;
        const diskPath = path.join(uploadsDir, safeFilename);
        await fs.writeFile(diskPath, fileBytes);
        publicImageUrl = `/uploads/${safeFilename}`;
      }
    } catch (saveErr) {
      console.warn("Could not save image to Supabase bucket or public/uploads:", saveErr);
    }

    // Upsert the patient document by extraction path so a recovered/retried response
    // cannot create duplicate timeline documents.
    try {
      rec.image_url = publicImageUrl;
      const isConfirmed = extractionData.status === "CONFIRMED" || existingDoc?.status === "CONFIRMED";
      const hospitalName = rec.hospital || file.name.replace(/\.[^/.]+$/, "");
      const dateIso = rec.date_iso || new Date().toISOString().slice(0, 10);
      const docName = `${hospitalName} - ${dateIso}`;
      const medCount = (rec.medicines || []).length;
      const doctorStr = typeof rec.doctor === "string" ? rec.doctor : rec.doctor?.name || "Dr. Unverified";
      const reviewStatus = isConfirmed ? "CONFIRMED" : "NOT CONFIRMED (Awaiting Clinician Review)";
      const docSummary = `${hospitalName} (${doctorStr}). Extracted ${medCount} therapies. Status: ${reviewStatus}.`;

      let documentId: number | null = existingDoc?.id ?? null;
      if (documentId) {
        await query(
          `UPDATE "Document"
           SET "originalName" = $1,
               "storedFilename" = CASE WHEN $2 = '/sample_prescription.png' THEN "storedFilename" ELSE $2 END,
               status = CASE WHEN status = 'CONFIRMED' OR $5 THEN 'CONFIRMED' ELSE 'NOT CONFIRMED' END
           WHERE id = $3 AND "userId" = $4;`,
          [docName, publicImageUrl, documentId, userId, isConfirmed]
        );
      } else {
        const docRows = await query(
          `INSERT INTO "Document" ("userId", "patientId", "originalName", "storedFilename", "documentType", "mimeType", "filePath", status, "uploadedAt")
           VALUES ($1, $2, $3, $4, 'PRESCRIPTION', $5, $6, $8, $7)
           RETURNING id;`,
          [userId, effectivePatientId, docName, publicImageUrl, file.type, extractionPath, new Date().toISOString(), isConfirmed ? "CONFIRMED" : "NOT CONFIRMED"]
        );
        documentId = docRows[0]?.id ?? null;
      }

      if (documentId) {
        const analysisRows = await query(
          `SELECT id FROM "Analysis" WHERE "documentId" = $1 ORDER BY id DESC LIMIT 1;`,
          [documentId]
        );
        if (analysisRows.length > 0) {
          await query(
            `UPDATE "Analysis" SET summary = $1, "structuredResult" = $2 WHERE id = $3;`,
            [docSummary, JSON.stringify(rec), analysisRows[0].id]
          );
        } else {
          await query(
            `INSERT INTO "Analysis" ("documentId", summary, "structuredResult", "isDemo", "createdAt")
             VALUES ($1, $2, $3, false, $4);`,
            [documentId, docSummary, JSON.stringify(rec), new Date().toISOString()]
          );
        }
      }
    } catch (dbErr) {
      console.warn("Could not save initial NOT CONFIRMED document to DB:", dbErr);
    }

    extractionData.record.image_url = publicImageUrl;
    return NextResponse.json(extractionData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process prescription upload";
    console.error(`[${new Date().toISOString()}] [API/OCR] Unexpected exception in route:`, err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

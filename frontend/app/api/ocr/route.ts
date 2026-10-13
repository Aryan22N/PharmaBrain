import { NextRequest, NextResponse } from "next/server";
import { pythonBackendFetch } from "@/lib/api";
import { requirePatientSession } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 360; // 6 minutes for CPU vision transformer + LLM structuring

const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "image/pjpeg"]);

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

    // The Python service owns hash deduplication because it can distinguish
    // saved OCR awaiting structuring from a completed extraction.
    const fileBytes = Buffer.from(await file.arrayBuffer());

    // Prepare outbound multipart form data for Python FastAPI
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] [API/OCR] Processing prescription image (size=${file.size} bytes, type=${file.type})`);

    const backendFormData = new FormData();
    const uploadBlob = new Blob([fileBytes], { type: file.type });
    backendFormData.append("file", uploadBlob, file.name);
    backendFormData.append("patient_id", effectivePatientId);
    backendFormData.append("patient_name", verifiedPatientName);

    const result = await pythonBackendFetch(
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

    const { query } = await import("@/lib/db");
    const extractionData = result.data as any;
    const extractionId = extractionData?.extraction_id;
    if (extractionId) {
      const existingDocs = await query(
        `SELECT d."storedFilename", a."structuredResult"
         FROM "Document" d
         LEFT JOIN "Analysis" a ON a."documentId" = d.id
         WHERE d."userId" = $1 AND d."patientId" = $2
           AND d."filePath" = $3 AND d.status != 'DISCARDED'
         ORDER BY d.id DESC LIMIT 1;`,
        [userId, effectivePatientId, `/extractions/${extractionId}`]
      );
      if (existingDocs.length > 0) {
        extractionData.image_url = existingDocs[0].storedFilename || "/sample_prescription.png";
        return NextResponse.json(extractionData);
      }
    }

    // Save uploaded image to Supabase Storage Bucket (with local fallback if unconfigured)
    let publicImageUrl = "/sample_prescription.png";
    try {
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

    // Immediately save to Patient Summary as NOT CONFIRMED so it appears in the dashboard
    try {
      const rec = extractionData?.record || {};
      rec.image_url = publicImageUrl;
      const hospitalName = rec.hospital || file.name.replace(/\.[^/.]+$/, "");
      const dateIso = rec.date_iso || new Date().toISOString().slice(0, 10);
      const docName = `${hospitalName} - ${dateIso}`;
      const medCount = (rec.medicines || []).length;
      const doctorStr = typeof rec.doctor === "string" ? rec.doctor : rec.doctor?.name || "Dr. Unverified";
      const docSummary = `${hospitalName} (${doctorStr}). Extracted ${medCount} therapies. Status: NOT CONFIRMED (Awaiting Clinician Review).`;

      const docRows = await query(
        `INSERT INTO "Document" ("userId", "patientId", "originalName", "storedFilename", "documentType", "mimeType", "filePath", status, "uploadedAt")
         VALUES ($1, $2, $3, $4, 'PRESCRIPTION', $5, $6, 'NOT CONFIRMED', $7)
         RETURNING id;`,
        [userId, effectivePatientId, docName, publicImageUrl, file.type, `/extractions/${extractionId}`, new Date().toISOString()]
      );

      if (docRows.length > 0) {
        await query(
          `INSERT INTO "Analysis" ("documentId", summary, "structuredResult", "isDemo", "createdAt")
           VALUES ($1, $2, $3, false, $4);`,
          [docRows[0].id, docSummary, JSON.stringify(rec), new Date().toISOString()]
        );
      }
    } catch (dbErr) {
      console.warn("Could not save initial NOT CONFIRMED document to DB:", dbErr);
    }

    if (result.data) {
      (result.data as any).image_url = publicImageUrl;
    }
    return NextResponse.json(result.data);
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] [API/OCR] Unexpected exception in route:`, err);
    return NextResponse.json(
      { error: err.message || "Failed to process prescription upload" },
      { status: 500 }
    );
  }
}

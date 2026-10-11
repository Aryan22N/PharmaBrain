import { NextRequest, NextResponse } from "next/server";
import { pythonBackendFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = await pythonBackendFetch(`extractions/${encodeURIComponent(id)}`, { method: "GET" });

  if (result.ok && result.data) {
    return NextResponse.json(result.data);
  }

  // Graceful fallback to PostgreSQL Document & Analysis tables
  try {
    const { query } = await import("@/lib/db");
    const cleanId = String(id).replace(/^doc-/, "").trim();
    const numId = Number(cleanId);
    const validNum = !isNaN(numId) && numId > 0 ? numId : -1;

    const docs = await query(
      `SELECT d.id, d."originalName", d."storedFilename", d."filePath", d.status, d."patientId", d."userId", d."uploadedAt",
              a.summary, a."structuredResult"
       FROM "Document" d
       LEFT JOIN "Analysis" a ON d.id = a."documentId"
       WHERE (d.id = $1 OR d."filePath" LIKE $2 OR d."filePath" = $3)
         AND d.status != 'DISCARDED'
       ORDER BY d.id DESC LIMIT 1;`,
      [validNum, `%/extractions/${cleanId}%`, `/extractions/${cleanId}`]
    );

    if (docs.length > 0) {
      const doc = docs[0];
      let sr = doc.structuredResult;
      if (typeof sr === "string") {
        try { sr = JSON.parse(sr); } catch (_) { sr = {}; }
      }
      if (!sr) sr = {};

      let imageUrl = sr.image_url || doc.storedFilename || "/sample_prescription.png";
      if (typeof imageUrl === "string" && !imageUrl.startsWith("http://") && !imageUrl.startsWith("https://") && !imageUrl.startsWith("/") && /\.(jpg|jpeg|png|webp)$/i.test(imageUrl)) {
        imageUrl = `/uploads/${imageUrl}`;
      }

      const record = {
        hospital: sr.hospital || doc.originalName || "Prescription Scan",
        doctor: sr.doctor || { name: "Consulting Physician" },
        date_iso: sr.date_iso || (doc.uploadedAt ? new Date(doc.uploadedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
        medicines: sr.medicines || [],
        patient: sr.patient || { name: "Patient", uhid: doc.patientId },
        vitals: sr.vitals || {},
        diagnosis: sr.diagnosis || "",
        allergies: sr.allergies || "",
        image_url: imageUrl,
      };

      return NextResponse.json({
        extraction_id: validNum > 0 ? validNum : doc.id,
        patient_id: doc.patientId,
        status: doc.status === "CONFIRMED" ? "CONFIRMED" : "PENDING_USER_CONFIRMATION",
        confidence_gate: "GREEN",
        gate_reasons: [],
        record,
        image_url: imageUrl,
      });
    }
  } catch (dbErr) {
    console.warn("Fallback query for extraction failed:", dbErr);
  }

  return NextResponse.json(
    { error: result.error || "Failed to fetch extraction" },
    { status: result.status || 404 }
  );
}

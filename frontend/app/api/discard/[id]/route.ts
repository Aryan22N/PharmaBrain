import { NextRequest, NextResponse } from "next/server";
import { pythonBackendFetch } from "@/lib/api";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const cleanId = String(id).replace(/^doc-/, "").trim();
  const numericId = Number(cleanId);
  const validNum = !isNaN(numericId) && numericId > 0 ? numericId : -1;

  // 1. Tell Python OCR engine to delete the draft extraction (best-effort)
  try {
    await pythonBackendFetch(`discard/${encodeURIComponent(cleanId)}`, {
      method: "POST",
    });
  } catch (pyErr) {
    console.warn("Python backend discard notice:", pyErr);
  }

  // 2. Delete matching Document & Analysis & Timeline records from PostgreSQL
  try {
    const docs = await query(
      `SELECT id FROM "Document" WHERE "filePath" LIKE $1 OR id = $2;`,
      [`%${cleanId}%`, validNum]
    );
    const docIds = docs.map((d: any) => d.id);
    if (validNum > 0 && !docIds.includes(validNum)) {
      docIds.push(validNum);
    }

    if (docIds.length > 0) {
      await query(`DELETE FROM "Analysis" WHERE "documentId" = ANY($1::int[]);`, [docIds]);
      await query(`DELETE FROM "Document" WHERE id = ANY($1::int[]);`, [docIds]);
      await query(`DELETE FROM patient_timeline_events WHERE document_id = ANY($1::int[]);`, [docIds]);
    }

    // Also delete any unconfirmed timeline events associated with this draft
    await query(
      `DELETE FROM patient_timeline_events 
       WHERE (reference_id LIKE $1 OR reference_id LIKE $2 OR id = $3)
         AND (verification_status = 'Awaiting Review' OR verification_status = 'NOT CONFIRMED' OR source = 'Uploaded Document');`,
      [`%${cleanId}%`, `HMS-RX-${cleanId}`, validNum]
    );
  } catch (dbErr) {
    console.warn("Error deleting discarded document from PostgreSQL:", dbErr);
  }

  return NextResponse.json({ ok: true, discarded: true, id: cleanId });
}

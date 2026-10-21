import { NextRequest, NextResponse } from "next/server";
import { requirePatientSession } from "@/lib/serverAuth";
import { getPatientLongitudinalTrends } from "@/lib/trendsService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const forceRefresh =
      req.nextUrl.searchParams.get("force") === "true" ||
      req.nextUrl.searchParams.get("refresh") === "true";
    const generateAi = req.nextUrl.searchParams.get("generate") === "true";

    const authResult = await requirePatientSession(req);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { user } = authResult;

    const result = await getPatientLongitudinalTrends(user, {
      forceRefresh,
      generateAi,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Patient Trends API Error:", error);
    return NextResponse.json(
      { error: error.message || "Server error loading patient trends" },
      { status: 500 }
    );
  }
}

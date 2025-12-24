import { NextRequest, NextResponse } from "next/server";
import { getQueryService } from "@/lib/s3";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pdfKey = searchParams.get("key");

    if (!pdfKey) {
      return NextResponse.json(
        { success: false, error: "Missing 'key' parameter" },
        { status: 400 }
      );
    }

    if (!pdfKey.endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, error: "Invalid PDF key" },
        { status: 400 }
      );
    }

    const queryService = getQueryService();

    const TTL = 3600
    
    // Generate signed URL valid for 1 hour
    const signedUrl = await queryService.getSignedPdfUrl(pdfKey, TTL);

    return NextResponse.json({
      success: true,
      data: {
        url: signedUrl,
        expires_in: TTL,
        pdf_key: pdfKey,
      },
    });
  } catch (error) {
    console.error("Signed URL error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate signed URL",
      },
      { status: 500 }
    );
  }
}

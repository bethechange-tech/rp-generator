import { NextRequest, NextResponse } from "next/server";
import { QueryServiceFactory } from "../../config";
import type { SignedUrlSuccessResponse, SignedUrlErrorResponse } from "./types";

export class GetSignedUrlHandler {
  private static readonly TTL_SECONDS = 3600;

  static validateKey(key: string | null): { valid: false; error: string } | { valid: true } {
    if (!key) {
      return { valid: false, error: "Missing 'key' parameter" };
    }

    if (!key.endsWith(".pdf")) {
      return { valid: false, error: "Invalid PDF key" };
    }

    return { valid: true };
  }

  static buildSuccessResponse(
    signedUrl: string,
    pdfKey: string
  ): SignedUrlSuccessResponse {
    return {
      success: true,
      data: {
        url: signedUrl,
        expires_in: this.TTL_SECONDS,
        pdf_key: pdfKey,
      },
    };
  }

  static buildErrorResponse(error: unknown): SignedUrlErrorResponse {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate signed URL",
    };
  }

  static async handle(request: NextRequest): Promise<NextResponse> {
    try {
      const searchParams = request.nextUrl.searchParams;
      const pdfKey = searchParams.get("key");

      const validation = this.validateKey(pdfKey);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        );
      }

      const queryService = QueryServiceFactory.get();
      const signedUrl = await queryService.getSignedPdfUrl(pdfKey!, this.TTL_SECONDS);

      const response = this.buildSuccessResponse(signedUrl, pdfKey!);
      return NextResponse.json(response);
    } catch (error) {
      console.error("Signed URL error:", error);
      const response = this.buildErrorResponse(error);
      return NextResponse.json(response, { status: 500 });
    }
  }
}

import { Request, Response } from "express";
import { QueryServiceFactory } from "../../config";
import { NotFoundError } from "../../lib/errors";
import type { GetReceiptUrlResponse } from "./types";

export class GetReceiptUrlHandler {
  private static readonly EXPIRY_SECONDS = 3600;

  static buildPdfKey(sessionId: string): string {
    return `pdfs/${sessionId}.pdf`;
  }

  static buildResponse(signedUrl: string, expiresIn: number): GetReceiptUrlResponse {
    return {
      success: true,
      data: {
        url: signedUrl,
        expires_in: expiresIn,
      },
    };
  }

  static async handle(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const pdfKey = this.buildPdfKey(sessionId);

    try {
      const signedUrl = await QueryServiceFactory.get().getSignedPdfUrl(
        pdfKey,
        this.EXPIRY_SECONDS
      );

      const response = this.buildResponse(signedUrl, this.EXPIRY_SECONDS);

      res.json(response);
    } catch {
      throw new NotFoundError("Receipt not found");
    }
  }
}

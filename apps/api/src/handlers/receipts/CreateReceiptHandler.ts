import { Request, Response } from "express";
import { ReceiptPdfGenerator } from "@ev-receipt/core";
import type { ReceiptData } from "@ev-receipt/core";
import { StorageFactory, QueryServiceFactory } from "../../config";
import { AppError } from "../../lib/errors";
import { CompanyRegistry } from "../../lib/companyRegistry";
import type { CreateReceiptBody, CreateReceiptResponse } from "./types";

export class CreateReceiptHandler {
  private static generator = ReceiptPdfGenerator.create();
  private static readonly URL_EXPIRY_SECONDS = 3600;

  static resolveReceipt(body: CreateReceiptBody): ReceiptData {
    const { company_ref, receipt } = body;

    if (company_ref) {
      const companyInfo = CompanyRegistry.get(company_ref);
      if (!companyInfo) {
        throw new AppError(
          `Unknown company_ref: ${company_ref}. Available: ${CompanyRegistry.list().join(", ")}`,
          400
        );
      }
      return { ...companyInfo, ...receipt } as ReceiptData;
    }

    return receipt as ReceiptData;
  }

  static buildMetadata(
    body: CreateReceiptBody,
    paymentDate: string
  ): {
    session_id: string;
    consumer_id: string;
    receipt_number: string;
    payment_date: string;
    card_last_four: string;
    amount: string;
  } {
    const { session_id, consumer_id, receipt } = body;

    return {
      session_id,
      consumer_id,
      receipt_number: receipt.receipt_number,
      payment_date: paymentDate,
      card_last_four: receipt.card_last_four,
      amount: receipt.total_amount,
    };
  }

  static buildResponse(
    sessionId: string,
    result: { pdf_key: string; metadata_key: string; index_key: string },
    signedUrl: string
  ): CreateReceiptResponse {
    return {
      success: true,
      data: {
        session_id: sessionId,
        pdf_key: result.pdf_key,
        metadata_key: result.metadata_key,
        index_key: result.index_key,
        signed_url: signedUrl,
      },
    };
  }

  static async handle(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateReceiptBody;
    const { session_id } = body;

    const finalReceipt = this.resolveReceipt(body);
    const base64Pdf = await this.generator.generateBase64(finalReceipt);
    const today = new Date().toISOString().split("T")[0];
    const metadata = this.buildMetadata(body, today);

    const result = await StorageFactory.get().storeReceipt(base64Pdf, metadata);
    const signedUrl = await QueryServiceFactory.get().getSignedPdfUrl(
      result.pdf_key,
      this.URL_EXPIRY_SECONDS
    );

    const response = this.buildResponse(session_id, result, signedUrl);

    res.status(201).json(response);
  }
}

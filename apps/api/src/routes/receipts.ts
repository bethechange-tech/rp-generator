import { Router } from "express";
import { ReceiptPdfGenerator } from "@ev-receipt/core";
import type { ReceiptData } from "@ev-receipt/core";
import { getStorage, getQueryService } from "../config";
import { catchAsync, NotFoundError, AppError } from "../lib/errors";
import { CompanyRegistry } from "../lib/companyRegistry";

const router = Router();
const generator = ReceiptPdfGenerator.create();

interface CreateReceiptBody {
  session_id: string;
  consumer_id: string;
  company_ref?: string;
  receipt: Partial<ReceiptData> & Omit<ReceiptData, 'company_name' | 'company_tagline' | 'company_logo_svg' | 'company_website' | 'support_email' | 'support_phone'>;
}

// POST /receipts - Generate and store receipt
router.post(
  "/",
  catchAsync(async (req, res) => {
    const { session_id, consumer_id, company_ref, receipt } = req.body as CreateReceiptBody;

    // Resolve company info from registry if company_ref provided
    let finalReceipt: ReceiptData;
    if (company_ref) {
      const companyInfo = CompanyRegistry.get(company_ref);
      if (!companyInfo) {
        throw new AppError(`Unknown company_ref: ${company_ref}. Available: ${CompanyRegistry.list().join(', ')}`, 400);
      }
      finalReceipt = { ...companyInfo, ...receipt } as ReceiptData;
    } else {
      finalReceipt = receipt as ReceiptData;
    }

    const base64Pdf = await generator.generateBase64(finalReceipt);

    const storage = getStorage();
    const today = new Date().toISOString().split("T")[0];

    const result = await storage.storeReceipt(base64Pdf, {
      session_id,
      consumer_id,
      receipt_number: receipt.receipt_number,
      payment_date: today,
      card_last_four: receipt.card_last_four,
      amount: receipt.total_amount,
    });

    const queryService = getQueryService();
    const signedUrl = await queryService.getSignedPdfUrl(result.pdf_key, 3600);

    res.status(201).json({
      success: true,
      data: {
        session_id,
        pdf_key: result.pdf_key,
        metadata_key: result.metadata_key,
        index_key: result.index_key,
        signed_url: signedUrl,
      },
    });
  })
);

// GET /receipts/:sessionId/url - Get signed URL for receipt
router.get(
  "/:sessionId/url",
  catchAsync(async (req, res) => {
    const { sessionId } = req.params;
    const pdfKey = `pdfs/${sessionId}.pdf`;

    const queryService = getQueryService();
    
    try {
      const signedUrl = await queryService.getSignedPdfUrl(pdfKey, 3600);
      res.json({
        success: true,
        data: {
          url: signedUrl,
          expires_in: 3600,
        },
      });
    } catch {
      throw new NotFoundError("Receipt not found");
    }
  })
);

export default router;

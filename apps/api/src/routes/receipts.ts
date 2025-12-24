import { Router } from "express";
import { ReceiptPdfGenerator } from "@ev-receipt/core";
import type { ReceiptData, ReceiptQuery } from "@ev-receipt/core";
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

// GET /receipts - Query receipts with pagination
router.get(
  "/",
  catchAsync(async (req, res) => {
    const query: ReceiptQuery = {
      session_id: req.query.session_id as string | undefined,
      consumer_id: req.query.consumer_id as string | undefined,
      card_last_four: req.query.card_last_four as string | undefined,
      receipt_number: req.query.receipt_number as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
      amount_min: req.query.amount_min ? parseFloat(req.query.amount_min as string) : undefined,
      amount_max: req.query.amount_max ? parseFloat(req.query.amount_max as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      cursor: req.query.cursor as string | undefined,
    };

    const queryService = getQueryService();
    const result = await queryService.query(query);

    res.json({
      success: true,
      data: {
        records: result.records,
        pagination: {
          total_count: result.total_count,
          page_size: result.page_size,
          has_more: result.has_more,
          next_cursor: result.next_cursor,
        },
        scanned_dates: result.scanned_dates,
      },
    });
  })
);

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

import { ReceiptQuery, QueryResult } from "./types";

/** Port for receipt query operations (infrastructure agnostic) */
export interface IReceiptQueryService {
  /** Query receipts with filtering and pagination */
  query(query: ReceiptQuery): Promise<QueryResult>;

  /** Get PDF content by key */
  getPdf(pdfKey: string): Promise<Buffer>;

  /** Get PDF as base64 */
  getPdfBase64(pdfKey: string): Promise<string>;

  /** Get signed/presigned URL for PDF download */
  getSignedPdfUrl(pdfKey: string, expiresIn?: number): Promise<string>;

  /** Clear query cache */
  clearCache(): void;

  /** Get cache statistics */
  getCacheStats(): { size: number; enabled: boolean };
}

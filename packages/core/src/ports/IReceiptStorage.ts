import { ReceiptMetadata, ReceiptUploadResult } from "./types";

/** Port for receipt storage operations (infrastructure agnostic) */
export interface IReceiptStorage {
  /** Store receipt with PDF, metadata, and index */
  storeReceipt(
    base64Pdf: string,
    metadata: Omit<ReceiptMetadata, "pdf_key" | "metadata_key" | "created_at">
  ): Promise<ReceiptUploadResult>;
}

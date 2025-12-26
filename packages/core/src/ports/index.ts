export type {
  ReceiptData,
  ReceiptMetadata,
  ReceiptUploadResult,
  StorageConfig,
  ReceiptQuery,
  QueryResult,
  QueryServiceConfig,
} from "./types";

export type { IReceiptStorage } from "./IReceiptStorage";
export type { IReceiptQueryService } from "./IReceiptQueryService";
export type { ITemplateProvider } from "./ITemplateProvider";
export type { IPdfRenderer } from "./IPdfRenderer";
export type { ICache } from "./ICache";
export type { IParallelScanner } from "./IParallelScanner";

/** @deprecated Use ITemplateProvider */
export type { TemplateProvider } from "./TemplateProvider";
/** @deprecated Use IPdfRenderer */
export type { PdfRenderer } from "./PdfRenderer";

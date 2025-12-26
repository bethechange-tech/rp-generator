export type { ReceiptData } from "./domain/ReceiptData";
export type { TemplateProvider, PdfRenderer, IReceiptStorage, IReceiptQueryService, ITemplateProvider, IPdfRenderer } from "./ports";
export { FileTemplateProvider, PuppeteerPdfRenderer, S3ReceiptStorage, ReceiptQueryService, REQUIRED_FIELDS, OPTIONAL_FIELDS } from "./adapters";
export type { S3Config, ReceiptMetadata, ReceiptUploadResult, ReceiptQuery, QueryResult, QueryServiceConfig } from "./adapters";
export { ReceiptPdfGenerator } from "./core/ReceiptPdfGenerator";

// Client-safe exports (no Node.js dependencies)
export { REQUIRED_FIELDS as RequiredFields, OPTIONAL_FIELDS as OptionalFields } from "./constants";

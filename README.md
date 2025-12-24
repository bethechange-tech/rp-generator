# EV Receipt Portal

A production-ready Turborepo monorepo for generating, storing, and querying EV (Electric Vehicle) charging receipts. Built with TypeScript, Next.js, Express, and S3-compatible storage.

## What This Repo Does

This system provides a complete solution for EV charging receipt management:

1. **PDF Generation** - Creates professional PDF receipts from HTML/CSS templates using Puppeteer
2. **S3 Storage** - Stores receipts, metadata, and daily indexes in S3-compatible storage (AWS S3 or MinIO)
3. **Query Service** - Search receipts by session ID, consumer ID, card number, date range, or amount
4. **Web Portal** - Next.js dashboard for searching and viewing receipts with PDF preview
5. **REST API** - Express API with OpenAPI documentation for programmatic access

## Monorepo Structure

```
rp-generator/
├── apps/
│   ├── api/                       # Express REST API with OpenAPI
│   │   ├── src/
│   │   │   ├── server.ts          # Express server
│   │   │   ├── routes/            # API routes
│   │   │   └── config.ts          # S3 configuration
│   │   ├── openapi.yaml           # OpenAPI 3.0 spec
│   │   └── package.json
│   └── portal/                    # Next.js web portal
│       ├── src/
│       │   ├── app/               # App Router pages
│       │   ├── components/        # React components
│       │   └── lib/               # Hooks, API client, types
│       └── package.json
├── packages/
│   ├── core/                      # Receipt generator SDK
│   │   ├── src/
│   │   │   ├── domain/            # ReceiptData interface
│   │   │   ├── ports/             # Interfaces (TemplateProvider, PdfRenderer)
│   │   │   ├── adapters/          # Implementations (S3, Query, Puppeteer)
│   │   │   ├── core/              # ReceiptPdfGenerator
│   │   │   └── index.ts           # Public API exports
│   │   ├── template/              # HTML/CSS receipt templates
│   │   └── package.json
│   └── typescript-config/         # Shared TypeScript configs
├── docker/
│   └── docker-compose.yml         # MinIO for local development
├── turbo.json                     # Turborepo configuration
└── package.json                   # Root workspace config
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Producer Service                          │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Store PDF   │    │  Store Metadata  │    │ Append to Index │
│ pdfs/{id}.pdf │    │ metadata/{id}.json│   │ index/dt=.../   │
└───────────────┘    └──────────────────┘    │  index.ndjson   │
└─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                    ┌─────────────────────┐
                    │   S3 / MinIO        │
                    └─────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   REST API    │    │   Query Service  │    │   Web Portal    │
│   (Express)   │    │ Search by any    │    │   (Next.js)     │
│   Port 4000   │    │ field            │    │   Port 3000     │
└───────────────┘    └──────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start MinIO (Local S3)

```bash
cd docker && docker-compose up -d
```

Access MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

### 3. Start the Applications

```bash
# Start all apps in dev mode
npm run dev

# Or start individually:
npm run dev --workspace=@ev-receipt/portal  # Next.js portal on http://localhost:3000
npm run dev --workspace=@ev-receipt/api     # Express API on http://localhost:4000
```

### 4. Generate a Test Receipt

```bash
npm run generate
```

This will:
- Generate a PDF receipt using the HTML template
- Store in S3 with metadata and daily index
- Export base64 to `packages/core/output/receipt.base64.txt`

## Commands

```bash
# Build all packages and apps
npm run build

# Run all tests (BDD-style with Testcontainers)
npm run test

# Run tests in watch mode
npm run test:watch

# Generate a sample receipt
npm run generate

# Clean all build artifacts
npm run clean
```

## Apps

### Portal (Next.js)

Web dashboard for searching and viewing receipts:

- **Search** by consumer ID, card last 4 digits, receipt number, date range
- **List** receipts with pagination
- **View** PDF receipts inline with signed S3 URLs
- **Download** PDFs directly

```bash
npm run dev --workspace=@ev-receipt/portal
# http://localhost:3000
```

### API (Express)

REST API with OpenAPI documentation:

- `GET /health` - Health check
- `POST /receipts` - Generate and store a new receipt
- `GET /receipts/:sessionId/url` - Get signed URL for a receipt PDF
- `GET /docs` - Swagger UI documentation

```bash
npm run dev --workspace=@ev-receipt/api
# http://localhost:4000
# http://localhost:4000/docs (Swagger UI)
```

## Core Package Usage

### Generate PDF Receipt

```typescript
import { ReceiptPdfGenerator, ReceiptData } from "@ev-receipt/core";

const data: ReceiptData = {
  company_name: "VoltCharge UK",
  company_tagline: "Fast & Clean Energy",
  receipt_number: "EVC-2025-41823",
  receipt_date: "24 December 2025",
  // ... other fields
};

const generator = ReceiptPdfGenerator.create();

// Generate PDF file
await generator.generate(data, "./output/receipt.pdf");

// Generate base64 (for S3 storage)
const base64 = await generator.generateBase64(data);
```

### Store Receipt in S3

```typescript
import { S3ReceiptStorage } from "@ev-receipt/core";

const storage = S3ReceiptStorage.createLocal();

const result = await storage.storeReceipt(base64Pdf, {
  session_id: "session-12345",
  consumer_id: "consumer-john-doe",
  receipt_number: "EVC-2025-41823",
  payment_date: "2025-12-24",
  card_last_four: "4582",
  amount: "£14.06",
});

// Result:
// {
//   pdf_key: "pdfs/session-12345.pdf",
//   metadata_key: "metadata/session-12345.json",
//   index_key: "index/dt=2025-12-24/index.ndjson"
// }
```

### S3 Storage Structure

```
receipts/
├── pdfs/
│   └── {session_id}.pdf              # Receipt PDF
├── metadata/
│   └── {session_id}.json             # Metadata JSON
└── index/
    └── dt={YYYY-MM-DD}/
        └── index.ndjson              # Daily index (NDJSON)
```

### Transactional Storage

Storage operations are transactional. If any step fails, all changes are rolled back:

1. ✓ Store PDF
2. ✓ Store Metadata
3. ✗ Append to Index (fails)
4. → Rollback: Delete PDF, Delete Metadata, Restore Index

## Querying Receipts

### Query Service

```typescript
import { ReceiptQueryService } from "./src";

const queryService = ReceiptQueryService.createLocal();
```

### Query Examples

#### By Session ID

```typescript
const results = await queryService.query({
  session_id: "session-12345",
  date_from: "2025-12-24",
});
```

#### By Consumer ID

```typescript
const results = await queryService.query({
  consumer_id: "consumer-john-doe",
  date_from: "2025-12-01",
  date_to: "2025-12-31",
});
```

#### By Card Last Four

```typescript
const results = await queryService.query({
  card_last_four: "4582",
  date_from: "2025-12-01",
});
```

#### By Amount Range

```typescript
const results = await queryService.query({
  amount_min: 10,
  amount_max: 50,
  date_from: "2025-12-01",
});
```

#### By Receipt Number

```typescript
const results = await queryService.query({
  receipt_number: "EVC-2025-41823",
  date_from: "2025-12-01",
});
```

#### Complex Query

```typescript
const results = await queryService.query({
  consumer_id: "consumer-john-doe",
  card_last_four: "4582",
  date_from: "2025-12-01",
  date_to: "2025-12-31",
});
```

### Query Result

```typescript
interface QueryResult {
  records: ReceiptMetadata[];  // Matching receipts
  scanned_dates: string[];     // Dates that were scanned
}
```

### Fetch PDF

```typescript
// Get PDF as buffer
const pdfBuffer = await queryService.getPdf("pdfs/session-12345.pdf");

// Get PDF as base64
const base64 = await queryService.getPdfBase64("pdfs/session-12345.pdf");
```

## Query Parameters Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Filter by session ID (exact match) |
| `consumer_id` | string | Filter by consumer ID (exact match) |
| `card_last_four` | string | Filter by last 4 digits of card (exact match) |
| `receipt_number` | string | Filter by receipt number (exact match) |
| `date_from` | string | Start date (YYYY-MM-DD). Default: 7 days ago |
| `date_to` | string | End date (YYYY-MM-DD). Default: today |
| `amount_min` | number | Minimum amount (numeric, e.g., 10 for £10.00) |
| `amount_max` | number | Maximum amount (numeric, e.g., 50 for £50.00) |

## Metadata Structure

```json
{
  "session_id": "session-12345",
  "consumer_id": "consumer-john-doe",
  "receipt_number": "EVC-2025-41823",
  "payment_date": "2025-12-24",
  "card_last_four": "4582",
  "amount": "£14.06",
  "pdf_key": "pdfs/session-12345.pdf",
  "metadata_key": "metadata/session-12345.json",
  "created_at": "2025-12-24T12:30:00.000Z"
}
```

## Testing

BDD-style tests with Testcontainers (spins up real MinIO containers):

```bash
npm test           # Run all tests once
npm run test:watch # Watch mode
```

### Test Coverage

- **Core Package** (16 tests) - Storage, query, PDF generation
- **API Package** (7 tests) - Express routes, request validation

### Test Scenarios

1. **Receipt Storage** - Store PDF, metadata, and index atomically
2. **Query Service** - Search by any combination of filters
3. **API Endpoints** - Health check, create receipt, get signed URLs
4. **Rollback** - Verify cleanup on partial failures

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_ENDPOINT` | `http://localhost:9000` | S3/MinIO endpoint |
| `S3_REGION` | `us-east-1` | AWS region |
| `S3_ACCESS_KEY` | `minioadmin` | Access key |
| `S3_SECRET_KEY` | `minioadmin` | Secret key |
| `S3_BUCKET` | `receipts` | Bucket name |
| `PORT` | `4000` | API server port |

## License

MIT

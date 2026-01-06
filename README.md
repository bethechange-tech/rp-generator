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

## Signed URL Architecture

The portal uses **pre-signed S3 URLs** to securely serve PDF receipts without exposing S3 credentials to the client. This pattern provides:

- **Security** - Clients never see S3 credentials
- **Time-limited access** - URLs expire after 1 hour (configurable)
- **Direct S3 download** - No proxy bottleneck, PDFs stream directly from S3
- **Audit trail** - All URL generation is logged server-side

### End-to-End Flow

```
┌─────────────┐     1. GET /api/signed-url?key=pdfs/session-123.pdf
│   Browser   │ ──────────────────────────────────────────────────────────►
│  (Client)   │
│             │ ◄──────────────────────────────────────────────────────────
│             │     2. { url: "https://s3...?X-Amz-Signature=...", expires_in: 3600 }
│             │
│             │     3. GET https://s3.../pdfs/session-123.pdf?X-Amz-Signature=...
│             │ ──────────────────────────────────────────────────────────►
│             │
│             │ ◄──────────────────────────────────────────────────────────
└─────────────┘     4. PDF binary stream (directly from S3)

┌─────────────┐
│   Portal    │ ◄──── 1. Request comes to Next.js API route
│   (Next.js) │
│             │ ────► Validates key parameter
│   /api/     │ ────► Calls QueryService.getSignedPdfUrl()
│ signed-url  │ ────► Returns signed URL to client
└─────────────┘

┌─────────────┐
│    S3 /     │ ◄──── 3. Client fetches PDF directly with signed URL
│   MinIO     │ ────► Validates signature, expiry, and permissions
│             │ ────► Streams PDF bytes to client
└─────────────┘
```

### Step-by-Step Breakdown

#### Step 1: Client Requests Signed URL

The React component calls the portal API:

```typescript
// apps/portal/src/lib/hooks/useSignedUrl.ts
export function useSignedUrl(pdfKey: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      const response = await ApiClientFactory.get().get<ApiResponse<SignedUrlData>>(
        `/signed-url`,
        { params: { key: pdfKey } }  // e.g., key=pdfs/session-12345.pdf
      );
      
      if (response.data.success) {
        setUrl(response.data.data.url);
      }
    }
    fetch();
  }, [pdfKey]);

  return { url, loading, error };
}
```

#### Step 2: Handler Validates and Generates URL

The API route delegates to the handler:

```typescript
// apps/portal/src/app/api/signed-url/route.ts
import { NextRequest } from "next/server";
import { GetSignedUrlHandler } from "@/lib/handlers";

export async function GET(request: NextRequest) {
  return GetSignedUrlHandler.handle(request);
}
```

The handler validates the request and generates the signed URL:

```typescript
// apps/portal/src/lib/handlers/signed-url/GetSignedUrlHandler.ts
export class GetSignedUrlHandler {
  private static readonly TTL_SECONDS = 3600; // 1 hour

  static validateKey(key: string | null): { valid: false; error: string } | { valid: true } {
    if (!key) {
      return { valid: false, error: "Missing 'key' parameter" };
    }
    if (!key.endsWith(".pdf")) {
      return { valid: false, error: "Invalid PDF key" };
    }
    return { valid: true };
  }

  static async handle(request: NextRequest): Promise<NextResponse> {
    const pdfKey = request.nextUrl.searchParams.get("key");

    // Validate the key
    const validation = this.validateKey(pdfKey);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Generate signed URL via QueryService
    const queryService = QueryServiceFactory.get();
    const signedUrl = await queryService.getSignedPdfUrl(pdfKey!, this.TTL_SECONDS);

    return NextResponse.json({
      success: true,
      data: {
        url: signedUrl,
        expires_in: this.TTL_SECONDS,
        pdf_key: pdfKey,
      },
    });
  }
}
```

#### Step 3: S3 Client Generates Pre-signed URL

The QueryService uses the AWS SDK to create a time-limited signed URL:

```typescript
// packages/core/src/adapters/query/ReceiptQueryService.ts
async getSignedPdfUrl(pdfKey: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: this.bucket,
    Key: pdfKey,
  });
  
  return getSignedUrl(this.s3Client, command, { expiresIn });
}
```

The returned URL looks like:

```
https://s3.eu-west-1.amazonaws.com/receipts/pdfs/session-12345.pdf
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=AKIAIOSFODNN7EXAMPLE/20260106/eu-west-1/s3/aws4_request
  &X-Amz-Date=20260106T120000Z
  &X-Amz-Expires=3600
  &X-Amz-SignedHeaders=host
  &X-Amz-Signature=abc123...
```

#### Step 4: Client Displays PDF

The React component renders an iframe with the signed URL:

```tsx
// apps/portal/src/components/PdfViewer.tsx
export function PdfViewer({ pdfKey }: { pdfKey: string }) {
  const { url, loading, error } = useSignedUrl(pdfKey);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <iframe
      src={url || ""}
      className="w-full h-[600px]"
      title="Receipt PDF"
    />
  );
}
```

### API Response Format

#### Success Response

```json
{
  "success": true,
  "data": {
    "url": "https://s3.../pdfs/session-12345.pdf?X-Amz-Signature=...",
    "expires_in": 3600,
    "pdf_key": "pdfs/session-12345.pdf"
  }
}
```

#### Error Responses

```json
// Missing key parameter
{
  "success": false,
  "error": "Missing 'key' parameter"
}

// Invalid key format
{
  "success": false,
  "error": "Invalid PDF key"
}

// S3 error
{
  "success": false,
  "error": "The specified key does not exist."
}
```

### Security Considerations

| Aspect | Implementation |
|--------|----------------|
| **Authentication** | Portal API should be protected (add auth middleware as needed) |
| **Key Validation** | Only `.pdf` files allowed, prevents directory traversal |
| **Expiration** | URLs expire after 1 hour (TTL_SECONDS = 3600) |
| **HTTPS** | All S3 URLs use HTTPS |
| **No Credentials** | Client never sees S3 access keys |
| **Audit Logging** | Handler logs all requests (extend as needed) |

### Testing Signed URLs

#### Using cURL

```bash
# Step 1: Get signed URL from portal API
curl "http://localhost:3000/api/signed-url?key=pdfs/session-12345.pdf"

# Response:
# {"success":true,"data":{"url":"http://localhost:9000/receipts/pdfs/session-12345.pdf?X-Amz-...","expires_in":3600,"pdf_key":"pdfs/session-12345.pdf"}}

# Step 2: Download PDF using signed URL
curl -o receipt.pdf "http://localhost:9000/receipts/pdfs/session-12345.pdf?X-Amz-..."
```

#### Using JavaScript

```typescript
// Fetch signed URL
const response = await fetch('/api/signed-url?key=pdfs/session-12345.pdf');
const { data } = await response.json();

// Use the signed URL
window.open(data.url, '_blank');  // Open in new tab
```

#### Using React Native

```typescript
// 1. Fetch signed URL and display PDF
import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import Pdf from 'react-native-pdf'; // npm install react-native-pdf react-native-blob-util

const API_URL = 'https://your-api.com';

export function ReceiptViewer({ sessionId }: { sessionId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/signed-url?key=pdfs/${sessionId}.pdf`)
      .then(res => res.json())
      .then(({ data }) => setUrl(data.url));
  }, [sessionId]);

  if (!url) return <ActivityIndicator />;

  return <Pdf source={{ uri: url }} style={{ flex: 1 }} />;
}

// 2. Or open in external browser/viewer
async function openReceipt(sessionId: string) {
  const res = await fetch(`${API_URL}/api/signed-url?key=pdfs/${sessionId}.pdf`);
  const { data } = await res.json();
  await Linking.openURL(data.url);
}
```

### Customizing TTL

To change the URL expiration time, update the handler:

```typescript
// apps/portal/src/lib/handlers/signed-url/GetSignedUrlHandler.ts
export class GetSignedUrlHandler {
  private static readonly TTL_SECONDS = 7200; // 2 hours instead of 1
  // ...
}
```

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

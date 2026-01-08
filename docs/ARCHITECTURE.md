# EV Receipt System Architecture

## Overview

The EV Receipt System generates, stores, and retrieves PDF receipts for electric vehicle charging sessions. It consists of three main components:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Portal    │────▶│     API     │────▶│   MinIO/S3  │
│  (Next.js)  │     │  (Express)  │     │  (Storage)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │    Core     │
                    │  (Library)  │
                    └─────────────┘
```

---

## Current Architecture

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Portal** | Next.js 14 | Web UI for searching and viewing receipts |
| **API** | Express + OpenAPI | REST API for receipt generation and queries |
| **Core** | TypeScript Library | Shared logic: PDF generation, S3 storage, queries |
| **Storage** | MinIO (local) / S3 (prod) | PDF and metadata storage |

---

## Company Registry

The system supports a **Company Registry** for pre-registered CPO (Charge Point Operator) companies. When creating a receipt, you can provide a `company_ref` instead of manually including company details in every request.

### How It Works

1. Companies are registered in the API's `companyRegistry.ts`
2. When creating a receipt, pass `company_ref` (e.g., `"voltcharge"`)
3. The API looks up and merges company info into the receipt data
4. If `company_ref` is not found, a 400 error is returned

### Available Companies

| company_ref | Company Name | Tagline |
|-------------|--------------|---------|
| `voltcharge` | VoltCharge UK | Fast & Clean Energy |
| `greencharge` | GreenCharge | Powering the Future |
| `rapidev` | RapidEV | Charge in Minutes |

### Company Info Fields

When using `company_ref`, the following fields are auto-populated:

```json
{
  "company_name": "VoltCharge UK",
  "company_tagline": "Fast & Clean Energy",
  "company_logo_svg": "<svg>...</svg>",
  "company_website": "www.voltcharge.co.uk",
  "support_email": "support@voltcharge.co.uk",
  "support_phone": "0800-VOLTCHG"
}
```

### Usage Example

**Without company_ref** (manual company info):
```json
{
  "session_id": "session-001",
  "consumer_id": "consumer-john",
  "receipt": {
    "company_name": "VoltCharge UK",
    "company_tagline": "Fast & Clean Energy",
    "company_logo_svg": "<svg>...</svg>",
    "company_website": "www.voltcharge.co.uk",
    "receipt_number": "EVC-2025-41823",
    ...
  }
}
```

**With company_ref** (auto-populated):
```json
{
  "session_id": "session-001",
  "consumer_id": "consumer-john",
  "company_ref": "voltcharge",
  "receipt": {
    "receipt_number": "EVC-2025-41823",
    ...
  }
}
```

### Adding New Companies

Edit `apps/api/src/lib/companyRegistry.ts`:

```typescript
companyRegistry.set("newcompany", {
  company_name: "New Company Ltd",
  company_tagline: "Your Tagline",
  company_logo_svg: `<svg>...</svg>`,
  company_website: "www.newcompany.com",
  support_email: "support@newcompany.com",
  support_phone: "0800-123456",
});
```

---

## Data Flow

#### 1. Receipt Creation
```
Client → POST /api/receipts → Generate PDF → Store in S3
                                    │
                                    ├── pdfs/{session_id}.pdf
                                    ├── metadata/{session_id}.json
                                    └── index/dt={date}/index.ndjson
```

#### 2. Receipt Query
```
Portal → GET /api/receipts?consumer_id=X&date_from=Y
           │
           └── Scan index files → Filter → Return metadata list
```

#### 3. PDF Download
```
Portal → GET /api/receipts/{session_id}/pdf
           │
           └── Fetch from S3 → Stream to client
```

---

## Storage Schema

### S3 Bucket Structure
```
receipts/
├── pdfs/
│   ├── session-001.pdf
│   ├── session-002.pdf
│   └── ...
├── metadata/
│   ├── session-001.json
│   ├── session-002.json
│   └── ...
└── index/
    ├── dt=2025-12-01/
    │   └── index.ndjson
    ├── dt=2025-12-02/
    │   └── index.ndjson
    └── ...
```

### Metadata Schema
```json
{
  "session_id": "session-12345",
  "consumer_id": "consumer-john",
  "receipt_number": "EVC-2025-41823",
  "payment_date": "2025-12-24",
  "card_last_four": "4582",
  "amount": "£25.50",
  "pdf_key": "pdfs/session-12345.pdf",
  "metadata_key": "metadata/session-12345.json",
  "created_at": "2025-12-24T10:30:00Z"
}
```

### Index Files (NDJSON)
Daily partitioned files containing one JSON record per line:
```
{"session_id":"session-001","consumer_id":"consumer-john",...}
{"session_id":"session-002","consumer_id":"consumer-jane",...}
```

---

## Current Query Mechanism

### How Queries Work

1. **Date Range Calculation**: Determine which daily index files to scan
2. **Sequential File Scanning**: Read each `index/dt={date}/index.ndjson`
3. **Filtering**: Apply query predicates (consumer_id, card_last_four, etc.)
4. **Result Aggregation**: Combine all matching records

### Supported Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Exact match on session ID |
| `consumer_id` | string | Exact match on consumer ID |
| `card_last_four` | string | Last 4 digits of payment card |
| `receipt_number` | string | Exact match on receipt number |
| `date_from` | date | Start of date range (YYYY-MM-DD) |
| `date_to` | date | End of date range (YYYY-MM-DD) |
| `amount_min` | number | Minimum transaction amount |
| `amount_max` | number | Maximum transaction amount |

### Performance Characteristics

| Metric | Current Behavior |
|--------|------------------|
| **Query Complexity** | O(days × receipts_per_day) |
| **Storage** | ~100 bytes per receipt metadata |
| **Index File Size** | Grows linearly with daily receipts |
| **S3 Requests** | 1 per day in date range |

---

## Scalability Analysis

### Current Limits

| Scale | Daily Receipts | Index Size | Query (7 days) | Status |
|-------|---------------|------------|----------------|--------|
| Small | 100 | ~10KB | ~100ms | ✅ Optimal |
| Medium | 10,000 | ~1MB | ~500ms | ✅ Acceptable |
| Large | 100,000 | ~10MB | ~5s | ⚠️ Slow |
| Enterprise | 1,000,000+ | ~100MB | ~60s+ | ❌ Unacceptable |

### Bottlenecks

1. **Linear Scanning**: Every query scans all days in range
2. **No Secondary Indexes**: Filtering by non-date fields requires full scan
3. **Memory Pressure**: All results loaded into memory
4. **No Pagination**: Large result sets cause timeouts

---

## Scaling Strategies

### Phase 1: Optimize Current Design (10K-100K receipts)

#### 1.1 Add Pagination
```typescript
interface QueryResult {
  records: ReceiptMetadata[];
  next_cursor?: string;
  total_count: number;
  page_size: number;
}
```

#### 1.2 Parallel Index Scanning
```typescript
// Current: Sequential
for (const date of dates) {
  await queryIndexFile(date);
}

// Improved: Parallel with concurrency limit
await Promise.all(
  chunk(dates, 10).map(batch => 
    Promise.all(batch.map(queryIndexFile))
  )
);
```

#### 1.3 Add Result Caching
```typescript
// Cache frequent queries (Redis/in-memory)
const cacheKey = `query:${hash(queryParams)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;
```

---

### Phase 2: Add Secondary Indexes (100K-1M receipts)

#### 2.1 Consumer-Partitioned Indexes
```
index/
├── by-consumer/
│   ├── consumer-john/
│   │   └── receipts.ndjson
│   └── consumer-jane/
│       └── receipts.ndjson
└── by-date/
    └── dt=2025-12-24/
        └── index.ndjson
```

#### 2.2 Card-Partitioned Indexes
```
index/
└── by-card/
    ├── 4582/
    │   └── receipts.ndjson
    └── 1234/
        └── receipts.ndjson
```

---

### Phase 3: Database-Backed Metadata (1M+ receipts)

#### Recommended Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Portal    │────▶│     API     │────▶│  PostgreSQL │
│  (Next.js)  │     │  (Express)  │     │  (Metadata) │
└─────────────┘     └─────────────┘     └──────┬──────┘
                           │                   │
                    ┌──────┴──────┐     ┌──────┴──────┐
                    │    Core     │     │   MinIO/S3  │
                    │  (Library)  │     │   (PDFs)    │
                    └─────────────┘     └─────────────┘
```

#### Database Schema
```sql
CREATE TABLE receipts (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  consumer_id VARCHAR(255) NOT NULL,
  receipt_number VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  card_last_four CHAR(4),
  amount DECIMAL(10, 2) NOT NULL,
  pdf_key VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for common queries
  INDEX idx_consumer_id (consumer_id),
  INDEX idx_payment_date (payment_date),
  INDEX idx_card_last_four (card_last_four),
  INDEX idx_receipt_number (receipt_number)
);
```

#### Query Performance
| Query Type | S3-Only | With PostgreSQL |
|------------|---------|-----------------|
| By session_id | O(1) | O(1) |
| By consumer_id (7 days) | O(7 × n) | O(log n) |
| By card_last_four | O(days × n) | O(log n) |
| Date range | O(days × n) | O(log n) |

---

### Phase 4: Enterprise Scale (10M+ receipts)

#### 4.1 Use Columnar Storage (Parquet)
```
index/
└── dt=2025-12-24/
    └── receipts.parquet  # Compressed, columnar
```

Benefits:
- 10x smaller file sizes
- Column pruning (only read needed fields)
- Predicate pushdown
- Compatible with AWS Athena

#### 4.2 Add Search Engine (Elasticsearch)
```
┌─────────────┐
│ Elasticsearch│
│   (Search)   │
└──────┬──────┘
       │
       ▼
Full-text search, fuzzy matching, aggregations
```

#### 4.3 Event-Driven Architecture
```
Receipt Created → Kafka/SQS → Multiple Consumers
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   PostgreSQL    Elasticsearch    S3
   (Metadata)     (Search)      (PDFs)
```

---

## Migration Path

### From Current → Phase 3 (Recommended)

1. **Add PostgreSQL** to docker-compose
2. **Create migration** for receipts table
3. **Dual-write** during transition:
   - Write to both S3 index and PostgreSQL
4. **Backfill** existing receipts from S3 to PostgreSQL
5. **Switch reads** to PostgreSQL
6. **Deprecate** S3 index files (keep PDFs)

### Estimated Effort

| Phase | Effort | When to Implement |
|-------|--------|-------------------|
| Phase 1 | 2-3 days | 10K+ receipts |
| Phase 2 | 1 week | 100K+ receipts |
| Phase 3 | 2 weeks | 1M+ receipts |
| Phase 4 | 1 month | 10M+ receipts |

---

## Recommendations

### For Now (< 10K receipts)
✅ Current S3-only solution is sufficient

### Next Steps (10K-100K receipts)
1. Add pagination to query results
2. Implement parallel index scanning
3. Add Redis caching for frequent queries

### Future (1M+ receipts)
1. Migrate metadata to PostgreSQL
2. Keep S3 for PDF storage only
3. Consider Elasticsearch for advanced search

---

## Related Documentation

- [API Reference](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Development Setup](../README.md)

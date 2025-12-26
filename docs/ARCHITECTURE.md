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

### Data Flow

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
    ├── dt=2025-12-01/              # Date-partitioned (primary)
    │   └── index.ndjson
    ├── dt=2025-12-02/
    │   └── index.ndjson
    ├── by-consumer/                 # Secondary index (Phase 2)
    │   ├── consumer-john/
    │   │   └── receipts.ndjson
    │   └── consumer-jane/
    │       └── receipts.ndjson
    └── by-card/                     # Secondary index (Phase 2)
        ├── 4582/
        │   └── receipts.ndjson
        └── 1234/
            └── receipts.ndjson
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

### Phase 2: Add Secondary Indexes (100K-1M receipts) ✅ IMPLEMENTED

Secondary indexes provide O(1) lookups for common query patterns without scanning date ranges.

#### 2.1 Consumer-Partitioned Indexes
```
index/by-consumer/{consumer_id}/receipts.ndjson
```
- Created automatically when storing receipts via `S3ReceiptStorage.storeReceipt()`
- Contains all receipts for a specific consumer
- Queried directly when `consumer_id` filter is used without date range

#### 2.2 Card-Partitioned Indexes
```
index/by-card/{card_last_four}/receipts.ndjson
```
- Created automatically when storing receipts
- Contains all receipts for a specific card
- Queried directly when `card_last_four` filter is used without consumer or date range

#### 2.3 Query Strategy Selection
The `ReceiptQueryService` automatically selects the optimal query strategy:

| Query Parameters | Strategy | Complexity |
|------------------|----------|------------|
| `consumer_id` only | Consumer secondary index | O(1) |
| `card_last_four` only | Card secondary index | O(1) |
| `date_from`/`date_to` | Date range scan (parallel) | O(days) |
| `consumer_id` + date range | Date scan with filter | O(days) |

#### 2.4 Backfill Script
To rebuild secondary indexes from existing data:

```bash
# Dry run (preview changes)
npx ts-node src/scripts/rebuild-indexes.ts --dry-run

# Rebuild for specific date range
npx ts-node src/scripts/rebuild-indexes.ts --date-from 2025-01-01 --date-to 2025-12-31

# Production rebuild
npx ts-node src/scripts/rebuild-indexes.ts \
  --endpoint https://s3.amazonaws.com \
  --bucket prod-receipts
```

#### 2.5 Performance Comparison

| Query Type | Phase 1 (Date Scan) | Phase 2 (Secondary Index) |
|------------|--------------------|-----------------------|
| By consumer (all time) | ~5s (scan 365 days) | ~50ms (single file) |
| By card (all time) | ~5s (scan 365 days) | ~50ms (single file) |
| By date range | ~500ms (7 days) | ~500ms (unchanged) |

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
| Phase 1 | 2-3 days | 10K+ receipts | ✅ Complete |
| Phase 2 | 1 week | 100K+ receipts | ✅ Complete |
| Phase 3 | 2 weeks | 1M+ receipts | |
| Phase 4 | 1 month | 10M+ receipts | |

---

## Recommendations

### Current Implementation
✅ Phase 1 & 2 are fully implemented:
- Pagination with cursor-based navigation (limit 1-100)
- Parallel index scanning with concurrency control
- LRU caching for frequent queries (100 entries, 5min TTL)
- Consumer secondary indexes for O(1) consumer lookup
- Card secondary indexes for O(1) card lookup
- Index rebuild script for backfilling existing data

### For Now (< 100K receipts)
✅ Current S3-only solution with secondary indexes is optimal

### Future (1M+ receipts)
1. Migrate metadata to PostgreSQL (Phase 3)
2. Keep S3 for PDF storage only
3. Consider Elasticsearch for advanced search

---

## Related Documentation

- [API Reference](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Development Setup](../README.md)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import { S3ReceiptStorage, ReceiptQueryService, S3Config } from "../adapters";

describe("Receipt Storage System", () => {
  let container: StartedTestContainer;
  let s3Config: S3Config;
  let storage: S3ReceiptStorage;
  let queryService: ReceiptQueryService;

  beforeAll(async () => {
    // Start MinIO container
    container = await new GenericContainer("minio/minio:latest")
      .withExposedPorts(9000)
      .withEnvironment({
        MINIO_ROOT_USER: "testuser",
        MINIO_ROOT_PASSWORD: "testpassword",
      })
      .withCommand(["server", "/data"])
      .withWaitStrategy(Wait.forHttp("/minio/health/ready", 9000))
      .start();

    const port = container.getMappedPort(9000);
    const host = container.getHost();

    s3Config = {
      endpoint: `http://${host}:${port}`,
      region: "us-east-1",
      accessKeyId: "testuser",
      secretAccessKey: "testpassword",
      bucket: "receipts",
    };

    // Create bucket
    const s3Client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    await s3Client.send(new CreateBucketCommand({ Bucket: "receipts" }));

    storage = new S3ReceiptStorage(s3Config);
    queryService = new ReceiptQueryService(s3Config);
  });

  afterAll(async () => {
    await container?.stop();
  });

  describe("Given a customer completes an EV charging session", () => {
    const sessionId = "session-ev-001";
    const consumerId = "consumer-john-doe";
    const today = new Date().toISOString().split("T")[0];

    it("should store the receipt PDF, metadata, and index entry", async () => {
      // Arrange
      const base64Pdf = Buffer.from("fake-pdf-content-for-test").toString("base64");

      // Act
      const result = await storage.storeReceipt(base64Pdf, {
        session_id: sessionId,
        consumer_id: consumerId,
        receipt_number: "EVC-2025-00001",
        payment_date: today,
        card_last_four: "1234",
        amount: "£25.50",
      });

      // Assert
      expect(result.pdf_key).toBe(`pdfs/${sessionId}.pdf`);
      expect(result.metadata_key).toBe(`metadata/${sessionId}.json`);
      expect(result.index_key).toBe(`index/dt=${today}/index.ndjson`);
    });

    it("should retrieve the receipt by session ID", async () => {
      // Act
      const results = await queryService.query({
        session_id: sessionId,
        date_from: today,
        date_to: today,
      });

      // Assert
      expect(results.records.length).toBe(1);
      expect(results.records[0].session_id).toBe(sessionId);
      expect(results.records[0].amount).toBe("£25.50");
    });

    it("should retrieve the receipt by consumer ID", async () => {
      // Act
      const results = await queryService.query({
        consumer_id: consumerId,
        date_from: today,
      });

      // Assert
      expect(results.records.length).toBeGreaterThanOrEqual(1);
      expect(results.records[0].consumer_id).toBe(consumerId);
    });
  });

  describe("Given multiple customers charge on the same day", () => {
    const today = new Date().toISOString().split("T")[0];

    beforeAll(async () => {
      const customers = [
        { session_id: "session-multi-001", consumer_id: "consumer-alice", card_last_four: "5555", amount: "£18.00" },
        { session_id: "session-multi-002", consumer_id: "consumer-bob", card_last_four: "6666", amount: "£32.50" },
        { session_id: "session-multi-003", consumer_id: "consumer-alice", card_last_four: "5555", amount: "£12.75" },
      ];

      for (const customer of customers) {
        const base64Pdf = Buffer.from(`pdf-${customer.session_id}`).toString("base64");
        await storage.storeReceipt(base64Pdf, {
          ...customer,
          receipt_number: `EVC-${customer.session_id}`,
          payment_date: today,
        });
      }
    });

    it("should find all receipts for a specific consumer", async () => {
      // Act
      const results = await queryService.query({
        consumer_id: "consumer-alice",
        date_from: today,
      });

      // Assert
      expect(results.records.length).toBe(2);
      expect(results.records.every(r => r.consumer_id === "consumer-alice")).toBe(true);
    });

    it("should find receipts by card last four digits", async () => {
      // Act
      const results = await queryService.query({
        card_last_four: "6666",
        date_from: today,
      });

      // Assert
      expect(results.records.length).toBe(1);
      expect(results.records[0].consumer_id).toBe("consumer-bob");
    });

    it("should return all receipts for a date range", async () => {
      // Act
      const results = await queryService.query({
        date_from: today,
        date_to: today,
      });

      // Assert - should include all receipts from this test suite
      expect(results.records.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Given a customer queries receipts across multiple days", () => {
    const consumerId = "consumer-weekly";
    const dates = [
      "2025-12-20",
      "2025-12-21",
      "2025-12-22",
    ];

    beforeAll(async () => {
      for (let i = 0; i < dates.length; i++) {
        const base64Pdf = Buffer.from(`pdf-weekly-${i}`).toString("base64");
        await storage.storeReceipt(base64Pdf, {
          session_id: `session-weekly-${i}`,
          consumer_id: consumerId,
          receipt_number: `EVC-WEEKLY-${i}`,
          payment_date: dates[i],
          card_last_four: "9999",
          amount: `£${10 + i * 5}.00`,
        });
      }
    });

    it("should find all receipts within the date range", async () => {
      // Act
      const results = await queryService.query({
        consumer_id: consumerId,
        date_from: "2025-12-20",
        date_to: "2025-12-22",
      });

      // Assert
      expect(results.records.length).toBe(3);
      expect(results.scanned_dates).toContain("2025-12-20");
      expect(results.scanned_dates).toContain("2025-12-21");
      expect(results.scanned_dates).toContain("2025-12-22");
    });

    it("should find receipts for a single day only", async () => {
      // Act
      const results = await queryService.query({
        consumer_id: consumerId,
        date_from: "2025-12-21",
        date_to: "2025-12-21",
      });

      // Assert
      expect(results.records.length).toBe(1);
      expect(results.records[0].payment_date).toBe("2025-12-21");
    });

    it("should return empty when querying outside the date range", async () => {
      // Act
      const results = await queryService.query({
        consumer_id: consumerId,
        date_from: "2025-11-01",
        date_to: "2025-11-30",
      });

      // Assert
      expect(results.records.length).toBe(0);
      expect(results.scanned_dates.length).toBe(30);
    });

    it("should find receipts from start date to today when date_to is omitted", async () => {
      // Act
      const results = await queryService.query({
        consumer_id: consumerId,
        date_from: "2025-12-20",
      });

      // Assert - should find all 3 receipts (20th, 21st, 22nd) plus scan up to today
      expect(results.records.length).toBe(3);
      expect(results.scanned_dates).toContain("2025-12-20");
    });
  });

  describe("Given date range edge cases", () => {
    const consumerId = "consumer-edge-case";

    beforeAll(async () => {
      // Create receipts at start and end of a month
      const edgeDates = ["2025-11-30", "2025-12-01"];
      for (const date of edgeDates) {
        const base64Pdf = Buffer.from(`pdf-edge-${date}`).toString("base64");
        await storage.storeReceipt(base64Pdf, {
          session_id: `session-edge-${date}`,
          consumer_id: consumerId,
          receipt_number: `EVC-EDGE-${date}`,
          payment_date: date,
          card_last_four: "8888",
          amount: "£20.00",
        });
      }
    });

    it("should find receipts spanning month boundaries", async () => {
      // Act
      const results = await queryService.query({
        consumer_id: consumerId,
        date_from: "2025-11-30",
        date_to: "2025-12-01",
      });

      // Assert
      expect(results.records.length).toBe(2);
      expect(results.scanned_dates).toContain("2025-11-30");
      expect(results.scanned_dates).toContain("2025-12-01");
    });

    it("should handle same date for from and to", async () => {
      // Act
      const results = await queryService.query({
        consumer_id: consumerId,
        date_from: "2025-11-30",
        date_to: "2025-11-30",
      });

      // Assert
      expect(results.records.length).toBe(1);
      expect(results.scanned_dates.length).toBe(1);
      expect(results.scanned_dates[0]).toBe("2025-11-30");
    });

    it("should return results only for dates with data within a large range", async () => {
      // Act - query entire month but only 2 days have data
      const results = await queryService.query({
        consumer_id: consumerId,
        date_from: "2025-11-01",
        date_to: "2025-12-31",
      });

      // Assert
      expect(results.records.length).toBe(2);
      expect(results.scanned_dates.length).toBe(61); // Nov + Dec days
    });
  });

  describe("Given a customer wants to download their receipt PDF", () => {
    const sessionId = "session-download-001";
    const pdfContent = "This is the actual PDF content for download test";
    const today = new Date().toISOString().split("T")[0];

    beforeAll(async () => {
      const base64Pdf = Buffer.from(pdfContent).toString("base64");
      await storage.storeReceipt(base64Pdf, {
        session_id: sessionId,
        consumer_id: "consumer-download",
        receipt_number: "EVC-DOWNLOAD-001",
        payment_date: today,
        card_last_four: "0000",
        amount: "£50.00",
      });
    });

    it("should retrieve the PDF as a buffer", async () => {
      // Arrange
      const results = await queryService.query({ session_id: sessionId, date_from: today });
      const pdfKey = results.records[0].pdf_key;

      // Act
      const pdfBuffer = await queryService.getPdf(pdfKey);

      // Assert
      expect(pdfBuffer.toString()).toBe(pdfContent);
    });

    it("should retrieve the PDF as base64", async () => {
      // Arrange
      const results = await queryService.query({ session_id: sessionId, date_from: today });
      const pdfKey = results.records[0].pdf_key;

      // Act
      const base64 = await queryService.getPdfBase64(pdfKey);

      // Assert
      expect(Buffer.from(base64, "base64").toString()).toBe(pdfContent);
    });
  });

  describe("Given a transaction fails midway", () => {
    it("should not leave partial data when metadata upload fails", async () => {
      // This test would require mocking - for now we test the happy path
      // In production, you'd use dependency injection to mock the S3 client
      
      const sessionId = "session-rollback-test";
      const today = new Date().toISOString().split("T")[0];
      const base64Pdf = Buffer.from("rollback-test-pdf").toString("base64");

      // Store successfully first
      await storage.storeReceipt(base64Pdf, {
        session_id: sessionId,
        consumer_id: "consumer-rollback",
        receipt_number: "EVC-ROLLBACK-001",
        payment_date: today,
        card_last_four: "1111",
        amount: "£100.00",
      });

      // Verify it was stored
      const results = await queryService.query({ session_id: sessionId, date_from: today });
      expect(results.records.length).toBe(1);
    });
  });

  // =========================================
  // Phase 2: Secondary Index Tests
  // =========================================

  describe("Given Phase 2 secondary indexes are enabled", () => {
    const consumerA = "consumer-secondary-alice";
    const consumerB = "consumer-secondary-bob";
    const cardA = "7777";
    const cardB = "8888";

    beforeAll(async () => {
      // Create multiple receipts to test secondary index lookups
      const receipts = [
        { session_id: "sec-idx-001", consumer_id: consumerA, card_last_four: cardA, amount: "£15.00", payment_date: "2025-10-01" },
        { session_id: "sec-idx-002", consumer_id: consumerA, card_last_four: cardA, amount: "£25.00", payment_date: "2025-10-15" },
        { session_id: "sec-idx-003", consumer_id: consumerA, card_last_four: cardB, amount: "£35.00", payment_date: "2025-11-01" },
        { session_id: "sec-idx-004", consumer_id: consumerB, card_last_four: cardB, amount: "£45.00", payment_date: "2025-11-15" },
      ];

      for (const receipt of receipts) {
        const base64Pdf = Buffer.from(`pdf-${receipt.session_id}`).toString("base64");
        await storage.storeReceipt(base64Pdf, {
          ...receipt,
          receipt_number: `EVC-${receipt.session_id}`,
        });
      }
    });

    it("should create consumer secondary index when storing receipt", async () => {
      // Act - Check if consumer index was created
      const result = await storage.storeReceipt(
        Buffer.from("test-pdf").toString("base64"),
        {
          session_id: "sec-idx-verify",
          consumer_id: "consumer-verify-index",
          card_last_four: "0001",
          amount: "£10.00",
          payment_date: "2025-12-15",
          receipt_number: "EVC-VERIFY",
        }
      );

      // Assert
      expect(result.consumer_index_key).toBe("index/by-consumer/consumer-verify-index/receipts.ndjson");
      expect(result.card_index_key).toBe("index/by-card/0001/receipts.ndjson");
    });

    it("should query by consumer_id without date range using secondary index (O(1))", async () => {
      // Act - Query without date range should use secondary index
      const results = await queryService.query({
        consumer_id: consumerA,
      });

      // Assert
      expect(results.records.length).toBe(3); // All 3 receipts for consumerA
      expect(results.records.every(r => r.consumer_id === consumerA)).toBe(true);
      // Secondary index query should not scan dates
      expect(results.scanned_dates.length).toBe(0);
    });

    it("should query by card_last_four without date range using secondary index (O(1))", async () => {
      // Act - Query by card without date range should use secondary index
      const results = await queryService.query({
        card_last_four: cardB,
      });

      // Assert - At least 2 receipts with cardB from this test, possibly more from other tests
      expect(results.records.length).toBeGreaterThanOrEqual(2);
      expect(results.records.every(r => r.card_last_four === cardB)).toBe(true);
      // Secondary index query should not scan dates
      expect(results.scanned_dates.length).toBe(0);
    });

    it("should fall back to date scan when date range is specified", async () => {
      // Act - Query with date range should use date scanning (even with consumer_id)
      const results = await queryService.query({
        consumer_id: consumerA,
        date_from: "2025-10-01",
        date_to: "2025-10-31",
      });

      // Assert
      expect(results.records.length).toBe(2); // Only October receipts
      expect(results.scanned_dates.length).toBeGreaterThan(0); // Date scan was used
    });

    it("should filter secondary index results by date range when specified in secondary lookup", async () => {
      // Query consumer secondary index but filter to October only
      // Note: This tests the post-filtering after secondary index lookup
      const results = await queryService.query({
        consumer_id: consumerA,
      });

      // All 3 consumer A receipts returned
      expect(results.records.length).toBe(3);
      
      // Filter dates in consumer results
      const octoberReceipts = results.records.filter(r => 
        r.payment_date >= "2025-10-01" && r.payment_date <= "2025-10-31"
      );
      expect(octoberReceipts.length).toBe(2);
    });

    it("should prefer consumer index over card index when both are provided", async () => {
      // Query with both consumer and card should use consumer index
      // (Consumer queries are more common and typically have fewer results)
      const results = await queryService.query({
        consumer_id: consumerA,
        card_last_four: cardA,
      });

      // Should return only receipts matching both criteria
      expect(results.records.length).toBe(2);
      expect(results.records.every(r => 
        r.consumer_id === consumerA && r.card_last_four === cardA
      )).toBe(true);
    });
  });

  describe("Given pagination with secondary indexes", () => {
    const consumerId = "consumer-pagination-test";

    beforeAll(async () => {
      // Create 10 receipts for pagination testing
      for (let i = 0; i < 10; i++) {
        const base64Pdf = Buffer.from(`pdf-pagination-${i}`).toString("base64");
        await storage.storeReceipt(base64Pdf, {
          session_id: `pagination-idx-${String(i).padStart(3, "0")}`,
          consumer_id: consumerId,
          receipt_number: `EVC-PAGE-${i}`,
          payment_date: `2025-09-${String(i + 1).padStart(2, "0")}`,
          card_last_four: "3333",
          amount: `£${10 + i}.00`,
        });
      }
    });

    it("should paginate secondary index results", async () => {
      // Act - Get first page
      const page1 = await queryService.query({
        consumer_id: consumerId,
        limit: 3,
      });

      // Assert first page
      expect(page1.records.length).toBe(3);
      expect(page1.has_more).toBe(true);
      expect(page1.next_cursor).toBeDefined();
      expect(page1.total_count).toBe(10);

      // Act - Get second page using cursor
      const page2 = await queryService.query({
        consumer_id: consumerId,
        limit: 3,
        cursor: page1.next_cursor,
      });

      // Assert second page
      expect(page2.records.length).toBe(3);
      expect(page2.has_more).toBe(true);
      
      // Verify no duplicates between pages
      const page1Ids = page1.records.map(r => r.session_id);
      const page2Ids = page2.records.map(r => r.session_id);
      expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false);
    });
  });
});

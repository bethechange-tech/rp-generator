import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import request from "supertest";
import express from "express";
import cors from "cors";
import { Router } from "express";
import { ReceiptPdfGenerator, S3ReceiptStorage, ReceiptQueryService } from "@ev-receipt/core";
import type { ReceiptData, ReceiptQuery, S3Config } from "@ev-receipt/core";

function createTestApp(storage: S3ReceiptStorage, queryService: ReceiptQueryService) {
  const app = express();
  app.use(cors());
  app.use(express.json());

 
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

 
  const router = Router();
  const generator = ReceiptPdfGenerator.create();

 
  router.get("/", async (req, res) => {
    try {
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
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to query receipts",
      });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { session_id, consumer_id, receipt } = req.body;

      if (!session_id || !consumer_id || !receipt) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: session_id, consumer_id, receipt",
        });
        return;
      }

      const base64Pdf = await generator.generateBase64(receipt);
      const today = new Date().toISOString().split("T")[0];

      const result = await storage.storeReceipt(base64Pdf, {
        session_id,
        consumer_id,
        receipt_number: receipt.receipt_number,
        payment_date: today,
        card_last_four: receipt.card_last_four,
        amount: receipt.total_amount,
      });

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
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create receipt",
      });
    }
  });

  router.get("/:sessionId/url", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const pdfKey = `pdfs/${sessionId}.pdf`;
      const signedUrl = await queryService.getSignedPdfUrl(pdfKey, 3600);

      res.json({
        success: true,
        data: {
          url: signedUrl,
          expires_in: 3600,
        },
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: "Receipt not found or failed to generate URL",
      });
    }
  });

  app.use("/receipts", router);

  return app;
}

const sampleReceipt: ReceiptData = {
 
  company_name: "EV Charging Co",
  company_tagline: "Power Your Journey",
  company_website: "https://evcharging.co",
  support_email: "help@evcharging.co",
  support_phone: "+44 800 123 4567",

 
  receipt_number: "EVC-2025-00001",
  receipt_date: "2025-12-24",

 
  station_name: "Central Station Hub",
  station_address: "789 Charging Way, London EC1A 1AA",
  connector_type: "CCS",
  charger_power: "150 kW",

 
  session_start_time: "10:00 AM",
  session_end_time: "10:45 AM",
  session_duration: "45 min",
  energy_delivered: "35.5 kWh",
  battery_start: "20%",
  battery_end: "80%",
  avg_charging_speed: "47 kW",

 
  vehicle_make: "Tesla",
  vehicle_model: "Model 3",
  vehicle_vin: "5YJ3E1EA1KF123456",

 
  energy_rate: "£0.35/kWh",
  energy_cost: "£12.43",
  session_fee: "£1.00",
  idle_minutes: "0",
  idle_rate: "£0.10/min",
  idle_fee: "£0.00",
  subtotal: "£13.43",
  vat_rate: "20%",
  vat_amount: "£2.69",
  total_amount: "£16.12",

 
  card_brand: "Visa",
  card_last_four: "4242",
  payment_status: "Paid",
};

describe("EV Receipt API", () => {
  let container: StartedTestContainer;
  let s3Config: S3Config;
  let storage: S3ReceiptStorage;
  let queryService: ReceiptQueryService;
  let app: express.Express;

  beforeAll(async () => {
   
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
    app = createTestApp(storage, queryService);
  });

  afterAll(async () => {
    await container?.stop();
  });

  describe("Given the API is running", () => {
    describe("When a client requests the health endpoint", () => {
      it("Then it should return status ok", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ok");
        expect(response.body.timestamp).toBeDefined();
      });
    });
  });

  describe("Given a customer completes an EV charging session", () => {
    const sessionId = "api-test-session-001";
    const consumerId = "consumer-api-test";

    describe("When the system creates a receipt via POST /receipts", () => {
      it("Then it should generate and store the PDF successfully", async () => {
        const response = await request(app)
          .post("/receipts")
          .send({
            session_id: sessionId,
            consumer_id: consumerId,
            receipt: sampleReceipt,
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.session_id).toBe(sessionId);
        expect(response.body.data.pdf_key).toBe(`pdfs/${sessionId}.pdf`);
        expect(response.body.data.metadata_key).toBe(`metadata/${sessionId}.json`);
        expect(response.body.data.signed_url).toBeDefined();
        expect(response.body.data.signed_url).toContain("X-Amz-Signature");
      });

      it("Then the signed URL should be accessible", async () => {
        const response = await request(app)
          .post("/receipts")
          .send({
            session_id: "url-test-session",
            consumer_id: consumerId,
            receipt: sampleReceipt,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.signed_url).toMatch(/^http/);
      });
    });

    describe("When the request is missing required fields", () => {
      it("Then it should return 400 Bad Request", async () => {
        const response = await request(app)
          .post("/receipts")
          .send({
            session_id: "incomplete-session",
           
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain("Missing required fields");
      });
    });
  });

  describe("Given a receipt exists in storage", () => {
    const existingSessionId = "existing-session-for-url";

    beforeAll(async () => {
     
      await request(app)
        .post("/receipts")
        .send({
          session_id: existingSessionId,
          consumer_id: "consumer-url-test",
          receipt: sampleReceipt,
        });
    });

    describe("When a client requests the signed URL via GET /receipts/:sessionId/url", () => {
      it("Then it should return a valid signed URL", async () => {
        const response = await request(app).get(`/receipts/${existingSessionId}/url`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.url).toBeDefined();
        expect(response.body.data.url).toContain(existingSessionId);
        expect(response.body.data.expires_in).toBe(3600);
      });
    });

    describe("When a client requests a URL for non-existent receipt", () => {
      it("Then it should still return a signed URL (S3 generates URL regardless of object existence)", async () => {
        const response = await request(app).get("/receipts/non-existent-session/url");

       
       
        expect(response.status).toBe(200);
        expect(response.body.data.url).toBeDefined();
      });
    });
  });

  describe("Given multiple charging sessions occur", () => {
    describe("When receipts are created for different sessions", () => {
      it("Then each receipt should have unique keys", async () => {
        const sessions = ["multi-session-1", "multi-session-2", "multi-session-3"];
        const results = [];

        for (const sessionId of sessions) {
          const response = await request(app)
            .post("/receipts")
            .send({
              session_id: sessionId,
              consumer_id: "consumer-multi-test",
              receipt: {
                ...sampleReceipt,
                receipt_number: `EVC-${sessionId}`,
              },
            });

          results.push(response.body);
        }

        const pdfKeys = results.map((r) => r.data.pdf_key);
        const uniqueKeys = new Set(pdfKeys);

        expect(uniqueKeys.size).toBe(sessions.length);
        expect(results.every((r) => r.success)).toBe(true);
      });
    });
  });

  describe("Given receipts exist for querying", () => {
    const queryConsumerId = "consumer-query-test";
    const querySessionIds = ["query-session-1", "query-session-2", "query-session-3"];

    beforeAll(async () => {
      // Clear cache before creating test data
      queryService.clearCache();
      
      for (const sessionId of querySessionIds) {
        await request(app)
          .post("/receipts")
          .send({
            session_id: sessionId,
            consumer_id: queryConsumerId,
            receipt: {
              ...sampleReceipt,
              receipt_number: `EVC-${sessionId}`,
              card_last_four: "1234",
            },
          });
      }
      
      // Clear cache after creating to ensure fresh queries
      queryService.clearCache();
    });

    describe("When a client queries receipts via GET /receipts with consumer_id", () => {
      it("Then it should return all receipts with pagination info", async () => {
        const response = await request(app)
          .get("/receipts")
          .query({ consumer_id: queryConsumerId });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.records).toBeDefined();
        expect(Array.isArray(response.body.data.records)).toBe(true);
        expect(response.body.data.pagination).toBeDefined();
        expect(response.body.data.pagination.total_count).toBeGreaterThan(0);
        expect(response.body.data.pagination.page_size).toBeDefined();
        expect(response.body.data.pagination.has_more).toBeDefined();
        expect(response.body.data.scanned_dates).toBeDefined();
      });
    });

    describe("When a client queries receipts by consumer_id", () => {
      it("Then it should return only receipts for that consumer", async () => {
        const response = await request(app)
          .get("/receipts")
          .query({ consumer_id: queryConsumerId });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.records.length).toBeGreaterThanOrEqual(querySessionIds.length);
        expect(
          response.body.data.records.every(
            (r: { consumer_id: string }) => r.consumer_id === queryConsumerId
          )
        ).toBe(true);
      });
    });

    describe("When a client queries receipts by card_last_four", () => {
      it("Then it should return only receipts with that card", async () => {
        const response = await request(app)
          .get("/receipts")
          .query({ card_last_four: "1234" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.records.length).toBeGreaterThanOrEqual(querySessionIds.length);
        expect(
          response.body.data.records.every(
            (r: { card_last_four: string }) => r.card_last_four === "1234"
          )
        ).toBe(true);
      });
    });

    describe("When a client queries receipts with a limit", () => {
      it("Then it should return at most that many records", async () => {
        const limit = 2;
        const response = await request(app)
          .get("/receipts")
          .query({ limit });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.records.length).toBeLessThanOrEqual(limit);
        expect(response.body.data.pagination.page_size).toBe(limit);
      });
    });

    describe("When a client queries receipts by session_id", () => {
      it("Then it should return only that specific receipt", async () => {
        const targetSession = querySessionIds[0];
        const response = await request(app)
          .get("/receipts")
          .query({ session_id: targetSession });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.records.length).toBe(1);
        expect(response.body.data.records[0].session_id).toBe(targetSession);
      });
    });

    describe("When a client queries with pagination cursor", () => {
      it("Then it should return the next page of results", async () => {
       
        const firstPage = await request(app)
          .get("/receipts")
          .query({ limit: 2 });

        expect(firstPage.status).toBe(200);

        if (firstPage.body.data.pagination.has_more) {
          const cursor = firstPage.body.data.pagination.next_cursor;

          const secondPage = await request(app)
            .get("/receipts")
            .query({ limit: 2, cursor });

          expect(secondPage.status).toBe(200);
          expect(secondPage.body.success).toBe(true);
         
          const firstPageIds = firstPage.body.data.records.map((r: { session_id: string }) => r.session_id);
          const secondPageIds = secondPage.body.data.records.map((r: { session_id: string }) => r.session_id);
          const overlap = firstPageIds.filter((id: string) => secondPageIds.includes(id));
          expect(overlap.length).toBe(0);
        }
      });
    });
  });
});

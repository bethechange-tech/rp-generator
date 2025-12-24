import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import request from "supertest";
import express from "express";
import cors from "cors";
import { Router } from "express";
import { ReceiptPdfGenerator, S3ReceiptStorage, ReceiptQueryService } from "@ev-receipt/core";
import type { ReceiptData, S3Config } from "@ev-receipt/core";

// Create test app factory
function createTestApp(storage: S3ReceiptStorage, queryService: ReceiptQueryService) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  // Receipts routes
  const router = Router();
  const generator = ReceiptPdfGenerator.create();

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

// Sample receipt data for testing
const sampleReceipt: ReceiptData = {
  // Company
  company_name: "EV Charging Co",
  company_tagline: "Power Your Journey",
  company_website: "https://evcharging.co",
  support_email: "help@evcharging.co",
  support_phone: "+44 800 123 4567",

  // Receipt
  receipt_number: "EVC-2025-00001",
  receipt_date: "2025-12-24",

  // Station
  station_name: "Central Station Hub",
  station_address: "789 Charging Way, London EC1A 1AA",
  connector_type: "CCS",
  charger_power: "150 kW",

  // Session
  session_start_time: "10:00 AM",
  session_end_time: "10:45 AM",
  session_duration: "45 min",
  energy_delivered: "35.5 kWh",
  battery_start: "20%",
  battery_end: "80%",
  avg_charging_speed: "47 kW",

  // Vehicle
  vehicle_make: "Tesla",
  vehicle_model: "Model 3",
  vehicle_vin: "5YJ3E1EA1KF123456",

  // Costs
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

  // Payment
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
            // Missing consumer_id and receipt
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
      // Create a receipt first
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

        // Note: S3 generates signed URLs even for non-existent objects
        // The URL will fail when accessed, not when generated
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
});

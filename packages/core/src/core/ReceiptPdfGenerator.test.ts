import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReceiptPdfGenerator } from "./ReceiptPdfGenerator";
import { TemplateProvider, PdfRenderer } from "../ports";
import { ReceiptData } from "../domain/ReceiptData";

const mockReceiptData: ReceiptData = {
  receipt_number: "REC-001",
  receipt_date: "26 December 2025",
  company_name: "EV Charging Ltd",
  company_tagline: "Powering the future",
  company_website: "www.evcharging.co.uk",
  support_email: "support@evcharging.co.uk",
  support_phone: "0800 123 4567",
  station_name: "London Supercharger",
  station_address: "123 Electric Avenue, London, EC1A 1BB",
  connector_type: "CCS",
  charger_power: "150 kW",
  session_start_time: "14:00",
  session_end_time: "14:45",
  session_duration: "45 mins",
  energy_delivered: "45.2 kWh",
  battery_start: "20%",
  battery_end: "80%",
  avg_charging_speed: "60 kW",
  vehicle_make: "Tesla",
  vehicle_model: "Model 3",
  vehicle_vin: "5YJ3E1EA1234567",
  energy_rate: "£0.30/kWh",
  energy_cost: "£13.56",
  session_fee: "£0.00",
  idle_minutes: "0",
  idle_rate: "£0.00",
  idle_fee: "£0.00",
  subtotal: "£13.56",
  vat_rate: "20%",
  vat_amount: "£2.71",
  total_amount: "£16.27",
  card_brand: "Visa",
  card_last_four: "4242",
  payment_status: "Paid",
};

describe("ReceiptPdfGenerator", () => {
  let mockTemplateProvider: TemplateProvider;
  let mockPdfRenderer: PdfRenderer;
  let generator: ReceiptPdfGenerator;

  beforeEach(() => {
    mockTemplateProvider = {
      getHtmlTemplate: vi.fn().mockReturnValue(`
        <html>
          <head><link rel="stylesheet" href="../css/styles.css"></head>
          <body>
            <div>{{receipt_number}}</div>
            <div>{{total_amount}}</div>
            <div>{{company_logo_svg}}</div>
            <div class="cost-row discount">{{discount_amount}}</div>
          </body>
        </html>
      `),
      getCss: vi.fn().mockReturnValue("body { font-family: sans-serif; }"),
    };

    mockPdfRenderer = {
      render: vi.fn().mockResolvedValue(undefined),
      renderToBase64: vi.fn().mockResolvedValue("base64-pdf-content"),
    };

    generator = new ReceiptPdfGenerator(mockTemplateProvider, mockPdfRenderer);
  });

  describe("generating PDF files", () => {
    it("renders HTML template with receipt data", async () => {
      await generator.generate(mockReceiptData, "/output/receipt.pdf");

      expect(mockPdfRenderer.render).toHaveBeenCalledWith(
        expect.stringContaining("REC-001"),
        "/output/receipt.pdf"
      );
    });

    it("includes total amount in rendered HTML", async () => {
      await generator.generate(mockReceiptData, "/output/receipt.pdf");

      expect(mockPdfRenderer.render).toHaveBeenCalledWith(
        expect.stringContaining("£16.27"),
        expect.any(String)
      );
    });
  });

  describe("generating base64 output", () => {
    it("returns PDF as base64 string", async () => {
      const result = await generator.generateBase64(mockReceiptData);

      expect(result).toBe("base64-pdf-content");
      expect(mockPdfRenderer.renderToBase64).toHaveBeenCalled();
    });
  });

  describe("template processing", () => {
    it("inlines CSS instead of external stylesheet", async () => {
      await generator.generate(mockReceiptData, "/output/receipt.pdf");

      expect(mockPdfRenderer.render).toHaveBeenCalledWith(
        expect.stringContaining("<style>body { font-family: sans-serif; }</style>"),
        expect.any(String)
      );
    });

    it("removes discount section when no discount applied", async () => {
      const dataWithoutDiscount = { ...mockReceiptData, discount_amount: undefined };

      await generator.generate(dataWithoutDiscount, "/output/receipt.pdf");

      expect(mockPdfRenderer.render).toHaveBeenCalledWith(
        expect.not.stringContaining('class="cost-row discount"'),
        expect.any(String)
      );
    });

    it("uses default logo SVG when none provided", async () => {
      await generator.generate(mockReceiptData, "/output/receipt.pdf");

      expect(mockPdfRenderer.render).toHaveBeenCalledWith(
        expect.stringContaining("<svg"),
        expect.any(String)
      );
    });
  });

  describe("factory method", () => {
    it("creates generator with default template directory", () => {
      // This tests the static factory - can't easily test without file system
      // but we verify it doesn't throw
      expect(() => ReceiptPdfGenerator.create()).not.toThrow();
    });
  });
});

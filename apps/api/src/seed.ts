import { ReceiptPdfGenerator } from "@ev-receipt/core";
import type { ReceiptData } from "@ev-receipt/core";
import { StorageFactory, QueryServiceFactory } from "./config";
import { CompanyRegistry } from "./lib/companyRegistry";

// Sample receipt data for seeding
const sampleReceipts: Array<{
  session_id: string;
  consumer_id: string;
  company_ref: string;
  receipt: Omit<ReceiptData, 'company_name' | 'company_tagline' | 'company_logo_svg' | 'company_website' | 'support_email' | 'support_phone'>;
}> = [
  {
    session_id: "seed-session-001",
    consumer_id: "consumer-john-doe",
    company_ref: "voltcharge",
    receipt: {
      receipt_number: "EVC-2025-00001",
      receipt_date: "24 December 2025",
      station_name: "London Plaza - Station #12",
      station_address: "456 Electric Avenue, London, EC1A 1BB",
      connector_type: "CCS Type 2",
      charger_power: "150 kW DC Fast Charger",
      session_start_time: "14:32",
      session_end_time: "15:17",
      session_duration: "45",
      energy_delivered: "42.8",
      battery_start: "22",
      battery_end: "87",
      avg_charging_speed: "118",
      vehicle_make: "Tesla",
      vehicle_model: "Model 3 Long Range",
      vehicle_vin: "•••••••••1234XYZ",
      energy_rate: "£0.28",
      energy_cost: "£11.98",
      session_fee: "£0.80",
      idle_minutes: "0",
      idle_rate: "£0.32",
      idle_fee: "£0.00",
      subtotal: "£12.78",
      vat_rate: "20%",
      vat_amount: "£2.56",
      total_amount: "£15.34",
      card_brand: "Visa",
      card_last_four: "4582",
      payment_status: "Paid",
    },
  },
  {
    session_id: "seed-session-002",
    consumer_id: "consumer-jane-smith",
    company_ref: "greencharge",
    receipt: {
      receipt_number: "GC-2025-00042",
      receipt_date: "24 December 2025",
      station_name: "Manchester Hub - Bay A3",
      station_address: "78 Green Lane, Manchester, M1 2AB",
      connector_type: "CHAdeMO",
      charger_power: "100 kW DC Charger",
      session_start_time: "09:15",
      session_end_time: "09:55",
      session_duration: "40",
      energy_delivered: "35.2",
      battery_start: "15",
      battery_end: "72",
      avg_charging_speed: "95",
      vehicle_make: "Nissan",
      vehicle_model: "Leaf e+",
      vehicle_vin: "•••••••••5678ABC",
      energy_rate: "£0.32",
      energy_cost: "£11.26",
      session_fee: "£1.00",
      idle_minutes: "5",
      idle_rate: "£0.25",
      idle_fee: "£1.25",
      subtotal: "£13.51",
      vat_rate: "20%",
      vat_amount: "£2.70",
      discount_label: "Green Member",
      discount_percent: "10%",
      discount_amount: "£1.35",
      total_amount: "£14.86",
      card_brand: "Mastercard",
      card_last_four: "9012",
      payment_status: "Paid",
    },
  },
  {
    session_id: "seed-session-003",
    consumer_id: "consumer-bob-wilson",
    company_ref: "rapidev",
    receipt: {
      receipt_number: "REV-2025-00789",
      receipt_date: "23 December 2025",
      station_name: "Birmingham Express - Slot 5",
      station_address: "22 Speed Road, Birmingham, B2 4CD",
      connector_type: "CCS Type 2",
      charger_power: "350 kW Ultra-Fast",
      session_start_time: "18:45",
      session_end_time: "19:05",
      session_duration: "20",
      energy_delivered: "55.0",
      battery_start: "10",
      battery_end: "85",
      avg_charging_speed: "280",
      vehicle_make: "Porsche",
      vehicle_model: "Taycan 4S",
      vehicle_vin: "•••••••••9999DEF",
      energy_rate: "£0.45",
      energy_cost: "£24.75",
      session_fee: "£2.00",
      idle_minutes: "0",
      idle_rate: "£0.50",
      idle_fee: "£0.00",
      subtotal: "£26.75",
      vat_rate: "20%",
      vat_amount: "£5.35",
      total_amount: "£32.10",
      card_brand: "Amex",
      card_last_four: "3456",
      payment_status: "Paid",
    },
  },
];

async function seed() {
  console.log("🌱 Seeding S3 with sample receipts...\n");

  const generator = ReceiptPdfGenerator.create();
  const storage = StorageFactory.get();
  const queryService = QueryServiceFactory.get();

  for (const { session_id, consumer_id, company_ref, receipt } of sampleReceipts) {
    try {
      // Merge company info
      const companyInfo = CompanyRegistry.get(company_ref);
      if (!companyInfo) {
        console.error(`❌ Unknown company_ref: ${company_ref}`);
        continue;
      }
      const fullReceipt = { ...companyInfo, ...receipt } as ReceiptData;

      // Generate PDF
      console.log(`📄 Generating PDF for ${session_id}...`);
      const base64Pdf = await generator.generateBase64(fullReceipt);

      // Store in S3
      console.log(`💾 Storing in S3...`);
      const result = await storage.storeReceipt(base64Pdf, {
        session_id,
        consumer_id,
        receipt_number: receipt.receipt_number,
        payment_date: new Date().toISOString().split("T")[0],
        card_last_four: receipt.card_last_four,
        amount: receipt.total_amount,
      });

      // Generate signed URL
      const signedUrl = await queryService.getSignedPdfUrl(result.pdf_key, 3600);

      console.log(`✅ ${session_id}`);
      console.log(`   PDF: ${result.pdf_key}`);
      console.log(`   Metadata: ${result.metadata_key}`);
      console.log(`   URL: ${signedUrl.substring(0, 80)}...\n`);
    } catch (error) {
      console.error(`❌ Failed to seed ${session_id}:`, error);
    }
  }

  console.log("🎉 Seeding complete!\n");
  console.log("You can now test with:");
  console.log("  - GET /receipts/seed-session-001/url");
  console.log("  - GET /receipts/seed-session-002/url");
  console.log("  - GET /receipts/seed-session-003/url");
}

seed().catch(console.error);

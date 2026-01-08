import "dotenv/config";
import { ReceiptPdfGenerator } from "@ev-receipt/core";
import type { ReceiptData } from "@ev-receipt/core";
import { StorageFactory } from "./config";
import { CompanyRegistry } from "./lib/companyRegistry";
import { faker } from "@faker-js/faker";
import { PromisePool } from "@supercharge/promise-pool";
import * as fs from "fs";
import * as path from "path";

const COMPANIES = ["voltcharge", "greencharge", "rapidev"];
const CONNECTOR_TYPES = ["CCS Type 2", "CHAdeMO", "Type 2 AC"];
const CHARGER_POWERS = ["50 kW DC Charger", "100 kW DC Charger", "150 kW DC Fast Charger", "350 kW Ultra-Fast"];
const VEHICLE_MAKES = ["Tesla", "Nissan", "Porsche", "BMW", "Audi", "Mercedes", "VW", "Hyundai", "Kia"];

interface SeedCredentials {
  session_id: string;
  consumer_id: string;
  card_last_four: string;
  receipt_number: string;
  payment_date: string;
  amount: string;
}

function generateRandomDate(): Date {
  const now = new Date();
  const daysAgo = faker.number.int({ min: 1, max: 365 });
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

function formatReceiptDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatPaymentDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function generateReceipt(index: number) {
  const date = generateRandomDate();
  const companyRef = faker.helpers.arrayElement(COMPANIES);
  const prefix = companyRef === "voltcharge" ? "EVC" : companyRef === "greencharge" ? "GC" : "REV";
  const sessionDuration = faker.number.int({ min: 15, max: 90 });
  const energyDelivered = faker.number.float({ min: 10, max: 80, fractionDigits: 1 });
  const energyRate = faker.number.float({ min: 0.25, max: 0.50, fractionDigits: 2 });
  const energyCost = energyDelivered * energyRate;
  const sessionFee = faker.number.float({ min: 0.50, max: 2.00, fractionDigits: 2 });
  const idleMinutes = faker.number.int({ min: 0, max: 15 });
  const idleRate = 0.25;
  const idleFee = idleMinutes * idleRate;
  const subtotal = energyCost + sessionFee + idleFee;
  const vatAmount = subtotal * 0.2;
  const hasDiscount = faker.datatype.boolean({ probability: 0.2 });
  const discountAmount = hasDiscount ? subtotal * 0.1 : 0;
  const total = subtotal + vatAmount - discountAmount;
  const batteryStart = faker.number.int({ min: 5, max: 30 });
  const batteryEnd = faker.number.int({ min: 70, max: 95 });

  const session_id = `seed-session-${String(index).padStart(3, "0")}`;
  const consumer_id = `consumer-${faker.string.alphanumeric(8).toLowerCase()}`;
  const card_last_four = faker.finance.creditCardNumber("####").slice(-4);
  const receipt_number = `${prefix}-${date.getFullYear()}-${String(faker.number.int({ min: 1, max: 99999 })).padStart(5, "0")}`;

  return {
    session_id,
    consumer_id,
    company_ref: companyRef,
    payment_date: formatPaymentDate(date),
    receipt: {
      receipt_number,
      receipt_date: formatReceiptDate(date),
      station_name: `${faker.location.city()} Station - Bay ${faker.string.alphanumeric(2).toUpperCase()}`,
      station_address: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.zipCode("??# #??")}`,
      connector_type: faker.helpers.arrayElement(CONNECTOR_TYPES),
      charger_power: faker.helpers.arrayElement(CHARGER_POWERS),
      session_start_time: faker.date.recent().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      session_end_time: faker.date.recent().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      session_duration: String(sessionDuration),
      energy_delivered: energyDelivered.toFixed(1),
      battery_start: String(batteryStart),
      battery_end: String(batteryEnd),
      avg_charging_speed: String(faker.number.int({ min: 50, max: 300 })),
      vehicle_make: faker.helpers.arrayElement(VEHICLE_MAKES),
      vehicle_model: faker.vehicle.model(),
      vehicle_vin: `•••••••••${faker.string.alphanumeric(7).toUpperCase()}`,
      energy_rate: `£${energyRate.toFixed(2)}`,
      energy_cost: `£${energyCost.toFixed(2)}`,
      session_fee: `£${sessionFee.toFixed(2)}`,
      idle_minutes: String(idleMinutes),
      idle_rate: `£${idleRate.toFixed(2)}`,
      idle_fee: `£${idleFee.toFixed(2)}`,
      subtotal: `£${subtotal.toFixed(2)}`,
      vat_rate: "20%",
      vat_amount: `£${vatAmount.toFixed(2)}`,
      ...(hasDiscount && {
        discount_label: "Member Discount",
        discount_percent: "10%",
        discount_amount: `£${discountAmount.toFixed(2)}`,
      }),
      total_amount: `£${total.toFixed(2)}`,
      card_brand: faker.helpers.arrayElement(["Visa", "Mastercard", "Amex"]),
      card_last_four,
      payment_status: "Paid",
    },
  };
}

async function seed() {
  const RECEIPT_COUNT = 20;
  const CONCURRENCY = 5;
  console.log(`🌱 Seeding S3 with ${RECEIPT_COUNT} receipts (concurrency: ${CONCURRENCY})...\n`);

  const generator = ReceiptPdfGenerator.create();
  const storage = StorageFactory.get();

  const items = Array.from({ length: RECEIPT_COUNT }, (_, i) => generateReceipt(i + 1));

  const { results, errors } = await PromisePool
    .for(items)
    .withConcurrency(CONCURRENCY)
    .process(async ({ session_id, consumer_id, company_ref, payment_date, receipt }) => {
      const companyInfo = CompanyRegistry.get(company_ref);
      if (!companyInfo) throw new Error(`Unknown company_ref: ${company_ref}`);

      const fullReceipt = { ...companyInfo, ...receipt } as ReceiptData;
      const base64Pdf = await generator.generateBase64(fullReceipt);

      const result = await storage.storeReceipt(base64Pdf, {
        session_id,
        consumer_id,
        receipt_number: receipt.receipt_number,
        payment_date,
        card_last_four: receipt.card_last_four,
        amount: receipt.total_amount,
      });

      console.log(`✅ ${session_id} (${payment_date}) -> ${result.index_key}`);

      return {
        session_id,
        consumer_id,
        card_last_four: receipt.card_last_four,
        receipt_number: receipt.receipt_number,
        payment_date,
        amount: receipt.total_amount,
      } as SeedCredentials;
    });

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} failed:`);
    errors.forEach((e) => console.error(`  - ${e.message}`));
  }

  // Write credentials to JSON file
  const credentialsPath = path.join(__dirname, "seed-credentials.json");
  fs.writeFileSync(credentialsPath, JSON.stringify(results, null, 2));
  console.log(`\n📋 Credentials saved to: ${credentialsPath}`);

  console.log(`\n🎉 Seeding complete! (${results.length} success, ${errors.length} failed)\n`);
  if (results.length > 0) {
    const sample = results[0];
    console.log("Sample search queries:");
    console.log(`  - Consumer ID: ${sample.consumer_id}`);
    console.log(`  - Card Last 4: ${sample.card_last_four}`);
    console.log(`  - Receipt #: ${sample.receipt_number}`);
  }
}

seed().catch(console.error);

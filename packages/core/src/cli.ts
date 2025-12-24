import * as fs from "fs";
import * as path from "path";
import { ReceiptData, ReceiptPdfGenerator, S3ReceiptStorage, ReceiptQueryService } from "./index";

const sampleData: ReceiptData = {
    company_name: "VoltCharge UK",
    company_tagline: "Fast & Clean Energy",
    company_website: "www.voltcharge.co.uk",
    support_email: "support@voltcharge.co.uk",
    support_phone: "0800-VOLTCHG",

    receipt_number: "EVC-2025-41823",
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
    // discount_label: "Member Discount",
    // discount_percent: "10%",
    // discount_amount: "£1.28",
    total_amount: "£14.06",

    card_brand: "Visa",
    card_last_four: "4582",
    payment_status: "Paid",
};

const outputPath = path.join(__dirname, "..", "output", "receipt.pdf");
const base64Path = path.join(__dirname, "..", "output", "receipt.base64.txt");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const generator = ReceiptPdfGenerator.create();
const s3Storage = S3ReceiptStorage.createLocal();
const queryService = ReceiptQueryService.createLocal();

async function main() {
    // Generate PDF file locally
    await generator.generate(sampleData, outputPath);

    // Generate base64
    const base64 = await generator.generateBase64(sampleData);
    fs.writeFileSync(base64Path, base64);
    console.log(`Base64 exported to: ${base64Path}`);

    // Store in S3 with full indexing
    const sessionId = `session-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];
    
    try {
        const result = await s3Storage.storeReceipt(base64, {
            session_id: sessionId,
            consumer_id: "consumer-12345",
            receipt_number: sampleData.receipt_number,
            payment_date: today,
            card_last_four: sampleData.card_last_four,
            amount: sampleData.total_amount,
        });
        
        console.log("S3 storage complete:", result);

        // Query receipts
        console.log("\n--- Querying Receipts ---");
        
        // Query by consumer
        const byConsumer = await queryService.query({
            consumer_id: "consumer-12345",
            date_from: today,
            date_to: today,
        });
        console.log(`By consumer: ${byConsumer.records.length} found`);

        // Query by card
        const byCard = await queryService.query({
            card_last_four: "4582",
            date_from: today,
        });
        console.log(`By card ****4582: ${byCard.records.length} found`);

        // Show all results
        if (byConsumer.records.length > 0) {
            console.log("\nReceipts found:");
            byConsumer.records.forEach((r, i) => {
                console.log(`  ${i + 1}. ${r.receipt_number} | ${r.amount} | ${r.payment_date}`);
            });
        }

    } catch (err) {
        console.log("S3 upload skipped:", (err as Error).message);
    }
}

main().catch(console.error);

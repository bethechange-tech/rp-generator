export interface ReceiptData {
  // Company
  company_name: string;
  company_tagline: string;
  company_website: string;
  support_email: string;
  support_phone: string;
  company_logo_svg?: string;

  // Receipt
  receipt_number: string;
  receipt_date: string;

  // Station
  station_name: string;
  station_address: string;
  connector_type: string;
  charger_power: string;

  // Session
  session_start_time: string;
  session_end_time: string;
  session_duration: string;
  energy_delivered: string;
  battery_start: string;
  battery_end: string;
  avg_charging_speed: string;

  // Vehicle
  vehicle_make: string;
  vehicle_model: string;
  vehicle_vin: string;

  // Costs
  energy_rate: string;
  energy_cost: string;
  session_fee: string;
  idle_minutes: string;
  idle_rate: string;
  idle_fee: string;
  subtotal: string;
  vat_rate: string;
  vat_amount: string;
  discount_label?: string;
  discount_percent?: string;
  discount_amount?: string;
  total_amount: string;

  // Payment
  card_brand: string;
  card_last_four: string;
  payment_status: string;

  // QR Code (optional)
  qr_code_svg?: string;
}

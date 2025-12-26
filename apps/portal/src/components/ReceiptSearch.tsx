"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { SearchIcon, Card } from "./ui";

interface FormField {
  key: "consumer_id" | "card_last_four" | "receipt_number" | "date_from" | "date_to";
  label: string;
  placeholder?: string;
  type: "text" | "date";
  maxLength?: number;
}

const FIELDS: FormField[] = [
  { key: "consumer_id", label: "Consumer ID", placeholder: "e.g., consumer-12345", type: "text" },
  { key: "card_last_four", label: "Card Last 4 Digits", placeholder: "e.g., 4582", type: "text", maxLength: 4 },
  { key: "receipt_number", label: "Receipt Number", placeholder: "e.g., EVC-2025-41823", type: "text" },
  { key: "date_from", label: "Date From", type: "date" },
  { key: "date_to", label: "Date To", type: "date" },
];

type FieldKey = FormField["key"];

export function ReceiptSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Single state object for all form fields
  const [form, setForm] = useState<Record<FieldKey, string>>(() => ({
    consumer_id: searchParams.get("consumer_id") || "",
    card_last_four: searchParams.get("card_last_four") || "",
    receipt_number: searchParams.get("receipt_number") || "",
    date_from: searchParams.get("date_from") || "",
    date_to: searchParams.get("date_to") || "",
  }));

  const updateField = useCallback((key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(form).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    router.push(`/?${params.toString()}`);
  }, [form, router]);

  const handleClear = useCallback(() => {
    setForm({
      consumer_id: "",
      card_last_four: "",
      receipt_number: "",
      date_from: "",
      date_to: "",
    });
    router.push("/");
  }, [router]);

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
        <SearchIcon className="w-5 h-5 text-primary-500" />
        Search Receipts
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
            </label>
            <input
              type={field.type}
              value={form[field.key]}
              onChange={(e) => {
                const value = field.maxLength ? e.target.value.slice(0, field.maxLength) : e.target.value;
                updateField(field.key, value);
              }}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition text-base sm:text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <button
          onClick={handleSearch}
          className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition font-medium flex items-center justify-center gap-2"
        >
          <SearchIcon className="w-4 h-4" />
          Search
        </button>
        <button
          onClick={handleClear}
          className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
        >
          Clear
        </button>
      </div>
    </Card>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Spinner, WarningIcon } from "@/components/ui";
import { useCostCalculator, type AppError } from "@/lib/ocpi";
import type { CostBreakdownResponse } from "@/lib/ocpi/domain/schemas";

type CalculationType = "session" | "cdr" | "record";
type InputMode = "form" | "json";
type Step = 1 | 2 | 3;

// ============================================================================
// Form Data Types
// ============================================================================

interface ChargingDimension {
  type: "ENERGY" | "TIME" | "PARKING_TIME" | "FLAT";
  volume: number;
}

interface ChargingPeriod {
  start_date_time: string;
  dimensions: ChargingDimension[];
}

interface PriceComponent {
  type: "ENERGY" | "TIME" | "PARKING_TIME" | "FLAT";
  price: number;
  step_size: number;
  vat: number;
}

interface TariffRestriction {
  start_time?: string;
  end_time?: string;
  day_of_week?: string[];
}

interface TariffElement {
  price_components: PriceComponent[];
  restrictions?: TariffRestriction;
}

interface SessionFormData {
  country_code: string;
  party_id: string;
  id: string;
  start_date_time: string;
  end_date_time: string;
  kwh: number;
  currency: string;
  location_id: string;
  evse_uid: string;
  connector_id: string;
  charging_periods: ChargingPeriod[];
}

interface TariffFormData {
  country_code: string;
  party_id: string;
  id: string;
  currency: string;
  elements: TariffElement[];
}

interface RecordFormData {
  start_date_time: string;
  end_date_time: string;
  kwh: number;
  charging_periods: ChargingPeriod[];
}

// Default form values
const DEFAULT_SESSION_FORM: SessionFormData = {
  country_code: "GB",
  party_id: "VCH",
  id: "session-" + Date.now(),
  start_date_time: new Date().toISOString().slice(0, 16),
  end_date_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
  kwh: 45.5,
  currency: "GBP",
  location_id: "LOC001",
  evse_uid: "GB*VCH*E12345",
  connector_id: "1",
  charging_periods: [
    {
      start_date_time: new Date().toISOString(),
      dimensions: [
        { type: "ENERGY", volume: 45.5 },
        { type: "TIME", volume: 1.5 },
      ],
    },
  ],
};

const DEFAULT_TARIFF_FORM: TariffFormData = {
  country_code: "GB",
  party_id: "VCH",
  id: "TARIFF-001",
  currency: "GBP",
  elements: [
    {
      price_components: [{ type: "ENERGY", price: 0.35, step_size: 1, vat: 20 }],
    },
    {
      price_components: [{ type: "PARKING_TIME", price: 0.10, step_size: 60, vat: 20 }],
      restrictions: {
        start_time: "09:00",
        end_time: "18:00",
        day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      },
    },
  ],
};

const DEFAULT_RECORD_FORM: RecordFormData = {
  start_date_time: new Date().toISOString().slice(0, 16),
  end_date_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
  kwh: 45.5,
  charging_periods: [
    {
      start_date_time: new Date().toISOString(),
      dimensions: [
        { type: "ENERGY", volume: 45.5 },
        { type: "TIME", volume: 1.5 },
      ],
    },
  ],
};

// ============================================================================
// Example Payloads
// ============================================================================

const EXAMPLE_SESSION = `{
  "country_code": "GB",
  "party_id": "VCH",
  "id": "session-12345",
  "start_date_time": "2025-01-06T10:00:00Z",
  "end_date_time": "2025-01-06T12:00:00Z",
  "kwh": 45.5,
  "cdr_token": {
    "uid": "012345678",
    "type": "RFID",
    "contract_id": "GB-VCH-C12345678-V"
  },
  "auth_method": "WHITELIST",
  "location_id": "LOC001",
  "evse_uid": "GB*VCH*E12345",
  "connector_id": "1",
  "currency": "GBP",
  "charging_periods": [
    {
      "start_date_time": "2025-01-06T10:00:00Z",
      "dimensions": [
        { "type": "ENERGY", "volume": 45.5 },
        { "type": "TIME", "volume": 1.5 }
      ]
    },
    {
      "start_date_time": "2025-01-06T11:30:00Z",
      "dimensions": [
        { "type": "PARKING_TIME", "volume": 0.5 }
      ]
    }
  ],
  "total_cost": { "excl_vat": 17.43, "incl_vat": 20.92 },
  "total_energy": 45.5,
  "total_time": 1.5,
  "total_parking_time": 0.5,
  "status": "COMPLETED",
  "last_updated": "2025-01-06T12:00:00Z"
}`;

const EXAMPLE_TARIFF = `{
  "country_code": "GB",
  "party_id": "VCH",
  "id": "TARIFF-001",
  "currency": "GBP",
  "type": "REGULAR",
  "tariff_alt_text": [
    { "language": "en", "text": "Standard charging tariff" }
  ],
  "elements": [
    {
      "price_components": [
        { "type": "ENERGY", "price": 0.35, "step_size": 1, "vat": 20 }
      ]
    },
    {
      "price_components": [
        { "type": "PARKING_TIME", "price": 0.10, "step_size": 60, "vat": 20 }
      ],
      "restrictions": {
        "start_time": "09:00",
        "end_time": "18:00",
        "day_of_week": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
      }
    }
  ],
  "last_updated": "2025-01-01T00:00:00Z"
}`;

const EXAMPLE_CDR = `{
  "country_code": "GB",
  "party_id": "VCH",
  "id": "CDR-2025-001234",
  "start_date_time": "2025-01-06T10:00:00Z",
  "end_date_time": "2025-01-06T12:00:00Z",
  "session_id": "session-12345",
  "cdr_token": {
    "country_code": "GB",
    "party_id": "VCH",
    "uid": "012345678",
    "type": "RFID",
    "contract_id": "GB-VCH-C12345678-V"
  },
  "auth_method": "WHITELIST",
  "cdr_location": {
    "id": "LOC001",
    "name": "VoltCharge London Station",
    "address": "123 Electric Avenue",
    "city": "London",
    "postal_code": "SW1A 1AA",
    "country": "GBR",
    "evse_uid": "GB*VCH*E12345",
    "evse_id": "GB*VCH*E12345",
    "connector_id": "1",
    "connector_standard": "IEC_62196_T2_COMBO",
    "connector_format": "CABLE",
    "connector_power_type": "DC"
  },
  "currency": "GBP",
  "charging_periods": [
    {
      "start_date_time": "2025-01-06T10:00:00Z",
      "dimensions": [
        { "type": "ENERGY", "volume": 45.5 },
        { "type": "TIME", "volume": 1.5 }
      ],
      "tariff_id": "TARIFF-001"
    },
    {
      "start_date_time": "2025-01-06T11:30:00Z",
      "dimensions": [
        { "type": "PARKING_TIME", "volume": 0.5 }
      ],
      "tariff_id": "TARIFF-001"
    }
  ],
  "total_cost": { "excl_vat": 16.30, "incl_vat": 19.56 },
  "total_energy": 45.5,
  "total_energy_cost": { "excl_vat": 15.93, "incl_vat": 19.11 },
  "total_time": 1.5,
  "total_parking_time": 0.5,
  "total_parking_cost": { "excl_vat": 0.05, "incl_vat": 0.06 },
  "last_updated": "2025-01-06T12:00:00Z"
}`;

const EXAMPLE_CDR_TARIFF = `{
  "country_code": "GB",
  "party_id": "VCH",
  "id": "TARIFF-001",
  "currency": "GBP",
  "type": "REGULAR",
  "tariff_alt_text": [
    { "language": "en", "text": "Standard DC fast charging tariff" }
  ],
  "elements": [
    {
      "price_components": [
        { "type": "ENERGY", "price": 0.35, "step_size": 1, "vat": 20 }
      ]
    },
    {
      "price_components": [
        { "type": "PARKING_TIME", "price": 0.10, "step_size": 60, "vat": 20 }
      ],
      "restrictions": {
        "start_time": "09:00",
        "end_time": "18:00",
        "day_of_week": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
      }
    }
  ],
  "last_updated": "2025-01-01T00:00:00Z"
}`;

const EXAMPLE_RECORD = `{
  "start_date_time": "2025-01-06T10:00:00Z",
  "end_date_time": "2025-01-06T12:00:00Z",
  "kwh": 45.5,
  "charging_periods": [
    {
      "start_date_time": "2025-01-06T10:00:00Z",
      "dimensions": [
        { "type": "ENERGY", "volume": 45.5 },
        { "type": "TIME", "volume": 1.5 }
      ]
    },
    {
      "start_date_time": "2025-01-06T11:30:00Z",
      "dimensions": [
        { "type": "PARKING_TIME", "volume": 0.5 }
      ]
    }
  ],
  "total_energy": 45.5,
  "total_time": 1.5,
  "total_parking_time": 0.5
}`;

const TYPE_INFO = {
  session: {
    title: "OCPI Session + Tariff",
    description: "Calculate costs from a charging session and separate tariff",
    icon: "⚡",
  },
  cdr: {
    title: "OCPI CDR + Tariff",
    description: "Calculate from a Charge Detail Record with separate tariff",
    icon: "📄",
  },
  record: {
    title: "Simple Record",
    description: "Basic charge record with tariff for quick calculations",
    icon: "🔋",
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function OcpiCalculatorForm() {
  const [step, setStep] = useState<Step>(1);
  const [calculationType, setCalculationType] = useState<CalculationType>("session");
  const [inputMode, setInputMode] = useState<InputMode>("form");
  
  // JSON state
  const [sessionJson, setSessionJson] = useState(EXAMPLE_SESSION);
  const [tariffJson, setTariffJson] = useState(EXAMPLE_TARIFF);
  const [cdrJson, setCdrJson] = useState(EXAMPLE_CDR);
  const [cdrTariffJson, setCdrTariffJson] = useState(EXAMPLE_CDR_TARIFF);
  const [recordJson, setRecordJson] = useState(EXAMPLE_RECORD);
  
  // Form state
  const [sessionForm, setSessionForm] = useState<SessionFormData>(DEFAULT_SESSION_FORM);
  const [tariffForm, setTariffForm] = useState<TariffFormData>(DEFAULT_TARIFF_FORM);
  const [recordForm, setRecordForm] = useState<RecordFormData>(DEFAULT_RECORD_FORM);
  
  const { result, error, isLoading, calculate, reset } = useCostCalculator();

  // Sync form data to JSON when form changes
  const syncFormToJson = useCallback(() => {
    if (inputMode === "form") {
      const sessionPayload = {
        ...sessionForm,
        start_date_time: new Date(sessionForm.start_date_time).toISOString(),
        end_date_time: new Date(sessionForm.end_date_time).toISOString(),
        cdr_token: { uid: "012345678", type: "RFID", contract_id: "GB-VCH-C12345678-V" },
        auth_method: "WHITELIST",
        total_cost: { excl_vat: 0, incl_vat: 0 },
        total_energy: sessionForm.kwh,
        status: "COMPLETED",
        last_updated: new Date().toISOString(),
      };
      setSessionJson(JSON.stringify(sessionPayload, null, 2));
      
      const tariffPayload = {
        ...tariffForm,
        type: "REGULAR",
        tariff_alt_text: [{ language: "en", text: "Standard charging tariff" }],
        last_updated: new Date().toISOString(),
      };
      setTariffJson(JSON.stringify(tariffPayload, null, 2));
      setCdrTariffJson(JSON.stringify(tariffPayload, null, 2));
      
      const recordPayload = {
        ...recordForm,
        start_date_time: new Date(recordForm.start_date_time).toISOString(),
        end_date_time: new Date(recordForm.end_date_time).toISOString(),
        total_energy: recordForm.kwh,
      };
      setRecordJson(JSON.stringify(recordPayload, null, 2));
    }
  }, [inputMode, sessionForm, tariffForm, recordForm]);

  useEffect(() => {
    syncFormToJson();
  }, [syncFormToJson]);

  // Auto-advance to step 3 when result is available
  useEffect(() => {
    if (result) setStep(3);
  }, [result]);

  // Auto-advance to step 2 when error occurs (stay on input)
  useEffect(() => {
    if (error) setStep(2);
  }, [error]);

  const handleTypeSelect = (type: CalculationType) => {
    setCalculationType(type);
    setStep(2);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (calculationType === "session") {
        const session = JSON.parse(sessionJson);
        const tariff = JSON.parse(tariffJson);
        await calculate({ type: "session", session, tariff });
      } else if (calculationType === "record") {
        const record = JSON.parse(recordJson);
        const tariff = JSON.parse(tariffJson);
        await calculate({ type: "record", record, tariff });
      } else {
        const cdr = JSON.parse(cdrJson);
        const tariff = JSON.parse(cdrTariffJson);
        await calculate({ type: "cdr", cdr, tariff });
      }
    } catch {
      await calculate({ type: "session", session: {}, tariff: {} });
    }
  };

  const handleReset = () => {
    reset();
    setStep(1);
    setInputMode("form");
    setSessionJson(EXAMPLE_SESSION);
    setTariffJson(EXAMPLE_TARIFF);
    setCdrJson(EXAMPLE_CDR);
    setCdrTariffJson(EXAMPLE_CDR_TARIFF);
    setRecordJson(EXAMPLE_RECORD);
    setSessionForm(DEFAULT_SESSION_FORM);
    setTariffForm(DEFAULT_TARIFF_FORM);
    setRecordForm(DEFAULT_RECORD_FORM);
  };

  const handleNewCalculation = () => {
    reset();
    setStep(2);
  };

  const handleModeSwitch = (mode: InputMode) => {
    if (mode === "json" && inputMode === "form") {
      // Sync form data to JSON before switching
      syncFormToJson();
    }
    setInputMode(mode);
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <StepIndicator currentStep={step} onStepClick={setStep} hasResult={!!result} />

      {/* Step 1: Select Type */}
      {step === 1 && (
        <div className="animate-fadeIn">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Calculation Type</h2>
            <p className="text-sm text-gray-500 mb-6">
              Choose the type of OCPI data you want to calculate costs for
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(TYPE_INFO) as CalculationType[]).map((type) => (
                <TypeCard
                  key={type}
                  type={type}
                  info={TYPE_INFO[type]}
                  isSelected={calculationType === type}
                  onClick={() => handleTypeSelect(type)}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: Enter Data */}
      {step === 2 && (
        <div className="animate-fadeIn">
          {/* Header with Type Badge and Mode Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{TYPE_INFO[calculationType].icon}</span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{TYPE_INFO[calculationType].title}</h2>
                <p className="text-sm text-gray-500">{TYPE_INFO[calculationType].description}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-4 text-sm text-primary-500 hover:text-primary-600 font-medium"
              >
                Change type
              </button>
            </div>
            
            {/* Input Mode Toggle */}
            {calculationType !== "cdr" && (
              <InputModeToggle mode={inputMode} onModeChange={handleModeSwitch} />
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Display */}
            {error && <ErrorDisplay error={error} />}

            {/* Input Fields - Form or JSON Mode */}
            {inputMode === "form" && calculationType !== "cdr" ? (
              <FormInputSection
                calculationType={calculationType}
                sessionForm={sessionForm}
                setSessionForm={setSessionForm}
                tariffForm={tariffForm}
                setTariffForm={setTariffForm}
                recordForm={recordForm}
                setRecordForm={setRecordForm}
              />
            ) : (
              <DataInputSection
                calculationType={calculationType}
                sessionJson={sessionJson}
                setSessionJson={setSessionJson}
                tariffJson={tariffJson}
                setTariffJson={setTariffJson}
                cdrJson={cdrJson}
                setCdrJson={setCdrJson}
                cdrTariffJson={cdrTariffJson}
                setCdrTariffJson={setCdrTariffJson}
                recordJson={recordJson}
                setRecordJson={setRecordJson}
              />
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <>
                    <Spinner className="w-5 h-5" />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <CalculatorIcon />
                    <span>Calculate Cost</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Start Over
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && result && (
        <div className="animate-fadeIn">
          <ResultsDisplay 
            result={result} 
            calculationType={calculationType}
            onNewCalculation={handleNewCalculation}
            onStartOver={handleReset}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step Indicator Component
// ============================================================================

function StepIndicator({ 
  currentStep, 
  onStepClick,
  hasResult 
}: { 
  currentStep: Step; 
  onStepClick: (step: Step) => void;
  hasResult: boolean;
}) {
  const steps = [
    { num: 1, label: "Select Type" },
    { num: 2, label: "Enter Data" },
    { num: 3, label: "View Results" },
  ];

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-2 sm:gap-4 bg-white rounded-full px-4 sm:px-6 py-3 shadow-sm border border-gray-100">
        {steps.map((step, index) => {
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num || (step.num === 3 && hasResult);
          const isClickable = step.num < currentStep || (step.num === 3 && hasResult);

          return (
            <div key={step.num} className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => isClickable && onStepClick(step.num as Step)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 transition-all
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                    ${isActive ? 'bg-primary-500 text-white ring-4 ring-primary-100' : ''}
                    ${isCompleted && !isActive ? 'bg-primary-100 text-primary-600' : ''}
                    ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400' : ''}
                  `}
                >
                  {isCompleted && !isActive ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    step.num
                  )}
                </div>
                <span
                  className={`
                    hidden sm:block text-sm font-medium transition-colors
                    ${isActive ? 'text-gray-900' : 'text-gray-400'}
                  `}
                >
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div 
                  className={`
                    w-8 sm:w-12 h-0.5 transition-colors
                    ${currentStep > step.num ? 'bg-primary-300' : 'bg-gray-200'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Type Selection Card
// ============================================================================

function TypeCard({
  type,
  info,
  isSelected,
  onClick,
}: {
  type: CalculationType;
  info: { title: string; description: string; icon: string };
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        p-6 rounded-xl border-2 text-left transition-all hover:shadow-md
        ${isSelected 
          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100' 
          : 'border-gray-200 bg-white hover:border-primary-200'
        }
      `}
    >
      <span className="text-3xl mb-3 block">{info.icon}</span>
      <h3 className="font-semibold text-gray-900 mb-1">{info.title}</h3>
      <p className="text-sm text-gray-500">{info.description}</p>
    </button>
  );
}

// ============================================================================
// Data Input Section
// ============================================================================

function DataInputSection({
  calculationType,
  sessionJson,
  setSessionJson,
  tariffJson,
  setTariffJson,
  cdrJson,
  setCdrJson,
  cdrTariffJson,
  setCdrTariffJson,
  recordJson,
  setRecordJson,
}: {
  calculationType: CalculationType;
  sessionJson: string;
  setSessionJson: (v: string) => void;
  tariffJson: string;
  setTariffJson: (v: string) => void;
  cdrJson: string;
  setCdrJson: (v: string) => void;
  cdrTariffJson: string;
  setCdrTariffJson: (v: string) => void;
  recordJson: string;
  setRecordJson: (v: string) => void;
}) {
  if (calculationType === "session") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JsonInputCard
          label="OCPI Session"
          description="Charging session data with periods and dimensions"
          value={sessionJson}
          onChange={setSessionJson}
          rows={18}
        />
        <JsonInputCard
          label="OCPI Tariff"
          description="Pricing structure with elements and restrictions"
          value={tariffJson}
          onChange={setTariffJson}
          rows={18}
        />
      </div>
    );
  }

  if (calculationType === "record") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JsonInputCard
          label="Charge Record"
          description="Simplified record with charging periods"
          value={recordJson}
          onChange={setRecordJson}
          rows={14}
        />
        <JsonInputCard
          label="OCPI Tariff"
          description="Pricing structure with elements and restrictions"
          value={tariffJson}
          onChange={setTariffJson}
          rows={14}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <JsonInputCard
        label="OCPI CDR (Charge Detail Record)"
        description="CDR with charging periods and session details"
        value={cdrJson}
        onChange={setCdrJson}
        rows={22}
      />
      <JsonInputCard
        label="OCPI Tariff"
        description="Separate tariff for cost calculation"
        value={cdrTariffJson}
        onChange={setCdrTariffJson}
        rows={22}
      />
    </div>
  );
}

function JsonInputCard({
  label,
  description,
  value,
  onChange,
  rows,
  fullWidth,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  fullWidth?: boolean;
}) {
  return (
    <Card className={`p-5 ${fullWidth ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <label className="block text-sm font-semibold text-gray-800">{label}</label>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded font-mono">JSON</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full font-mono text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-shadow"
        spellCheck={false}
      />
    </Card>
  );
}

// ============================================================================
// Input Mode Toggle
// ============================================================================

function InputModeToggle({ 
  mode, 
  onModeChange 
}: { 
  mode: InputMode; 
  onModeChange: (mode: InputMode) => void;
}) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
      <button
        type="button"
        onClick={() => onModeChange("form")}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          mode === "form"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        <span className="flex items-center gap-2">
          <FormIcon />
          Form
        </span>
      </button>
      <button
        type="button"
        onClick={() => onModeChange("json")}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          mode === "json"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        <span className="flex items-center gap-2">
          <CodeIcon />
          JSON
        </span>
      </button>
    </div>
  );
}

// ============================================================================
// Form Input Section
// ============================================================================

function FormInputSection({
  calculationType,
  sessionForm,
  setSessionForm,
  tariffForm,
  setTariffForm,
  recordForm,
  setRecordForm,
}: {
  calculationType: CalculationType;
  sessionForm: SessionFormData;
  setSessionForm: (v: SessionFormData) => void;
  tariffForm: TariffFormData;
  setTariffForm: (v: TariffFormData) => void;
  recordForm: RecordFormData;
  setRecordForm: (v: RecordFormData) => void;
}) {
  if (calculationType === "session") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SessionFormCard form={sessionForm} onChange={setSessionForm} />
        <TariffFormCard form={tariffForm} onChange={setTariffForm} />
      </div>
    );
  }

  if (calculationType === "record") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecordFormCard form={recordForm} onChange={setRecordForm} />
        <TariffFormCard form={tariffForm} onChange={setTariffForm} />
      </div>
    );
  }

  return null; // CDR uses JSON mode only
}

// ============================================================================
// Session Form Card
// ============================================================================

function SessionFormCard({
  form,
  onChange,
}: {
  form: SessionFormData;
  onChange: (v: SessionFormData) => void;
}) {
  const updateField = <K extends keyof SessionFormData>(key: K, value: SessionFormData[K]) => {
    onChange({ ...form, [key]: value });
  };

  const updateDimension = (periodIndex: number, dimIndex: number, field: keyof ChargingDimension, value: string | number) => {
    const newPeriods = [...form.charging_periods];
    const newDimensions = [...newPeriods[periodIndex].dimensions];
    newDimensions[dimIndex] = { ...newDimensions[dimIndex], [field]: value };
    newPeriods[periodIndex] = { ...newPeriods[periodIndex], dimensions: newDimensions };
    onChange({ ...form, charging_periods: newPeriods });
  };

  const addDimension = (periodIndex: number) => {
    const newPeriods = [...form.charging_periods];
    newPeriods[periodIndex].dimensions.push({ type: "ENERGY", volume: 0 });
    onChange({ ...form, charging_periods: newPeriods });
  };

  const removeDimension = (periodIndex: number, dimIndex: number) => {
    const newPeriods = [...form.charging_periods];
    newPeriods[periodIndex].dimensions.splice(dimIndex, 1);
    onChange({ ...form, charging_periods: newPeriods });
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800">OCPI Session</label>
          <p className="text-xs text-gray-500 mt-0.5">Charging session details</p>
        </div>
        <span className="px-2 py-1 bg-primary-50 text-primary-600 text-xs rounded font-medium">Form</span>
      </div>

      <div className="space-y-4">
        {/* Session Time */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start Time">
            <input
              type="datetime-local"
              value={form.start_date_time}
              onChange={(e) => updateField("start_date_time", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
          <FormField label="End Time">
            <input
              type="datetime-local"
              value={form.end_date_time}
              onChange={(e) => updateField("end_date_time", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
        </div>

        {/* Energy & Location */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Energy (kWh)">
            <input
              type="number"
              step="0.1"
              value={form.kwh}
              onChange={(e) => updateField("kwh", parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
          <FormField label="Currency">
            <select
              value={form.currency}
              onChange={(e) => updateField("currency", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>
          </FormField>
        </div>

        {/* Location IDs */}
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Country">
            <input
              type="text"
              value={form.country_code}
              onChange={(e) => updateField("country_code", e.target.value.toUpperCase())}
              maxLength={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
          <FormField label="Party ID">
            <input
              type="text"
              value={form.party_id}
              onChange={(e) => updateField("party_id", e.target.value.toUpperCase())}
              maxLength={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
          <FormField label="Location">
            <input
              type="text"
              value={form.location_id}
              onChange={(e) => updateField("location_id", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
        </div>

        {/* Charging Periods */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Charging Dimensions</label>
          </div>
          {form.charging_periods.map((period, periodIndex) => (
            <div key={periodIndex} className="space-y-2">
              {period.dimensions.map((dim, dimIndex) => (
                <div key={dimIndex} className="flex items-center gap-2">
                  <select
                    value={dim.type}
                    onChange={(e) => updateDimension(periodIndex, dimIndex, "type", e.target.value as ChargingDimension["type"])}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="ENERGY">Energy (kWh)</option>
                    <option value="TIME">Time (hours)</option>
                    <option value="PARKING_TIME">Parking (hours)</option>
                    <option value="FLAT">Flat Fee</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={dim.volume}
                    onChange={(e) => updateDimension(periodIndex, dimIndex, "volume", parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Volume"
                  />
                  <button
                    type="button"
                    onClick={() => removeDimension(periodIndex, dimIndex)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    disabled={period.dimensions.length <= 1}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addDimension(periodIndex)}
                className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
              >
                <PlusIcon /> Add Dimension
              </button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Record Form Card
// ============================================================================

function RecordFormCard({
  form,
  onChange,
}: {
  form: RecordFormData;
  onChange: (v: RecordFormData) => void;
}) {
  const updateField = <K extends keyof RecordFormData>(key: K, value: RecordFormData[K]) => {
    onChange({ ...form, [key]: value });
  };

  const updateDimension = (periodIndex: number, dimIndex: number, field: keyof ChargingDimension, value: string | number) => {
    const newPeriods = [...form.charging_periods];
    const newDimensions = [...newPeriods[periodIndex].dimensions];
    newDimensions[dimIndex] = { ...newDimensions[dimIndex], [field]: value };
    newPeriods[periodIndex] = { ...newPeriods[periodIndex], dimensions: newDimensions };
    onChange({ ...form, charging_periods: newPeriods });
  };

  const addDimension = (periodIndex: number) => {
    const newPeriods = [...form.charging_periods];
    newPeriods[periodIndex].dimensions.push({ type: "ENERGY", volume: 0 });
    onChange({ ...form, charging_periods: newPeriods });
  };

  const removeDimension = (periodIndex: number, dimIndex: number) => {
    const newPeriods = [...form.charging_periods];
    newPeriods[periodIndex].dimensions.splice(dimIndex, 1);
    onChange({ ...form, charging_periods: newPeriods });
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800">Charge Record</label>
          <p className="text-xs text-gray-500 mt-0.5">Simple charging record</p>
        </div>
        <span className="px-2 py-1 bg-primary-50 text-primary-600 text-xs rounded font-medium">Form</span>
      </div>

      <div className="space-y-4">
        {/* Time */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start Time">
            <input
              type="datetime-local"
              value={form.start_date_time}
              onChange={(e) => updateField("start_date_time", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
          <FormField label="End Time">
            <input
              type="datetime-local"
              value={form.end_date_time}
              onChange={(e) => updateField("end_date_time", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
        </div>

        {/* Energy */}
        <FormField label="Total Energy (kWh)">
          <input
            type="number"
            step="0.1"
            value={form.kwh}
            onChange={(e) => updateField("kwh", parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </FormField>

        {/* Charging Periods */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Charging Dimensions</label>
          </div>
          {form.charging_periods.map((period, periodIndex) => (
            <div key={periodIndex} className="space-y-2">
              {period.dimensions.map((dim, dimIndex) => (
                <div key={dimIndex} className="flex items-center gap-2">
                  <select
                    value={dim.type}
                    onChange={(e) => updateDimension(periodIndex, dimIndex, "type", e.target.value as ChargingDimension["type"])}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="ENERGY">Energy (kWh)</option>
                    <option value="TIME">Time (hours)</option>
                    <option value="PARKING_TIME">Parking (hours)</option>
                    <option value="FLAT">Flat Fee</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={dim.volume}
                    onChange={(e) => updateDimension(periodIndex, dimIndex, "volume", parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Volume"
                  />
                  <button
                    type="button"
                    onClick={() => removeDimension(periodIndex, dimIndex)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    disabled={period.dimensions.length <= 1}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addDimension(periodIndex)}
                className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
              >
                <PlusIcon /> Add Dimension
              </button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Tariff Form Card
// ============================================================================

function TariffFormCard({
  form,
  onChange,
}: {
  form: TariffFormData;
  onChange: (v: TariffFormData) => void;
}) {
  const updateField = <K extends keyof TariffFormData>(key: K, value: TariffFormData[K]) => {
    onChange({ ...form, [key]: value });
  };

  const updatePriceComponent = (elementIndex: number, compIndex: number, field: keyof PriceComponent, value: string | number) => {
    const newElements = [...form.elements];
    const newComponents = [...newElements[elementIndex].price_components];
    newComponents[compIndex] = { ...newComponents[compIndex], [field]: value };
    newElements[elementIndex] = { ...newElements[elementIndex], price_components: newComponents };
    onChange({ ...form, elements: newElements });
  };

  const addPriceComponent = (elementIndex: number) => {
    const newElements = [...form.elements];
    newElements[elementIndex].price_components.push({ type: "ENERGY", price: 0, step_size: 1, vat: 20 });
    onChange({ ...form, elements: newElements });
  };

  const removePriceComponent = (elementIndex: number, compIndex: number) => {
    const newElements = [...form.elements];
    newElements[elementIndex].price_components.splice(compIndex, 1);
    if (newElements[elementIndex].price_components.length === 0) {
      newElements.splice(elementIndex, 1);
    }
    onChange({ ...form, elements: newElements });
  };

  const addElement = () => {
    onChange({
      ...form,
      elements: [...form.elements, { price_components: [{ type: "ENERGY", price: 0, step_size: 1, vat: 20 }] }],
    });
  };

  const toggleRestriction = (elementIndex: number) => {
    const newElements = [...form.elements];
    if (newElements[elementIndex].restrictions) {
      delete newElements[elementIndex].restrictions;
    } else {
      newElements[elementIndex].restrictions = {
        start_time: "09:00",
        end_time: "18:00",
        day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      };
    }
    onChange({ ...form, elements: newElements });
  };

  const updateRestriction = (elementIndex: number, field: keyof TariffRestriction, value: string | string[]) => {
    const newElements = [...form.elements];
    if (newElements[elementIndex].restrictions) {
      newElements[elementIndex].restrictions = { ...newElements[elementIndex].restrictions, [field]: value };
      onChange({ ...form, elements: newElements });
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800">OCPI Tariff</label>
          <p className="text-xs text-gray-500 mt-0.5">Pricing structure</p>
        </div>
        <span className="px-2 py-1 bg-primary-50 text-primary-600 text-xs rounded font-medium">Form</span>
      </div>

      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Country">
            <input
              type="text"
              value={form.country_code}
              onChange={(e) => updateField("country_code", e.target.value.toUpperCase())}
              maxLength={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
          <FormField label="Party ID">
            <input
              type="text"
              value={form.party_id}
              onChange={(e) => updateField("party_id", e.target.value.toUpperCase())}
              maxLength={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </FormField>
          <FormField label="Currency">
            <select
              value={form.currency}
              onChange={(e) => updateField("currency", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>
          </FormField>
        </div>

        {/* Tariff Elements */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Price Components</label>
          </div>
          
          {form.elements.map((element, elementIndex) => (
            <div key={elementIndex} className="mb-4 pb-4 border-b border-gray-100 last:border-0">
              {element.price_components.map((comp, compIndex) => (
                <div key={compIndex} className="flex items-center gap-2 mb-2">
                  <select
                    value={comp.type}
                    onChange={(e) => updatePriceComponent(elementIndex, compIndex, "type", e.target.value as PriceComponent["type"])}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="ENERGY">Energy (/kWh)</option>
                    <option value="TIME">Time (/hour)</option>
                    <option value="PARKING_TIME">Parking (/hour)</option>
                    <option value="FLAT">Flat Fee</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={comp.price}
                    onChange={(e) => updatePriceComponent(elementIndex, compIndex, "price", parseFloat(e.target.value) || 0)}
                    className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Price"
                  />
                  <input
                    type="number"
                    value={comp.vat}
                    onChange={(e) => updatePriceComponent(elementIndex, compIndex, "vat", parseInt(e.target.value) || 0)}
                    className="w-16 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="VAT%"
                  />
                  <button
                    type="button"
                    onClick={() => removePriceComponent(elementIndex, compIndex)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
              
              {/* Restrictions toggle */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addPriceComponent(elementIndex)}
                  className="text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
                >
                  <PlusIcon /> Add Price
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => toggleRestriction(elementIndex)}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
                >
                  {element.restrictions ? "Remove Restrictions" : "Add Restrictions"}
                </button>
              </div>

              {/* Restrictions */}
              {element.restrictions && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-2">Time Restrictions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={element.restrictions.start_time || ""}
                      onChange={(e) => updateRestriction(elementIndex, "start_time", e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Start"
                    />
                    <input
                      type="time"
                      value={element.restrictions.end_time || ""}
                      onChange={(e) => updateRestriction(elementIndex, "end_time", e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="End"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, i) => {
                      const fullDay = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"][i];
                      const isActive = element.restrictions?.day_of_week?.includes(fullDay);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const current = element.restrictions?.day_of_week || [];
                            const newDays = isActive
                              ? current.filter((d) => d !== fullDay)
                              : [...current, fullDay];
                            updateRestriction(elementIndex, "day_of_week", newDays);
                          }}
                          className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                            isActive
                              ? "bg-primary-500 text-white"
                              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          <button
            type="button"
            onClick={addElement}
            className="w-full mt-2 py-2 text-sm text-primary-500 hover:text-primary-600 font-medium border border-dashed border-primary-300 rounded-lg hover:border-primary-400 transition-colors"
          >
            <span className="flex items-center justify-center gap-1">
              <PlusIcon /> Add Tariff Element
            </span>
          </button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Form Field Helper
// ============================================================================

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ============================================================================
// Error Display
// ============================================================================

function ErrorDisplay({ error }: { error: AppError }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 animate-shake">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="bg-red-100 p-2.5 rounded-full">
            <WarningIcon className="w-5 h-5 text-red-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
            <span>Calculation Error</span>
            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded font-mono">{error.code}</span>
          </h3>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
          {error.details && (
            <ul className="mt-3 space-y-1 text-sm">
              {Object.entries(error.details).map(([field, messages]) => (
                <li key={field} className="text-red-600 flex gap-2">
                  <span className="font-mono text-red-500 bg-red-100 px-1.5 rounded">{field}</span>
                  <span>{messages.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Results Display
// ============================================================================

function ResultsDisplay({ 
  result, 
  calculationType,
  onNewCalculation,
  onStartOver,
}: { 
  result: CostBreakdownResponse;
  calculationType: CalculationType;
  onNewCalculation: () => void;
  onStartOver: () => void;
}) {
  const energyValue = parseFloat(result.energy);
  const parkingValue = parseFloat(result.parking);
  const totalValue = energyValue + parkingValue;
  const energyPercent = totalValue > 0 ? (energyValue / totalValue) * 100 : 0;
  const parkingPercent = totalValue > 0 ? (parkingValue / totalValue) * 100 : 0;
  
  const details = result.details;

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <Card className="p-6 border-primary-200 bg-gradient-to-br from-primary-50 to-white">
        <div className="flex items-center gap-4">
          <div className="bg-primary-100 p-3 rounded-full">
            <CheckCircleIcon className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Cost Calculated Successfully</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Based on your {TYPE_INFO[calculationType].title.toLowerCase()} data
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-3xl font-bold text-primary-600">{result.formatted.total_amount}</p>
          </div>
        </div>
      </Card>

      {/* Session Details */}
      {details?.session && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-gray-500" />
            Session Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DetailCard 
              label="Date" 
              value={details.session.date} 
              icon={<CalendarIcon className="w-4 h-4" />}
            />
            <DetailCard 
              label="Day" 
              value={details.session.dayOfWeek} 
              icon={<DayIcon className="w-4 h-4" />}
            />
            <DetailCard 
              label="Time" 
              value={`${details.session.startTime} - ${details.session.endTime}`}
              subValue={details.session.timeOfDay}
              icon={<TimeIcon className="w-4 h-4" />}
            />
            <DetailCard 
              label="Duration" 
              value={details.session.durationFormatted}
              subValue={`${details.session.durationMinutes} mins`}
              icon={<DurationIcon className="w-4 h-4" />}
            />
          </div>
        </Card>
      )}

      {/* Energy & Parking Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Energy Details */}
        {details?.energy && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BoltIcon className="w-5 h-5 text-blue-500" />
              Energy Consumption
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-700">Total Energy</span>
                <span className="text-xl font-bold text-blue-900">{details.energy.totalKwh} kWh</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Rate per kWh</span>
                <span className="font-semibold text-gray-900">£{details.energy.pricePerKwh.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded">
                  {details.energy.calculation}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Parking Details */}
        {details?.parking && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ParkingIcon className="w-5 h-5 text-orange-500" />
              Parking Time
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm text-orange-700">Total Parking</span>
                <span className="text-xl font-bold text-orange-900">
                  {details.parking.totalMinutes > 0 
                    ? `${details.parking.totalHours}h (${details.parking.totalMinutes} mins)` 
                    : 'None'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Rate per hour</span>
                <span className="font-semibold text-gray-900">£{details.parking.pricePerHour.toFixed(2)}</span>
              </div>
              {details.parking.applicableRestrictions.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs font-medium text-amber-800 mb-1">Restrictions Applied:</p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    {details.parking.applicableRestrictions.map((r, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="text-amber-500">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded">
                  {details.parking.calculation}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Tariff Applied */}
      {details?.tariffApplied && details.tariffApplied.elements.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TariffIcon className="w-5 h-5 text-purple-500" />
            Tariff Applied
            <span className="ml-auto text-sm font-normal text-gray-500">{details.tariffApplied.currency}</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Component</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Price</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Step Size</th>
                  <th className="text-right py-2 text-gray-500 font-medium">VAT</th>
                  <th className="text-left py-2 text-gray-500 font-medium pl-4">Restrictions</th>
                </tr>
              </thead>
              <tbody>
                {details.tariffApplied.elements.map((el, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-3">
                      <span className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${el.type === 'ENERGY' ? 'bg-blue-100 text-blue-700' : ''}
                        ${el.type === 'PARKING_TIME' ? 'bg-orange-100 text-orange-700' : ''}
                        ${el.type === 'TIME' ? 'bg-green-100 text-green-700' : ''}
                        ${el.type === 'FLAT' ? 'bg-gray-100 text-gray-700' : ''}
                      `}>
                        {el.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono">£{el.price.toFixed(2)}</td>
                    <td className="py-3 text-right text-gray-600">{el.stepSize}</td>
                    <td className="py-3 text-right text-gray-600">{el.vat}%</td>
                    <td className="py-3 text-left pl-4 text-xs text-gray-500">
                      {el.restrictions?.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Cost Breakdown Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Cost Summary</h3>
        
        {/* Visual Bars */}
        <div className="space-y-4 mb-6">
          <CostBar 
            label="Energy Cost" 
            value={result.formatted.energy_cost}
            rawValue={result.energy}
            percent={energyPercent}
            color="blue"
          />
          <CostBar 
            label="Parking Cost" 
            value={result.formatted.parking_cost}
            rawValue={result.parking}
            percent={parkingPercent}
            color="orange"
          />
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-xl p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal (excl. VAT)</span>
            <span className="font-semibold text-gray-900">{result.formatted.subtotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-2">
              VAT
              <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded font-medium">20%</span>
            </span>
            <span className="font-semibold text-gray-900">{result.formatted.vat_amount}</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="text-lg font-semibold text-gray-900">Total (incl. VAT)</span>
            <span className="text-2xl font-bold text-primary-600">{result.formatted.total_amount}</span>
          </div>
        </div>
      </Card>

      {/* Why This Cost - Explanations */}
      {details?.explanations && details.explanations.length > 0 && (
        <Card className="p-6 border-blue-100 bg-blue-50/30">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <InfoIcon className="w-5 h-5 text-blue-500" />
            Why This Cost?
          </h3>
          <ul className="space-y-2">
            {details.explanations.map((exp, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                  {i + 1}
                </span>
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onNewCalculation}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
        >
          <RefreshIcon />
          New Calculation
        </button>
        <button
          onClick={onStartOver}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        >
          <ResetIcon />
          Start Over
        </button>
      </div>
    </div>
  );
}

function CostBar({
  label,
  value,
  rawValue,
  percent,
  color,
}: {
  label: string;
  value: string;
  rawValue: string;
  percent: number;
  color: "blue" | "orange";
}) {
  const barColors = {
    blue: "bg-blue-500",
    orange: "bg-orange-500",
  };
  const bgColors = {
    blue: "bg-blue-100",
    orange: "bg-orange-100",
  };

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="text-right">
          <span className="text-lg font-bold text-gray-900">{value}</span>
          <span className="text-xs text-gray-400 ml-2">({rawValue})</span>
        </div>
      </div>
      <div className={`h-3 rounded-full ${bgColors[color]} overflow-hidden`}>
        <div 
          className={`h-full rounded-full ${barColors[color]} transition-all duration-700 ease-out`}
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function CalculatorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RefreshIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ClockIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function DayIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ResetIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}

function TimeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DurationIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BoltIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ParkingIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function TariffIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function InfoIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FormIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CodeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

// ============================================================================
// Detail Card Component
// ============================================================================

function DetailCard({ 
  label, 
  value, 
  subValue,
  icon 
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-gray-900 font-semibold">{value}</p>
      {subValue && <p className="text-gray-500 text-xs mt-0.5">{subValue}</p>}
    </div>
  );
}

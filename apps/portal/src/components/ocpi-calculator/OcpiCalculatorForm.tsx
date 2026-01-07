"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Spinner, WarningIcon } from "@/components/ui";
import { useCostCalculator, type AppError } from "@/lib/ocpi";
import type { CostBreakdownResponse } from "@/lib/ocpi/domain/schemas";
import { styles } from "./styles";
import { 
  CalculatorIcon, CheckIcon, CheckCircleIcon, FormIcon, CodeIcon, 
  TrashIcon, PlusIcon, BoltIcon, ParkingIcon, TariffIcon, InfoIcon,
  ClockIcon, CalendarIcon, DayIcon 
} from "./icons";
import { 
  DEFAULT_SESSION_FORM, DEFAULT_TARIFF_FORM, DEFAULT_RECORD_FORM,
  EXAMPLE_SESSION, EXAMPLE_TARIFF, EXAMPLE_CDR, EXAMPLE_CDR_TARIFF, EXAMPLE_RECORD 
} from "./defaults";
import type { 
  CalculationType, InputMode, Step, 
  SessionFormData, TariffFormData, RecordFormData, 
  ChargingDimension, PriceComponent, TariffRestriction 
} from "./types";
import { TYPE_INFO } from "./types";

export function OcpiCalculatorForm() {
  const [step, setStep] = useState<Step>(1);
  const [calculationType, setCalculationType] = useState<CalculationType>("session");
  const [inputMode, setInputMode] = useState<InputMode>("form");
  
  const [sessionJson, setSessionJson] = useState(EXAMPLE_SESSION);
  const [tariffJson, setTariffJson] = useState(EXAMPLE_TARIFF);
  const [cdrJson, setCdrJson] = useState(EXAMPLE_CDR);
  const [cdrTariffJson, setCdrTariffJson] = useState(EXAMPLE_CDR_TARIFF);
  const [recordJson, setRecordJson] = useState(EXAMPLE_RECORD);
  
  const [sessionForm, setSessionForm] = useState<SessionFormData>(DEFAULT_SESSION_FORM);
  const [tariffForm, setTariffForm] = useState<TariffFormData>(DEFAULT_TARIFF_FORM);
  const [recordForm, setRecordForm] = useState<RecordFormData>(DEFAULT_RECORD_FORM);
  
  const { result, error, isLoading, calculate, reset } = useCostCalculator();

  const syncFormToJson = useCallback(() => {
    if (inputMode !== "form") return;
    
    setSessionJson(JSON.stringify({
      ...sessionForm,
      start_date_time: new Date(sessionForm.start_date_time).toISOString(),
      end_date_time: new Date(sessionForm.end_date_time).toISOString(),
      cdr_token: { uid: "012345678", type: "RFID", contract_id: "GB-VCH-C12345678-V" },
      auth_method: "WHITELIST",
      total_cost: { excl_vat: 0, incl_vat: 0 },
      total_energy: sessionForm.kwh,
      status: "COMPLETED",
      last_updated: new Date().toISOString(),
    }, null, 2));
    
    const tariffPayload = JSON.stringify({
      ...tariffForm,
      type: "REGULAR",
      tariff_alt_text: [{ language: "en", text: "Standard charging tariff" }],
      last_updated: new Date().toISOString(),
    }, null, 2);
    setTariffJson(tariffPayload);
    setCdrTariffJson(tariffPayload);
    
    setRecordJson(JSON.stringify({
      ...recordForm,
      start_date_time: new Date(recordForm.start_date_time).toISOString(),
      end_date_time: new Date(recordForm.end_date_time).toISOString(),
      total_energy: recordForm.kwh,
    }, null, 2));
  }, [inputMode, sessionForm, tariffForm, recordForm]);

  useEffect(() => { syncFormToJson(); }, [syncFormToJson]);
  useEffect(() => { if (result) setStep(3); }, [result]);
  useEffect(() => { if (error) setStep(2); }, [error]);

  const handleTypeSelect = (type: CalculationType) => {
    setCalculationType(type);
    setStep(2);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (calculationType === "session") {
        await calculate({ type: "session", session: JSON.parse(sessionJson), tariff: JSON.parse(tariffJson) });
      } else if (calculationType === "record") {
        await calculate({ type: "record", record: JSON.parse(recordJson), tariff: JSON.parse(tariffJson) });
      } else {
        await calculate({ type: "cdr", cdr: JSON.parse(cdrJson), tariff: JSON.parse(cdrTariffJson) });
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

  const handleModeSwitch = (mode: InputMode) => {
    if (mode === "json" && inputMode === "form") syncFormToJson();
    setInputMode(mode);
  };

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={step} onStepClick={setStep} hasResult={!!result} />

      {step === 1 && (
        <div className="animate-fadeIn">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Calculation Type</h2>
            <p className="text-sm text-gray-500 mb-6">Choose the type of OCPI data you want to calculate costs for</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(TYPE_INFO) as CalculationType[]).map((type) => (
                <TypeCard key={type} type={type} info={TYPE_INFO[type]} isSelected={calculationType === type} onClick={() => handleTypeSelect(type)} />
              ))}
            </div>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{TYPE_INFO[calculationType].icon}</span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{TYPE_INFO[calculationType].title}</h2>
                <p className="text-sm text-gray-500">{TYPE_INFO[calculationType].description}</p>
              </div>
              <button type="button" onClick={() => setStep(1)} className={styles.btnLink + " ml-4"}>Change type</button>
            </div>
            {calculationType !== "cdr" && <InputModeToggle mode={inputMode} onModeChange={handleModeSwitch} />}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <ErrorDisplay error={error} />}
            
            {inputMode === "form" && calculationType !== "cdr" ? (
              <FormInputSection
                calculationType={calculationType}
                sessionForm={sessionForm} setSessionForm={setSessionForm}
                tariffForm={tariffForm} setTariffForm={setTariffForm}
                recordForm={recordForm} setRecordForm={setRecordForm}
              />
            ) : (
              <DataInputSection
                calculationType={calculationType}
                sessionJson={sessionJson} setSessionJson={setSessionJson}
                tariffJson={tariffJson} setTariffJson={setTariffJson}
                cdrJson={cdrJson} setCdrJson={setCdrJson}
                cdrTariffJson={cdrTariffJson} setCdrTariffJson={setCdrTariffJson}
                recordJson={recordJson} setRecordJson={setRecordJson}
              />
            )}

            <div className="flex gap-4">
              <button type="submit" disabled={isLoading} className={styles.btnPrimary}>
                {isLoading ? <><Spinner className="w-5 h-5" /><span>Calculating...</span></> : <><CalculatorIcon /><span>Calculate Cost</span></>}
              </button>
              <button type="button" onClick={handleReset} className={styles.btnSecondary}>Start Over</button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && result && (
        <div className="animate-fadeIn">
          <ResultsDisplay result={result} calculationType={calculationType} onNewCalculation={() => { reset(); setStep(2); }} onStartOver={handleReset} />
        </div>
      )}
    </div>
  );
}

function StepIndicator({ currentStep, onStepClick, hasResult }: { currentStep: Step; onStepClick: (step: Step) => void; hasResult: boolean }) {
  const steps = [{ num: 1, label: "Select Type" }, { num: 2, label: "Enter Data" }, { num: 3, label: "View Results" }];

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-2 sm:gap-4 bg-white rounded-full px-4 sm:px-6 py-3 shadow-sm border border-gray-100">
        {steps.map((step, index) => {
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num || (step.num === 3 && hasResult);
          const canClick = step.num < currentStep || (step.num === 3 && hasResult);
          
          return (
            <div key={step.num} className="flex items-center gap-2 sm:gap-4">
              {index > 0 && <div className={`w-6 sm:w-12 h-0.5 ${isCompleted || isActive ? "bg-primary-500" : "bg-gray-200"}`} />}
              <button
                type="button"
                onClick={() => canClick && onStepClick(step.num as Step)}
                disabled={!canClick}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                  isActive ? "bg-primary-500 text-white" : isCompleted ? "bg-primary-100 text-primary-700 hover:bg-primary-200" : "bg-gray-100 text-gray-400"
                } ${canClick ? "cursor-pointer" : "cursor-default"}`}
              >
                {isCompleted && !isActive ? <CheckIcon className="w-4 h-4" /> : <span className="text-sm font-semibold">{step.num}</span>}
                <span className="hidden sm:inline text-sm font-medium">{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypeCard({ type, info, isSelected, onClick }: { type: CalculationType; info: typeof TYPE_INFO[CalculationType]; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-5 rounded-xl border-2 text-left transition-all hover:border-primary-300 hover:shadow-md ${
        isSelected ? "border-primary-500 bg-primary-50 shadow-md" : "border-gray-200 bg-white"
      }`}
    >
      <span className="text-3xl mb-3 block">{info.icon}</span>
      <h3 className="font-semibold text-gray-900 mb-1">{info.title}</h3>
      <p className="text-sm text-gray-500">{info.description}</p>
    </button>
  );
}

function InputModeToggle({ mode, onModeChange }: { mode: InputMode; onModeChange: (mode: InputMode) => void }) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
      {(["form", "json"] as InputMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onModeChange(m)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
            mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {m === "form" ? <FormIcon /> : <CodeIcon />}
          {m === "form" ? "Form" : "JSON"}
        </button>
      ))}
    </div>
  );
}

function ErrorDisplay({ error }: { error: AppError }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 animate-shake">
      <div className="flex gap-4">
        <div className="flex-shrink-0"><div className="bg-red-100 p-2.5 rounded-full"><WarningIcon className="w-5 h-5 text-red-600" /></div></div>
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

function DataInputSection({ calculationType, sessionJson, setSessionJson, tariffJson, setTariffJson, cdrJson, setCdrJson, cdrTariffJson, setCdrTariffJson, recordJson, setRecordJson }: {
  calculationType: CalculationType;
  sessionJson: string; setSessionJson: (v: string) => void;
  tariffJson: string; setTariffJson: (v: string) => void;
  cdrJson: string; setCdrJson: (v: string) => void;
  cdrTariffJson: string; setCdrTariffJson: (v: string) => void;
  recordJson: string; setRecordJson: (v: string) => void;
}) {
  if (calculationType === "session") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JsonInputCard label="OCPI Session" description="Charging session data with periods and dimensions" value={sessionJson} onChange={setSessionJson} rows={18} />
        <JsonInputCard label="OCPI Tariff" description="Pricing structure with elements and restrictions" value={tariffJson} onChange={setTariffJson} rows={18} />
      </div>
    );
  }
  if (calculationType === "record") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JsonInputCard label="Charge Record" description="Simplified record with charging periods" value={recordJson} onChange={setRecordJson} rows={14} />
        <JsonInputCard label="OCPI Tariff" description="Pricing structure with elements and restrictions" value={tariffJson} onChange={setTariffJson} rows={14} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <JsonInputCard label="OCPI CDR" description="Charge Detail Record with session details" value={cdrJson} onChange={setCdrJson} rows={22} />
      <JsonInputCard label="OCPI Tariff" description="Separate tariff for cost calculation" value={cdrTariffJson} onChange={setCdrTariffJson} rows={22} />
    </div>
  );
}

function JsonInputCard({ label, description, value, onChange, rows }: { label: string; description: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <Card className={styles.card}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <label className="block text-sm font-semibold text-gray-800">{label}</label>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span className={`${styles.badge} bg-gray-100 text-gray-500 font-mono`}>JSON</span>
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={styles.textarea} spellCheck={false} />
    </Card>
  );
}

function FormInputSection({ calculationType, sessionForm, setSessionForm, tariffForm, setTariffForm, recordForm, setRecordForm }: {
  calculationType: CalculationType;
  sessionForm: SessionFormData; setSessionForm: (v: SessionFormData) => void;
  tariffForm: TariffFormData; setTariffForm: (v: TariffFormData) => void;
  recordForm: RecordFormData; setRecordForm: (v: RecordFormData) => void;
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
  return null;
}

function SessionFormCard({ form, onChange }: { form: SessionFormData; onChange: (v: SessionFormData) => void }) {
  const updateKwh = (value: number) => {
    const newPeriods = form.charging_periods.map(p => ({
      ...p,
      dimensions: p.dimensions.map(d => d.type === "ENERGY" ? { ...d, volume: value } : d),
    }));
    onChange({ ...form, kwh: value, charging_periods: newPeriods });
  };

  const updateDimension = (pIdx: number, dIdx: number, field: keyof ChargingDimension, value: string | number) => {
    const newPeriods = [...form.charging_periods];
    const dims = [...newPeriods[pIdx].dimensions];
    dims[dIdx] = { ...dims[dIdx], [field]: value };
    newPeriods[pIdx] = { ...newPeriods[pIdx], dimensions: dims };
    const newKwh = dims[dIdx].type === "ENERGY" && field === "volume" ? (typeof value === "number" ? value : parseFloat(value) || 0) : form.kwh;
    onChange({ ...form, charging_periods: newPeriods, kwh: newKwh });
  };

  const addDimension = (pIdx: number) => {
    const newPeriods = [...form.charging_periods];
    newPeriods[pIdx].dimensions.push({ type: "TIME", volume: 0 });
    onChange({ ...form, charging_periods: newPeriods });
  };

  const removeDimension = (pIdx: number, dIdx: number) => {
    const newPeriods = [...form.charging_periods];
    newPeriods[pIdx].dimensions.splice(dIdx, 1);
    onChange({ ...form, charging_periods: newPeriods });
  };

  return (
    <Card className={styles.card}>
      <div className="flex items-start justify-between mb-4">
        <div><label className="block text-sm font-semibold text-gray-800">OCPI Session</label><p className="text-xs text-gray-500 mt-0.5">Charging session details</p></div>
        <span className={`${styles.badge} bg-primary-50 text-primary-600`}>Form</span>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start Time"><input type="datetime-local" value={form.start_date_time} onChange={(e) => onChange({ ...form, start_date_time: e.target.value })} className={styles.input} /></FormField>
          <FormField label="End Time"><input type="datetime-local" value={form.end_date_time} onChange={(e) => onChange({ ...form, end_date_time: e.target.value })} className={styles.input} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Energy (kWh)"><input type="number" step="0.1" value={form.kwh} onChange={(e) => updateKwh(parseFloat(e.target.value) || 0)} className={styles.input} /></FormField>
          <FormField label="Currency">
            <select value={form.currency} onChange={(e) => onChange({ ...form, currency: e.target.value })} className={styles.select}>
              <option value="GBP">GBP (£)</option><option value="EUR">EUR (€)</option><option value="USD">USD ($)</option>
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Country"><input type="text" value={form.country_code} onChange={(e) => onChange({ ...form, country_code: e.target.value.toUpperCase() })} maxLength={2} className={styles.input} /></FormField>
          <FormField label="Party ID"><input type="text" value={form.party_id} onChange={(e) => onChange({ ...form, party_id: e.target.value.toUpperCase() })} maxLength={3} className={styles.input} /></FormField>
          <FormField label="Location"><input type="text" value={form.location_id} onChange={(e) => onChange({ ...form, location_id: e.target.value })} className={styles.input} /></FormField>
        </div>
        <div className="border-t pt-4">
          <label className="text-sm font-medium text-gray-700 mb-3 block">Charging Dimensions</label>
          {form.charging_periods.map((period, pIdx) => (
            <div key={pIdx} className="space-y-2">
              {period.dimensions.map((dim, dIdx) => (
                <div key={dIdx} className="flex items-center gap-2">
                  <select value={dim.type} onChange={(e) => updateDimension(pIdx, dIdx, "type", e.target.value as ChargingDimension["type"])} className={styles.select + " flex-1"}>
                    <option value="ENERGY">Energy (kWh)</option><option value="TIME">Time (hours)</option><option value="PARKING_TIME">Parking (hours)</option><option value="FLAT">Flat Fee</option>
                  </select>
                  <input type="number" step="0.01" value={dim.volume} onChange={(e) => updateDimension(pIdx, dIdx, "volume", parseFloat(e.target.value) || 0)} className={styles.input + " w-24"} />
                  <button type="button" onClick={() => removeDimension(pIdx, dIdx)} className={styles.btnIcon} disabled={period.dimensions.length <= 1}><TrashIcon /></button>
                </div>
              ))}
              <button type="button" onClick={() => addDimension(pIdx)} className={styles.btnLink + " flex items-center gap-1 mt-2"}><PlusIcon /> Add Dimension</button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function RecordFormCard({ form, onChange }: { form: RecordFormData; onChange: (v: RecordFormData) => void }) {
  const updateDimension = (pIdx: number, dIdx: number, field: keyof ChargingDimension, value: string | number) => {
    const newPeriods = [...form.charging_periods];
    const dims = [...newPeriods[pIdx].dimensions];
    dims[dIdx] = { ...dims[dIdx], [field]: value };
    newPeriods[pIdx] = { ...newPeriods[pIdx], dimensions: dims };
    const newKwh = dims[dIdx].type === "ENERGY" && field === "volume" ? (typeof value === "number" ? value : parseFloat(value) || 0) : form.kwh;
    onChange({ ...form, charging_periods: newPeriods, kwh: newKwh });
  };

  return (
    <Card className={styles.card}>
      <div className="flex items-start justify-between mb-4">
        <div><label className="block text-sm font-semibold text-gray-800">Charge Record</label><p className="text-xs text-gray-500 mt-0.5">Simple charging record</p></div>
        <span className={`${styles.badge} bg-primary-50 text-primary-600`}>Form</span>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start Time"><input type="datetime-local" value={form.start_date_time} onChange={(e) => onChange({ ...form, start_date_time: e.target.value })} className={styles.input} /></FormField>
          <FormField label="End Time"><input type="datetime-local" value={form.end_date_time} onChange={(e) => onChange({ ...form, end_date_time: e.target.value })} className={styles.input} /></FormField>
        </div>
        <FormField label="Total Energy (kWh)"><input type="number" step="0.1" value={form.kwh} onChange={(e) => onChange({ ...form, kwh: parseFloat(e.target.value) || 0 })} className={styles.input} /></FormField>
        <div className="border-t pt-4">
          <label className="text-sm font-medium text-gray-700 mb-3 block">Charging Dimensions</label>
          {form.charging_periods.map((period, pIdx) => (
            <div key={pIdx} className="space-y-2">
              {period.dimensions.map((dim, dIdx) => (
                <div key={dIdx} className="flex items-center gap-2">
                  <select value={dim.type} onChange={(e) => updateDimension(pIdx, dIdx, "type", e.target.value as ChargingDimension["type"])} className={styles.select + " flex-1"}>
                    <option value="ENERGY">Energy (kWh)</option><option value="TIME">Time (hours)</option><option value="PARKING_TIME">Parking (hours)</option><option value="FLAT">Flat Fee</option>
                  </select>
                  <input type="number" step="0.01" value={dim.volume} onChange={(e) => updateDimension(pIdx, dIdx, "volume", parseFloat(e.target.value) || 0)} className={styles.input + " w-24"} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function TariffFormCard({ form, onChange }: { form: TariffFormData; onChange: (v: TariffFormData) => void }) {
  const updatePrice = (eIdx: number, pIdx: number, field: keyof PriceComponent, value: string | number) => {
    const newElements = [...form.elements];
    const comps = [...newElements[eIdx].price_components];
    comps[pIdx] = { ...comps[pIdx], [field]: value };
    newElements[eIdx] = { ...newElements[eIdx], price_components: comps };
    onChange({ ...form, elements: newElements });
  };

  const addPrice = (eIdx: number) => {
    const newElements = [...form.elements];
    newElements[eIdx].price_components.push({ type: "ENERGY", price: 0, step_size: 1, vat: 20 });
    onChange({ ...form, elements: newElements });
  };

  const removePrice = (eIdx: number, pIdx: number) => {
    const newElements = [...form.elements];
    newElements[eIdx].price_components.splice(pIdx, 1);
    if (newElements[eIdx].price_components.length === 0) newElements.splice(eIdx, 1);
    onChange({ ...form, elements: newElements });
  };

  const toggleRestriction = (eIdx: number) => {
    const newElements = [...form.elements];
    newElements[eIdx].restrictions = newElements[eIdx].restrictions 
      ? undefined 
      : { start_time: "09:00", end_time: "18:00", day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] };
    onChange({ ...form, elements: newElements });
  };

  const updateRestriction = (eIdx: number, field: keyof TariffRestriction, value: string | string[]) => {
    const newElements = [...form.elements];
    if (newElements[eIdx].restrictions) {
      newElements[eIdx].restrictions = { ...newElements[eIdx].restrictions, [field]: value };
      onChange({ ...form, elements: newElements });
    }
  };

  return (
    <Card className={styles.card}>
      <div className="flex items-start justify-between mb-4">
        <div><label className="block text-sm font-semibold text-gray-800">OCPI Tariff</label><p className="text-xs text-gray-500 mt-0.5">Pricing structure</p></div>
        <span className={`${styles.badge} bg-primary-50 text-primary-600`}>Form</span>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Country"><input type="text" value={form.country_code} onChange={(e) => onChange({ ...form, country_code: e.target.value.toUpperCase() })} maxLength={2} className={styles.input} /></FormField>
          <FormField label="Party ID"><input type="text" value={form.party_id} onChange={(e) => onChange({ ...form, party_id: e.target.value.toUpperCase() })} maxLength={3} className={styles.input} /></FormField>
          <FormField label="Currency">
            <select value={form.currency} onChange={(e) => onChange({ ...form, currency: e.target.value })} className={styles.select}>
              <option value="GBP">GBP (£)</option><option value="EUR">EUR (€)</option><option value="USD">USD ($)</option>
            </select>
          </FormField>
        </div>
        <div className="border-t pt-4">
          <label className="text-sm font-medium text-gray-700 mb-3 block">Price Components</label>
          {form.elements.map((element, eIdx) => (
            <div key={eIdx} className="mb-4 pb-4 border-b border-gray-100 last:border-0">
              {element.price_components.map((comp, pIdx) => (
                <div key={pIdx} className="flex items-center gap-2 mb-2">
                  <select value={comp.type} onChange={(e) => updatePrice(eIdx, pIdx, "type", e.target.value as PriceComponent["type"])} className={styles.select + " flex-1"}>
                    <option value="ENERGY">Energy (/kWh)</option><option value="TIME">Time (/hour)</option><option value="PARKING_TIME">Parking (/hour)</option><option value="FLAT">Flat Fee</option>
                  </select>
                  <input type="number" step="0.01" value={comp.price} onChange={(e) => updatePrice(eIdx, pIdx, "price", parseFloat(e.target.value) || 0)} className={styles.input + " w-20"} placeholder="Price" />
                  <input type="number" value={comp.vat} onChange={(e) => updatePrice(eIdx, pIdx, "vat", parseInt(e.target.value) || 0)} className={styles.input + " w-16"} placeholder="VAT%" />
                  <button type="button" onClick={() => removePrice(eIdx, pIdx)} className={styles.btnIcon}><TrashIcon /></button>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => addPrice(eIdx)} className={styles.btnLink + " flex items-center gap-1"}><PlusIcon /> Add Price</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={() => toggleRestriction(eIdx)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                  {element.restrictions ? "Remove Restrictions" : "Add Restrictions"}
                </button>
              </div>
              {element.restrictions && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-2">Time Restrictions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="time" value={element.restrictions.start_time || ""} onChange={(e) => updateRestriction(eIdx, "start_time", e.target.value)} className={styles.input} />
                    <input type="time" value={element.restrictions.end_time || ""} onChange={(e) => updateRestriction(eIdx, "end_time", e.target.value)} className={styles.input} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, i) => {
                      const fullDay = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"][i];
                      const isActive = element.restrictions?.day_of_week?.includes(fullDay);
                      return (
                        <button key={day} type="button" onClick={() => {
                          const current = element.restrictions?.day_of_week || [];
                          updateRestriction(eIdx, "day_of_week", isActive ? current.filter(d => d !== fullDay) : [...current, fullDay]);
                        }} className={`px-2 py-1 text-xs rounded font-medium transition-colors ${isActive ? "bg-primary-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={() => onChange({ ...form, elements: [...form.elements, { price_components: [{ type: "ENERGY", price: 0, step_size: 1, vat: 20 }] }] })} 
            className="w-full py-2 text-sm text-primary-500 hover:text-primary-600 font-medium border border-dashed border-primary-300 rounded-lg hover:border-primary-400 transition-colors flex items-center justify-center gap-1">
            <PlusIcon /> Add Tariff Element
          </button>
        </div>
      </div>
    </Card>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={styles.label}>{label}</label>{children}</div>;
}

function ResultsDisplay({ result, calculationType, onNewCalculation, onStartOver }: { 
  result: CostBreakdownResponse; calculationType: CalculationType; onNewCalculation: () => void; onStartOver: () => void;
}) {
  const energyValue = parseFloat(result.energy);
  const parkingValue = parseFloat(result.parking);
  const totalValue = energyValue + parkingValue;
  const energyPercent = totalValue > 0 ? (energyValue / totalValue) * 100 : 0;
  const parkingPercent = totalValue > 0 ? (parkingValue / totalValue) * 100 : 0;
  const details = result.details;

  return (
    <div className="space-y-6">
      <Card className="p-6 border-primary-200 bg-gradient-to-br from-primary-50 to-white">
        <div className="flex items-center gap-4">
          <div className="bg-primary-100 p-3 rounded-full"><CheckCircleIcon className="w-8 h-8 text-primary-600" /></div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Cost Calculated Successfully</h2>
            <p className="text-sm text-gray-600 mt-0.5">Based on your {TYPE_INFO[calculationType].title.toLowerCase()} data</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-3xl font-bold text-primary-600">{result.formatted.total_amount}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DetailCard label="Energy Cost" value={result.formatted.energy_cost} icon={<BoltIcon className="w-4 h-4" />} />
        <DetailCard label="Parking Cost" value={result.formatted.parking_cost} icon={<ParkingIcon className="w-4 h-4" />} />
        <DetailCard label="Subtotal" value={result.formatted.subtotal} icon={<TariffIcon className="w-4 h-4" />} />
        <DetailCard label="VAT" value={result.formatted.vat_amount} icon={<InfoIcon className="w-4 h-4" />} />
      </div>

      {details && (
        <>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Session Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DetailCard label="Duration" value={details.session.durationFormatted} subValue={`${details.session.durationMinutes} minutes`} icon={<ClockIcon className="w-4 h-4" />} />
              <DetailCard label="Day" value={details.session.dayOfWeek} subValue={details.session.date} icon={<CalendarIcon />} />
              <DetailCard label="Time of Day" value={details.session.timeOfDay} icon={<DayIcon />} />
              <DetailCard label="Energy Used" value={`${details.energy.totalKwh} kWh`} subValue={details.energy.calculation} icon={<BoltIcon className="w-4 h-4" />} />
            </div>
          </Card>

          {(energyPercent > 0 || parkingPercent > 0) && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Cost Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20">Energy</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="bg-primary-500 h-full rounded-full transition-all" style={{ width: `${energyPercent}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-20 text-right">{result.formatted.energy_cost}</span>
                </div>
                {parkingPercent > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-20">Parking</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${parkingPercent}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-20 text-right">{result.formatted.parking_cost}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {details.explanations.length > 0 && (
            <Card className="p-5 bg-blue-50 border-blue-200">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2"><InfoIcon className="w-4 h-4" /> Why This Cost?</h3>
              <ul className="space-y-2">
                {details.explanations.map((exp, i) => <li key={i} className="text-sm text-blue-700 flex items-start gap-2"><span className="text-blue-400 mt-1">•</span>{exp}</li>)}
              </ul>
            </Card>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button onClick={onNewCalculation} className={styles.btnPrimary + " justify-center"}><CalculatorIcon /> New Calculation</button>
        <button onClick={onStartOver} className={styles.btnSecondary + " justify-center"}>Start Over</button>
      </div>
    </div>
  );
}

function DetailCard({ label, value, subValue, icon }: { label: string; value: string; subValue?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">{icon}<span>{label}</span></div>
      <p className="text-gray-900 font-semibold">{value}</p>
      {subValue && <p className="text-gray-500 text-xs mt-0.5">{subValue}</p>}
    </div>
  );
}

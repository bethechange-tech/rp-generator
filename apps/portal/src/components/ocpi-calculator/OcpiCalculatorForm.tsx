"use client";

import { useState, useEffect } from "react";
import { Card, Spinner, WarningIcon } from "@/components/ui";
import { useCostCalculator, type AppError } from "@/lib/ocpi";
import type { CostBreakdownResponse } from "@/lib/ocpi/domain/schemas";
import { styles } from "./styles";
import { 
  CalculatorIcon, CheckIcon, CheckCircleIcon,
  BoltIcon, ParkingIcon, TariffIcon, InfoIcon, ClockIcon, CalendarIcon 
} from "./icons";
import { EXAMPLE_SESSION, EXAMPLE_TARIFF, EXAMPLE_CDR, EXAMPLE_CDR_TARIFF, EXAMPLE_RECORD } from "./defaults";
import type { CalculationType, Step } from "./types";
import { TYPE_INFO } from "./types";

export function OcpiCalculatorForm() {
  const [step, setStep] = useState<Step>(1);
  const [calculationType, setCalculationType] = useState<CalculationType>("session");
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  
  const [sessionJson, setSessionJson] = useState(EXAMPLE_SESSION);
  const [tariffJson, setTariffJson] = useState(EXAMPLE_TARIFF);
  const [cdrJson, setCdrJson] = useState(EXAMPLE_CDR);
  const [cdrTariffJson, setCdrTariffJson] = useState(EXAMPLE_CDR_TARIFF);
  const [recordJson, setRecordJson] = useState(EXAMPLE_RECORD);
  
  const { result, error, isLoading, calculate, reset } = useCostCalculator();

  useEffect(() => { if (result) setStep(3); }, [result]);
  useEffect(() => { if (error) setStep(2); }, [error]);

  const handleTypeSelect = (type: CalculationType) => {
    setCalculationType(type);
    setStep(2);
    reset();
  };

  const syncFromPeriods = (json: string): string => {
    try {
      const data = JSON.parse(json);
      if (!data.charging_periods?.length) return json;
      
      let totalEnergy = 0;
      let totalParking = 0;
      
      for (const period of data.charging_periods) {
        for (const dim of period.dimensions || []) {
          if (dim.type === "ENERGY") totalEnergy += dim.volume || 0;
          if (dim.type === "PARKING_TIME") totalParking += dim.volume || 0;
        }
      }
      
      return JSON.stringify({
        ...data,
        kwh: totalEnergy,
        total_energy: totalEnergy,
        total_parking_time: totalParking,
      }, null, 2);
    } catch {
      return json;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (calculationType === "session") {
        const syncedSession = syncFromPeriods(sessionJson);
        setSessionJson(syncedSession);
        await calculate({ type: "session", session: JSON.parse(syncedSession), tariff: JSON.parse(tariffJson) });
      } else if (calculationType === "record") {
        const syncedRecord = syncFromPeriods(recordJson);
        setRecordJson(syncedRecord);
        await calculate({ type: "record", record: JSON.parse(syncedRecord), tariff: JSON.parse(tariffJson) });
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
    setSessionJson(EXAMPLE_SESSION);
    setTariffJson(EXAMPLE_TARIFF);
    setCdrJson(EXAMPLE_CDR);
    setCdrTariffJson(EXAMPLE_CDR_TARIFF);
    setRecordJson(EXAMPLE_RECORD);
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
            <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <ErrorDisplay error={error} />}
            
            <DataInputSection
              calculationType={calculationType}
              inputMode={inputMode}
              sessionJson={sessionJson} setSessionJson={setSessionJson}
              tariffJson={tariffJson} setTariffJson={setTariffJson}
              cdrJson={cdrJson} setCdrJson={setCdrJson}
              cdrTariffJson={cdrTariffJson} setCdrTariffJson={setCdrTariffJson}
              recordJson={recordJson} setRecordJson={setRecordJson}
            />

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

function ErrorDisplay({ error }: { error: AppError }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
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

function InputModeToggle({ mode, onModeChange }: { mode: "form" | "json"; onModeChange: (m: "form" | "json") => void }) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      {(["form", "json"] as const).map((m) => (
        <button key={m} type="button" onClick={() => onModeChange(m)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {m === "form" ? "Form" : "JSON"}
        </button>
      ))}
    </div>
  );
}

function DataInputSection({ calculationType, inputMode, sessionJson, setSessionJson, tariffJson, setTariffJson, cdrJson, setCdrJson, cdrTariffJson, setCdrTariffJson, recordJson, setRecordJson }: {
  calculationType: CalculationType;
  inputMode: "form" | "json";
  sessionJson: string; setSessionJson: (v: string) => void;
  tariffJson: string; setTariffJson: (v: string) => void;
  cdrJson: string; setCdrJson: (v: string) => void;
  cdrTariffJson: string; setCdrTariffJson: (v: string) => void;
  recordJson: string; setRecordJson: (v: string) => void;
}) {
  if (calculationType === "session") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InputCard label="OCPI Session" description="Charging session data" value={sessionJson} onChange={setSessionJson} mode={inputMode} fields={SESSION_FIELDS} />
        <InputCard label="OCPI Tariff" description="Pricing structure" value={tariffJson} onChange={setTariffJson} mode={inputMode} fields={TARIFF_FIELDS} />
      </div>
    );
  }
  if (calculationType === "record") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InputCard label="Charge Record" description="Simplified record" value={recordJson} onChange={setRecordJson} mode={inputMode} fields={RECORD_FIELDS} />
        <InputCard label="OCPI Tariff" description="Pricing structure" value={tariffJson} onChange={setTariffJson} mode={inputMode} fields={TARIFF_FIELDS} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <InputCard label="OCPI CDR" description="Charge Detail Record" value={cdrJson} onChange={setCdrJson} mode={inputMode} fields={[]} />
      <InputCard label="OCPI Tariff" description="Pricing structure" value={cdrTariffJson} onChange={setCdrTariffJson} mode={inputMode} fields={TARIFF_FIELDS} />
    </div>
  );
}

type FieldDef = { key: string; label: string; type?: "number" | "text" | "datetime"; icon?: React.ReactNode; hint?: string; group?: string };

const SESSION_FIELDS: FieldDef[] = [
  { key: "kwh", label: "Energy Consumed", type: "number", icon: <BoltIcon className="w-4 h-4" />, hint: "kWh", group: "Energy" },
  { key: "start_date_time", label: "Start Time", type: "datetime", icon: <ClockIcon className="w-4 h-4" />, group: "Time" },
  { key: "end_date_time", label: "End Time", type: "datetime", icon: <ClockIcon className="w-4 h-4" />, group: "Time" },
  { key: "total_parking_time", label: "Parking Duration", type: "number", icon: <ParkingIcon className="w-4 h-4" />, hint: "hours", group: "Parking" },
];

const RECORD_FIELDS: FieldDef[] = [
  { key: "kwh", label: "Energy Consumed", type: "number", icon: <BoltIcon className="w-4 h-4" />, hint: "kWh", group: "Energy" },
  { key: "duration_minutes", label: "Charging Duration", type: "number", icon: <ClockIcon className="w-4 h-4" />, hint: "minutes", group: "Time" },
  { key: "parking_minutes", label: "Parking Duration", type: "number", icon: <ParkingIcon className="w-4 h-4" />, hint: "minutes", group: "Parking" },
];

const TARIFF_FIELDS: FieldDef[] = [
  { key: "currency", label: "Currency", type: "text", hint: "e.g. EUR, GBP", group: "General" },
];

function InputCard({ label, description, value, onChange, mode, fields }: { 
  label: string; description: string; value: string; onChange: (v: string) => void; mode: "form" | "json"; fields: FieldDef[];
}) {
  const parsed = (() => { try { return JSON.parse(value); } catch { return null; } })();

  const updateField = (key: string, val: string, type?: string) => {
    if (!parsed) return;
    const newVal = type === "number" ? (val === "" ? 0 : Number(val)) : val;
    const updated = { ...parsed, [key]: newVal };
    onChange(JSON.stringify(updated, null, 2));
  };

  const groups = fields.reduce((acc, f) => {
    const g = f.group || "Other";
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {} as Record<string, FieldDef[]>);

  const periods = parsed?.charging_periods || [];
  const showPeriods = label.includes("Session") || label.includes("Record");

  const updatePeriods = (newPeriods: unknown[]) => {
    if (!parsed) return;
    onChange(JSON.stringify({ ...parsed, charging_periods: newPeriods }, null, 2));
  };

  const addPeriod = () => {
    updatePeriods([...periods, { start_date_time: new Date().toISOString(), dimensions: [{ type: "ENERGY", volume: 0 }] }]);
  };

  const removePeriod = (idx: number) => {
    updatePeriods(periods.filter((_: unknown, i: number) => i !== idx));
  };

  const updateDimension = (pIdx: number, dIdx: number, field: "type" | "volume", val: string) => {
    const newPeriods = [...periods];
    const dims = [...(newPeriods[pIdx].dimensions || [])];
    dims[dIdx] = { ...dims[dIdx], [field]: field === "volume" ? Number(val) : val };
    newPeriods[pIdx] = { ...newPeriods[pIdx], dimensions: dims };
    updatePeriods(newPeriods);
  };

  const addDimension = (pIdx: number) => {
    const newPeriods = [...periods];
    newPeriods[pIdx] = { ...newPeriods[pIdx], dimensions: [...(newPeriods[pIdx].dimensions || []), { type: "ENERGY", volume: 0 }] };
    updatePeriods(newPeriods);
  };

  const removeDimension = (pIdx: number, dIdx: number) => {
    const newPeriods = [...periods];
    newPeriods[pIdx] = { ...newPeriods[pIdx], dimensions: newPeriods[pIdx].dimensions.filter((_: unknown, i: number) => i !== dIdx) };
    updatePeriods(newPeriods);
  };

  const elements = parsed?.elements || [];
  const showElements = label.includes("Tariff");

  const updateElements = (newElements: unknown[]) => {
    if (!parsed) return;
    onChange(JSON.stringify({ ...parsed, elements: newElements }, null, 2));
  };

  const addElement = () => {
    updateElements([...elements, { price_components: [{ type: "ENERGY", price: 0, step_size: 1 }] }]);
  };

  const removeElement = (idx: number) => {
    updateElements(elements.filter((_: unknown, i: number) => i !== idx));
  };

  const updatePriceComponent = (eIdx: number, pcIdx: number, field: string, val: string) => {
    const newElements = [...elements];
    const pcs = [...(newElements[eIdx].price_components || [])];
    pcs[pcIdx] = { ...pcs[pcIdx], [field]: ["price", "step_size", "vat"].includes(field) ? Number(val) : val };
    newElements[eIdx] = { ...newElements[eIdx], price_components: pcs };
    updateElements(newElements);
  };

  const addPriceComponent = (eIdx: number) => {
    const newElements = [...elements];
    newElements[eIdx] = { ...newElements[eIdx], price_components: [...(newElements[eIdx].price_components || []), { type: "ENERGY", price: 0, step_size: 1 }] };
    updateElements(newElements);
  };

  const removePriceComponent = (eIdx: number, pcIdx: number) => {
    const newElements = [...elements];
    newElements[eIdx] = { ...newElements[eIdx], price_components: newElements[eIdx].price_components.filter((_: unknown, i: number) => i !== pcIdx) };
    updateElements(newElements);
  };

  return (
    <Card className={styles.card}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800">{label}</label>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span className={`${styles.badge} ${mode === "form" ? "bg-primary-100 text-primary-600" : "bg-gray-100 text-gray-500"} font-mono`}>
          {mode === "form" ? "Form" : "JSON"}
        </span>
      </div>
      {mode === "json" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={16} className={styles.textarea} spellCheck={false} />
      ) : fields.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">Form mode not available for this type.</p>
          <p className="text-xs mt-1">Switch to JSON mode to edit.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groups).map(([groupName, groupFields]) => (
            <div key={groupName}>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{groupName}</div>
              <div className="space-y-3">
                {groupFields.map((f) => (
                  <div key={f.key} className="relative">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                      {f.icon && <span className="text-gray-400">{f.icon}</span>}
                      {f.label}
                    </label>
                    <div className="relative">
                      <input
                        type={f.type === "number" ? "number" : "text"}
                        value={parsed?.[f.key] ?? ""}
                        onChange={(e) => updateField(f.key, e.target.value, f.type)}
                        placeholder={f.hint}
                        className={`${styles.input} ${f.hint ? "pr-16" : ""}`}
                        step={f.type === "number" ? "any" : undefined}
                      />
                      {f.hint && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          {f.hint}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {showPeriods && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Charging Periods</div>
                <button type="button" onClick={addPeriod} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  + Add Period
                </button>
              </div>
              {periods.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No charging periods defined</p>
              ) : (
                <div className="space-y-3">
                  {periods.map((period: { start_date_time?: string; dimensions?: { type: string; volume: number }[] }, pIdx: number) => (
                    <div key={pIdx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">Period {pIdx + 1}</span>
                        <button type="button" onClick={() => removePeriod(pIdx)} className="text-xs text-red-500 hover:text-red-600">Remove</button>
                      </div>
                      <div className="space-y-2">
                        {(period.dimensions || []).map((dim: { type: string; volume: number }, dIdx: number) => (
                          <div key={dIdx} className="flex items-center gap-2">
                            <select
                              value={dim.type}
                              onChange={(e) => updateDimension(pIdx, dIdx, "type", e.target.value)}
                              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
                            >
                              <option value="ENERGY">ENERGY</option>
                              <option value="PARKING_TIME">PARKING_TIME</option>
                            </select>
                            <input
                              type="number"
                              value={dim.volume}
                              onChange={(e) => updateDimension(pIdx, dIdx, "volume", e.target.value)}
                              className="text-xs border border-gray-200 rounded px-2 py-1.5 w-20"
                              step="any"
                            />
                            <span className="text-xs text-gray-400">{dim.type === "ENERGY" ? "kWh" : "hrs"}</span>
                            <button type="button" onClick={() => removeDimension(pIdx, dIdx)} className="text-xs text-gray-400 hover:text-red-500 ml-auto">×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addDimension(pIdx)} className="text-xs text-gray-500 hover:text-primary-600">+ Add Dimension</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showElements && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Price Elements</div>
                <button type="button" onClick={addElement} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  + Add Element
                </button>
              </div>
              {elements.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No price elements defined</p>
              ) : (
                <div className="space-y-3">
                  {elements.map((el: { price_components?: { type: string; price: number; step_size: number; vat?: number }[] }, eIdx: number) => (
                    <div key={eIdx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">Element {eIdx + 1}</span>
                        <button type="button" onClick={() => removeElement(eIdx)} className="text-xs text-red-500 hover:text-red-600">Remove</button>
                      </div>
                      <div className="space-y-2">
                        {(el.price_components || []).map((pc: { type: string; price: number; step_size: number; vat?: number }, pcIdx: number) => (
                          <div key={pcIdx} className="flex flex-wrap items-center gap-2">
                            <select
                              value={pc.type}
                              onChange={(e) => updatePriceComponent(eIdx, pcIdx, "type", e.target.value)}
                              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
                            >
                              <option value="ENERGY">ENERGY</option>
                              <option value="PARKING_TIME">PARKING_TIME</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={pc.price}
                                onChange={(e) => updatePriceComponent(eIdx, pcIdx, "price", e.target.value)}
                                className="text-xs border border-gray-200 rounded px-2 py-1.5 w-20"
                                step="any"
                                placeholder="Price"
                              />
                              <span className="text-xs text-gray-400">/ unit</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">step:</span>
                              <input
                                type="number"
                                value={pc.step_size}
                                onChange={(e) => updatePriceComponent(eIdx, pcIdx, "step_size", e.target.value)}
                                className="text-xs border border-gray-200 rounded px-2 py-1.5 w-16"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">VAT:</span>
                              <input
                                type="number"
                                value={pc.vat ?? 0}
                                onChange={(e) => updatePriceComponent(eIdx, pcIdx, "vat", e.target.value)}
                                className="text-xs border border-gray-200 rounded px-2 py-1.5 w-14"
                              />
                              <span className="text-xs text-gray-400">%</span>
                            </div>
                            <button type="button" onClick={() => removePriceComponent(eIdx, pcIdx)} className="text-xs text-gray-400 hover:text-red-500 ml-auto">×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addPriceComponent(eIdx)} className="text-xs text-gray-500 hover:text-primary-600">+ Add Price Component</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <details className="mt-4 pt-4 border-t border-gray-100">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 flex items-center gap-1">
              <span>Advanced: View Raw JSON</span>
            </summary>
            <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={8} className={`${styles.textarea} mt-3 text-xs`} spellCheck={false} />
          </details>
        </div>
      )}
    </Card>
  );
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
              <DetailCard label="Energy Used" value={`${details.energy.totalKwh} kWh`} subValue={details.energy.calculation} icon={<BoltIcon className="w-4 h-4" />} />
              {details.parking.totalHours > 0 && (
                <DetailCard label="Parking Time" value={`${details.parking.totalMinutes} mins`} subValue={details.parking.calculation} icon={<ParkingIcon className="w-4 h-4" />} />
              )}
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
                {parkingValue > 0 && (
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

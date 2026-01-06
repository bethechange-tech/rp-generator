import { OcpiCalculatorForm } from "@/components/OcpiCalculatorForm";

export const metadata = {
  title: "OCPI Cost Calculator | EV Receipt Portal",
  description: "Calculate charging costs using OCPI session data and tariffs",
};

export default function OcpiCalculatorPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="text-center mb-8 pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-50 text-primary-600 text-sm font-medium rounded-full mb-4">
          <span>⚡</span>
          <span>OCPI 2.2.1 Compatible</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Cost Calculator</h1>
        <p className="text-gray-500 mt-2 max-w-lg mx-auto">
          Calculate EV charging costs from session data, CDRs, or charge records with accurate tariff-based pricing
        </p>
      </div>
      
      <OcpiCalculatorForm />
    </div>
  );
}

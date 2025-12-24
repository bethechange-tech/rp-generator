// Company registry - stores company info by ID
// In production, this could be backed by a database or config file

export interface CompanyInfo {
  company_name: string;
  company_tagline?: string;
  company_logo_svg?: string;
  company_website?: string;
  support_email?: string;
  support_phone?: string;
}

// Hash table for O(1) company lookup
const companyRegistry = new Map<string, CompanyInfo>();

// Pre-register default companies
companyRegistry.set("voltcharge", {
  company_name: "VoltCharge UK",
  company_tagline: "Fast & Clean Energy",
  company_logo_svg: `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="28" stroke="#10b981" stroke-width="3" fill="#ecfdf5"/>
    <path d="M32 18L22 32H28L26 42L38 28H31L32 18Z" fill="#10b981" stroke="#10b981" stroke-width="1" stroke-linejoin="round"/>
  </svg>`,
  company_website: "www.voltcharge.co.uk",
  support_email: "support@voltcharge.co.uk",
  support_phone: "0800-VOLTCHG",
});

companyRegistry.set("greencharge", {
  company_name: "GreenCharge",
  company_tagline: "Powering the Future",
  company_logo_svg: `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="28" stroke="#22c55e" stroke-width="3" fill="#f0fdf4"/>
    <path d="M30 15V30L40 35" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
  company_website: "www.greencharge.com",
  support_email: "help@greencharge.com",
  support_phone: "0800-GREEN",
});

companyRegistry.set("rapidev", {
  company_name: "RapidEV",
  company_tagline: "Charge in Minutes",
  company_logo_svg: `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="50" height="50" rx="10" stroke="#3b82f6" stroke-width="3" fill="#eff6ff"/>
    <path d="M35 18L20 32H28L25 42L42 28H33L35 18Z" fill="#3b82f6"/>
  </svg>`,
  company_website: "www.rapidev.co.uk",
  support_email: "support@rapidev.co.uk",
  support_phone: "0800-RAPID",
});

export const CompanyRegistry = {
  get(companyRef: string): CompanyInfo | undefined {
    return companyRegistry.get(companyRef.toLowerCase());
  },

  register(companyRef: string, info: CompanyInfo): void {
    companyRegistry.set(companyRef.toLowerCase(), info);
  },

  has(companyRef: string): boolean {
    return companyRegistry.has(companyRef.toLowerCase());
  },

  list(): string[] {
    return Array.from(companyRegistry.keys());
  },
};

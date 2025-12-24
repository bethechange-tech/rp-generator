import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EV Receipt Portal",
  description: "Query and view EV charging receipts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen">
          <header className="bg-navy-950 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center gap-3">
                {/* Zest-style hummingbird logo placeholder */}
                <div className="flex items-center">
                  <svg
                    className="w-10 h-10"
                    viewBox="0 0 60 60"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Stylized hummingbird */}
                    <path
                      d="M15 30C15 22 22 15 30 15C35 15 40 18 43 22L48 17C48 17 52 20 50 25C48 30 45 32 45 32L35 42C30 47 22 45 18 40C14 35 15 30 15 30Z"
                      fill="#00d4aa"
                    />
                    <path
                      d="M43 22C46 26 47 31 45 36L35 42"
                      stroke="#2dd4bf"
                      strokeWidth="2"
                      fill="none"
                    />
                    <circle cx="38" cy="24" r="2" fill="#0a1628" />
                    <path
                      d="M15 32L8 35L15 38"
                      stroke="#f472b6"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold">
                    <span className="text-primary-400">EV</span> <span className="text-primary-300">Receipts</span>
                  </h1>
                  <p className="text-navy-300 text-sm">
                    Charging Receipt Portal
                  </p>
                </div>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

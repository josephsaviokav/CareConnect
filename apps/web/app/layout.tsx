import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarrStack — Dental Marketing Dashboard",
  description: "Lapsed patient reactivation, lead conversion, post-appointment reviews",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}

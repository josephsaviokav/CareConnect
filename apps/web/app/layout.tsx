import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";

// Geometric display face + neutral body face
const display = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "CareConnect — Dental Marketing Dashboard",
  description: "Lapsed patient reactivation, lead conversion, post-appointment reviews",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} bg-forest-950 font-sans text-cream antialiased`}>
        {children}
      </body>
    </html>
  );
}

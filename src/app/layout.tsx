import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Ficco Properties — Apartments & Homes in Wheat Ridge, CO",
    template: "%s · Ficco Properties",
  },
  description:
    "Family-owned apartment and senior communities on W 38th Ave in Wheat Ridge, Colorado. Apply online, manage your lease, and request maintenance in one place.",
  metadataBase: new URL("https://ficcoproperties.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-cream text-ink">
        {children}
      </body>
    </html>
  );
}

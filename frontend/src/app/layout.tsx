import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ArkGuard AI — Manpower Safety & QA Sentinel",
  description:
    "Sistem deteksi pelanggaran keselamatan kerja (K3) pada foto pekerja pabrik menggunakan kecerdasan buatan. Analisis otomatis helm, rompi, dan peralatan keselamatan.",
  keywords: [
    "K3",
    "keselamatan kerja",
    "AI detection",
    "safety",
    "YOLOv8",
    "manufacturing",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}

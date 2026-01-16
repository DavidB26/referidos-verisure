import type { Metadata } from "next";
import { Fira_Sans } from "next/font/google";
import "./globals.css";

const fira = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fira",
});

export const metadata: Metadata = {
  title: "Referidos Verisure",
  description: "Programa de referidos Verisure Perú",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={fira.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
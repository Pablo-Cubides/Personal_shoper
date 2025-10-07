import "./globals.css";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";

export const metadata: Metadata = {
  title: "Asesor de Estilo Masculino",
  description: "Recibe consejos sobre cortes de barba, peinados y más.",
};

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head />
      <body className={`${roboto.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
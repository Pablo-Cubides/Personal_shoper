import "./globals.css";
import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";

export const metadata: Metadata = {
  title: "StyleAI - Asesor de Estilo Personal",
  description: "Tu asesor de estilo profesional con IA. Análisis inteligente de vestuario y recomendaciones personalizadas para elevar tu imagen.",
};

const inter = Inter({ 
  subsets: ["latin"], 
  weight: ["400", "500", "600", "700", "800"], 
  variable: "--font-inter",
  display: "swap"
});

const poppins = Poppins({ 
  subsets: ["latin"], 
  weight: ["500", "600", "700", "800"], 
  variable: "--font-poppins",
  display: "swap"
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="light">
      <head />
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased bg-white`}>{children}</body>
    </html>
  );
}
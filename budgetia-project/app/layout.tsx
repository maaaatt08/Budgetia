import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BudgetIA - Analyseur de budget intelligent",
  description: "Analysez et optimisez votre budget avec l'IA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

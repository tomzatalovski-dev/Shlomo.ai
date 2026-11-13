import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shlomo.ai — Trouvez qui a une vraie raison de racheter votre société",
  description: "Donnez votre site ou votre numéro SIREN. Shlomo comprend votre société et cherche ses repreneurs, sous vos yeux.",
};

export default function Racine({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

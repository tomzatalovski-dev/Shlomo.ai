import type { Metadata } from "next";

// L'adresse de cette page contient le jeton secret du dossier : ni indexation, ni fuite vers d'autres sites.
export const metadata: Metadata = { title: "Prospection en cours — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Cadre({ children }: { children: React.ReactNode }) {
  return children;
}

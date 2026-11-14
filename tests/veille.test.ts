import { describe, expect, it } from "vitest";
import { nettoyerVeille } from "@/lib/veille";

describe("veille sur un repreneur", () => {
  it("garde les signaux bien formés et le domaine", () => {
    const v = nettoyerVeille({
      site: "https://www.Exemple.fr/accueil",
      signaux: [
        { fait: "A racheté la société Durand Menuiserie en 2024", source: "https://exemple.fr/actualites/rachat", genre: "rachat" },
        { fait: "Trop court", source: "https://exemple.fr" },
        { fait: "Ouverture d'une agence à Lyon annoncée en 2025", source: "http://pas-https.fr/x" },
        { fait: "Lien <script>douteux</script> dans la phrase, année 2023", source: "javascript:alert(1)" },
      ],
    });
    expect(v.site).toBe("exemple.fr");
    expect(v.signaux).toEqual([{ texte: "A racheté la société Durand Menuiserie en 2024", source: "https://exemple.fr/actualites/rachat", genre: "rachat" }]);
  });
  it("ne garde rien d'une réponse sans forme", () => {
    expect(nettoyerVeille(null)).toEqual({ site: undefined, signaux: [] });
    expect(nettoyerVeille({ site: "pas un domaine", signaux: "non" })).toEqual({ site: undefined, signaux: [] });
  });
});

import { verifierProvenance } from "@/lib/veille";

describe("provenance des faits", () => {
  const fait = (source: string) => ({ texte: "A racheté une société en 2024", source });
  it("ne garde que les faits dont la source a réellement été reçue", () => {
    const pages = [{ url: "https://www.exemple.fr/actualites/rachat/" }, { url: "https://presse.fr/article?id=4" }];
    const { gardes, ecartes } = verifierProvenance([fait("https://exemple.fr/actualites/rachat"), fait("https://presse.fr/article?id=9#haut"), fait("https://invente.fr/page")], pages);
    expect(gardes.map((s) => s.source)).toEqual(["https://exemple.fr/actualites/rachat"]);
    expect(ecartes).toBe(2);
  });
});

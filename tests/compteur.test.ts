import { describe, expect, it } from "vitest";
import { compter, cout, relever } from "@/lib/compteur";

describe("compteur", () => {
  it("additionne les appels faits pendant un relevé, même en parallèle", async () => {
    const r = await relever(async () => {
      await Promise.all([
        (async () => compter({ input_tokens: 1000, output_tokens: 200, server_tool_use: { web_search_requests: 2 } }))(),
        (async () => { await new Promise((x) => setTimeout(x, 5)); compter({ input_tokens: 500, cache_read_input_tokens: 100, output_tokens: 50 }); })(),
      ]);
    });
    // Une lecture en cache coûte un dixième d'un jeton lu : 100 jetons en cache comptent pour 10.
    expect(r).toMatchObject({ appels: 2, entree: 1510, sortie: 250, recherches: 2 });
    expect(r.duree_ms).toBeGreaterThanOrEqual(4);
  });

  it("ne mélange pas deux relevés simultanés et ignore un appel hors relevé", async () => {
    compter({ input_tokens: 999 });
    const [a, b] = await Promise.all([relever(async () => compter({ input_tokens: 10 })), relever(async () => compter({ input_tokens: 20 }))]);
    expect([a.entree, b.entree]).toEqual([10, 20]);
  });

  it("chiffre un relevé au prix du modèle par défaut, et se tait pour un autre modèle", () => {
    expect(cout({ entree: 1_000_000, sortie: 100_000, recherches: 3 }, "claude-haiku-5-5")).toBeCloseTo(0.18, 5);
    expect(cout({ entree: 1, sortie: 1, recherches: 0 }, "autre-modele")).toBeNull();
  });
  it("pèse le modèle fin à son prix", async () => {
    const r = await relever(async () => {
      compter({ input_tokens: 1000, output_tokens: 100 }, 20);
      compter({ input_tokens: 100, cache_read_input_tokens: 4000, output_tokens: 100 }, 20);
    });
    // 1000 × 20, puis 100 × 20 + 4000 lus en cache au vingtième du prix (× 20 × 0,05 = × 1).
    expect(r).toMatchObject({ appels: 2, entree: 20000 + 2000 + 4000, sortie: 4000 });
  });
});

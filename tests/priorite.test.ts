import { describe, expect, it } from "vitest";
import { ordonner, prioriteDe } from "@/lib/priorite";

const s = (genre?: "rachat" | "croissance" | "alerte") => ({ texte: "Un fait public sur la société", source: "https://exemple.fr", genre });

describe("priorité d'un repreneur", () => {
  it("met l'alerte au-dessus de tout, puis le rachat", () => {
    expect(prioriteDe([s("rachat"), s("alerte")])).toBe("a_verifier");
    expect(prioriteDe([s("croissance"), s("rachat")])).toBe("prioritaire");
    expect(prioriteDe([s("croissance")])).toBe("normale");
    expect(prioriteDe(null)).toBe("normale");
  });
  it("classe les acheteurs actifs d'abord, ceux à vérifier en dernier, sans changer l'ordre à égalité", () => {
    const lignes = [{ rang: 1, signaux: [s("alerte")] }, { rang: 2 }, { rang: 3, signaux: [s("rachat")] }, { rang: 4 }];
    expect(ordonner(lignes).map((l) => l.rang)).toEqual([3, 2, 4, 1]);
  });
});

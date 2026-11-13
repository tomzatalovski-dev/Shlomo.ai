import { describe, expect, it } from "vitest";
import { adressePrivee, extraireSiren, lectureInterdite, texteBrut } from "@/lib/site";

describe("lecture de site", () => {
  it("trouve un SIREN ou un SIRET annoncé dans les mentions légales", () => {
    expect(extraireSiren("SAS au capital de 10 000 € - RCS Paris 552 032 534")).toBe("552032534");
    expect(extraireSiren("SIRET : 552 032 534 00646")).toBe("552032534");
  });
  it("ignore un numéro quelconque ou invalide", () => {
    expect(extraireSiren("Téléphone 01 23 45 67 89")).toBeUndefined();
    expect(extraireSiren("SIREN 123 456 789")).toBeUndefined();
  });
  it("retire scripts et balises", () => {
    expect(texteBrut("<p>Bonjour <b>vous</b></p><script>alert(1)</script>")).toBe("Bonjour vous");
  });
  it("respecte un robots.txt qui interdit tout", () => {
    expect(lectureInterdite("User-agent: *\nDisallow: /")).toBe(true);
    expect(lectureInterdite("User-agent: *\nDisallow: /admin")).toBe(false);
    expect(lectureInterdite("User-agent: Googlebot\nDisallow: /")).toBe(false);
  });
  it("refuse les adresses privées et locales", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.0.1", "169.254.169.254", "::1", "fd00::1"]) expect(adressePrivee(ip)).toBe(true);
    expect(adressePrivee("93.184.216.34")).toBe(false);
  });
});

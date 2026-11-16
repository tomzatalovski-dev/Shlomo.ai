/**
 * Ce que Shlomo sait vendre : une société commerciale ou civile, dont on cède les titres.
 * La nature juridique vient du registre (nomenclature des catégories juridiques de l'INSEE).
 * Tout le reste est dit au visiteur dès la première seconde, plutôt que de lui dérouler une recherche qui n'a pas de sens.
 */

const FORMES: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "SNC", "5306": "Société en commandite simple", "5308": "Société en commandite par actions",
  "5410": "SARL", "5498": "EURL", "5499": "SARL",
  "5505": "SA", "5510": "SA", "5515": "SA", "5599": "SA", "5699": "SA à directoire",
  "5710": "SAS", "5720": "SASU", "5800": "Société européenne",
  "6540": "SCI", "6599": "Société civile",
  "6220": "Groupement d'intérêt économique",
  "9210": "Association", "9220": "Association loi 1901", "9221": "Association d'insertion", "9222": "Association intermédiaire",
  "9230": "Association reconnue d'utilité publique", "9240": "Congrégation", "9260": "Association de droit local (Alsace-Moselle)",
  "9300": "Fondation",
};

const FAMILLES: [RegExp, string][] = [
  [/^1/, "Entrepreneur individuel"],
  [/^2/, "Groupement sans personnalité morale"],
  [/^3/, "Société de droit étranger"],
  [/^4/, "Établissement public"],
  [/^51/, "Société coopérative"],
  [/^5/, "Société commerciale"],
  [/^62/, "Groupement d'intérêt économique"],
  [/^63/, "Coopérative agricole"],
  [/^64/, "Société d'assurance mutuelle"],
  [/^65/, "Société civile"],
  [/^6/, "Personne morale immatriculée"],
  [/^7/, "Administration publique"],
  [/^8/, "Organisme social ou professionnel"],
  [/^92/, "Association"],
  [/^93/, "Fondation"],
  [/^9/, "Groupement de droit privé"],
];

export type Nature = { libelle?: string; horsParcours?: string };

export function natureDe(code?: string): Nature {
  if (!code) return {};
  const libelle = FORMES[code] ?? FAMILLES.find(([r]) => r.test(code))?.[1];
  let horsParcours: string | undefined;
  if (/^1/.test(code)) horsParcours = "Vous exercez en nom propre : il n'y a pas de société à céder, seulement un fonds de commerce. Shlomo ne traite pas encore ce cas.";
  else if (/^92/.test(code)) horsParcours = "C'est une association : elle n'a pas de propriétaire et ne se vend pas. Si une société exploite l'activité (c'est souvent le cas d'un club professionnel), donnez son SIREN à elle.";
  else if (/^93/.test(code)) horsParcours = "C'est une fondation : elle n'a pas de propriétaire et ne se vend pas.";
  else if (/^[478]/.test(code)) horsParcours = "C'est un organisme public ou social : il ne se vend pas comme une société.";
  else if (/^3/.test(code)) horsParcours = "C'est une société de droit étranger : Shlomo ne traite pour l'instant que les sociétés françaises.";
  else if (/^(2|6[234]|9)/.test(code)) horsParcours = `${libelle ?? "Cette structure"} : ce n'est pas une société dont on cède les titres. Shlomo ne sait vendre que des sociétés commerciales ou civiles.`;
  return { libelle, horsParcours };
}

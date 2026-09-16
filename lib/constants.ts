import type { ProjectKey } from "./types";

export interface BaseProject {
  key: ProjectKey;
  name: string;
  focus: string;
  urgence: "critique" | "haute" | "normale";
  progress: number;
  statut: string;
}

export const BASE_PROJECTS: BaseProject[] = [
  { key: "wenna", name: "WennaShop", focus: "Checkout · Tracking · Paiements", urgence: "critique", progress: 62, statut: "En cours" },
  { key: "myria", name: "Myria Parfumerie", focus: "Formulaire · Livraison Libreville", urgence: "haute", progress: 35, statut: "En cours" },
  { key: "hexjen", name: "Hexjen Conceptions", focus: "Clients · Automatisation n8n", urgence: "normale", progress: 70, statut: "Actif" },
  { key: "fixi", name: "Fixi", focus: "Navigation RN · Screens", urgence: "normale", progress: 25, statut: "Pause" },
];

export const PROJECT_NAMES: Record<string, string> = {
  wenna: "WennaShop",
  myria: "Myria",
  hexjen: "Hexjen",
  fixi: "Fixi",
  perso: "Perso",
  general: "Général",
};

export const PROJECT_COLORS: Record<
  string,
  "orange" | "teal" | "blue" | "purple" | "amber" | "muted"
> = {
  wenna: "orange",
  myria: "teal",
  hexjen: "blue",
  fixi: "purple",
  perso: "amber",
  general: "muted",
};

export const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const WEEK_DAYS_FULL = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];
export const WEEK_MODES = ["Dev", "Admin", "Dev", "Créa", "Dev", "Bilan", "Repos"];

export interface Outing {
  name: string;
  description: string;
  area: string;
}

export type Mood = "calme" | "social" | "creatif" | "sport" | "explorer" | "manger";

export const OUTINGS_DB: Record<Mood, Record<number, Outing[]>> = {
  calme: {
    0: [
      { name: "Corniche Aïn Diab", description: "Marche en bord de mer. Ressourçant, solo ou avec toi-même.", area: "Aïn Diab" },
      { name: "Forêt de Bouskoura", description: "Marche sous les pins, air pur, silence.", area: "Bouskoura" },
    ],
    1: [{ name: "Café Glacier Maarif", description: "Wifi fiable, thé, ambiance calme. Idéal pour penser.", area: "Maarif" }],
    2: [{ name: "Café du Livre", description: "Coffee shop littéraire, bonne vibe créative.", area: "Gauthier" }],
  },
  social: {
    0: [{ name: "Place Mohammed V", description: "Vie casablancaise authentique. Observer, être dans la ville.", area: "Centre" }],
    1: [{ name: "Marché Rahma", description: "Marché local vivant. Prix bas, vraies interactions.", area: "Maarif" }],
    2: [{ name: "Coworking 9h3", description: "Rencontres avec freelances & entrepreneurs Casa.", area: "Racine" }],
  },
  creatif: {
    0: [
      { name: "Mosquée Hassan II", description: "Architecture monumentale. Inspiration visuelle pure, gratuit.", area: "Centre" },
      { name: "Galeries Maarif", description: "Galeries d'art souvent en accès libre.", area: "Maarif" },
    ],
    1: [{ name: "Villa des Arts", description: "Expos temporaires, tarif réduit.", area: "Palmier" }],
    2: [{ name: "Wonderland Casa", description: "Espace créatif, ateliers, café.", area: "Sidi Belyout" }],
  },
  sport: {
    0: [{ name: "Running Corniche", description: "3–5km le long de l'Atlantique. Gratuit, libère la tête.", area: "Aïn Diab" }],
    1: [{ name: "Foot Hay Mohammadi", description: "Match ouvert, contacts simples.", area: "Hay Mohammadi" }],
  },
  explorer: {
    0: [
      { name: "Ancienne Médina", description: "Ruelles historiques méconnues. Se perdre, observer.", area: "Centre historique" },
      { name: "Port de Casa", description: "Front de mer industriel. Atmosphère unique.", area: "Port" },
    ],
    2: [{ name: "Marché Central", description: "Hall monumental, ambiance locale intense.", area: "Centre" }],
  },
  manger: {
    0: [{ name: "Msemen de quartier", description: "Msemen + thé au coin de rue. Authentique, 10–15 MAD.", area: "Partout" }],
    1: [{ name: "Resto Derb Omar", description: "Tajines, couscous maison à prix d'ami.", area: "Derb Omar" }],
    2: [{ name: "La Sqala", description: "Cuisine marocaine dans un bastion historique.", area: "Centre historique" }],
    3: [{ name: "Rick's Café", description: "Expérience unique, ambiance années 40, cocktails.", area: "Aïn Diab" }],
  },
};

export const MOODS: { key: Mood; label: string }[] = [
  { key: "calme", label: "Calme" },
  { key: "social", label: "Social" },
  { key: "creatif", label: "Créatif" },
  { key: "sport", label: "Sport" },
  { key: "explorer", label: "Explorer" },
  { key: "manger", label: "Manger" },
];

export const BUDGETS = ["0 MAD — Gratuit", "< 50 MAD", "50–150 MAD", "150+ MAD"];

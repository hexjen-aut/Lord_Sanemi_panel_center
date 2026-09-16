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

export type ClientStatus = "contact" | "devis" | "signe" | "livre" | "perdu";

export const CLIENT_STATUSES: { key: ClientStatus; label: string; tone: "muted" | "amber" | "green" | "teal" | "red" }[] = [
  { key: "contact", label: "Contact", tone: "muted" },
  { key: "devis", label: "Devis envoyé", tone: "amber" },
  { key: "signe", label: "Signé", tone: "green" },
  { key: "livre", label: "Livré", tone: "teal" },
  { key: "perdu", label: "Perdu", tone: "red" },
];

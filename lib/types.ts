export type ProjectKey = "wenna" | "myria" | "hexjen" | "fixi" | "perso" | "general";

export interface SanemiTask {
  id: string;
  user_id: string;
  title: string;
  project: ProjectKey;
  priority: "haute" | "moyenne" | "basse";
  day_of_week: number;
  duration: number;
  done: boolean;
  week_number: number;
  year: number;
}

export interface SanemiObjective {
  id: string;
  user_id: string;
  project: ProjectKey;
  title: string;
  deadline: string | null;
  urgence: "critique" | "haute" | "normale";
  progress: number;
  notes: string;
  created_at: string;
}

export interface SanemiTransaction {
  id: string;
  user_id: string;
  type: "revenu" | "depense";
  label: string;
  source?: string;
  amount: number;
  rev_type?: "prevu" | "imprévu";
  category: "besoins" | "projets" | "liberte" | "revenu";
  created_at: string;
}

export interface SanemiIdea {
  id: string;
  user_id: string;
  title: string;
  content: string;
  project: ProjectKey;
  status: "nouvelle" | "en_cours" | "archivée";
  tags: string[];
  image_url: string | null;
  is_starred: boolean;
  created_at: string;
}

export interface SanemiJournalEntry {
  id: string;
  user_id: string;
  date: string;
  humeur: number;
  energie_demain: number;
  realisations: string;
  blocages: string;
  idee_du_jour: string;
  note_libre: string;
}

export interface SanemiReminder {
  id: string;
  user_id: string;
  title: string;
  message: string;
  remind_at: string;
  channel: "email";
  related_project: ProjectKey;
  sent: boolean;
}

export interface SanemiSortiePref {
  id: string;
  user_id: string;
  liked_places: string[];
  updated_at: string;
}

export type SectionId =
  | "planning"
  | "projets"
  | "finance"
  | "idees"
  | "journal"
  | "sorties"
  | "rappels";

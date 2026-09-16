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
  related_order_id: string | null;
  created_at: string;
}

export interface SanemiRecurringCharge {
  id: string;
  user_id: string;
  label: string;
  amount: number;
  day_of_month: number;
  category: "besoins" | "projets" | "liberte";
  active: boolean;
  last_paid_month: string | null;
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
  audio_url: string | null;
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

export interface SanemiClient {
  id: string;
  user_id: string;
  name: string;
  contact: string | null;
  status: "contact" | "devis" | "signe" | "livre" | "perdu";
  estimated_value: number;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FacturationSettings {
  user_id: string;
  business_name: string;
  address: string;
  phone: string;
  email: string;
  updated_at: string;
}

export interface FacturationClient {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  wenna_role: "vendeur" | "chasseur" | null;
  created_at: string;
}

export interface FacturationOrder {
  id: string;
  user_id: string;
  client_id: string;
  doc_type: "devis" | "facture";
  status: "brouillon" | "envoye" | "paye" | "annule";
  transfer_fee: number;
  amount_received: number;
  notes: string | null;
  order_date: string;
  created_at: string;
  updated_at: string;
}

export interface FacturationItem {
  id: string;
  order_id: string;
  label: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export type SectionId =
  | "planning"
  | "projets"
  | "finance"
  | "idees"
  | "journal"
  | "clients"
  | "facturation"
  | "rappels";

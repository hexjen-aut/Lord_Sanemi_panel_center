"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { PROJECT_COLORS, PROJECT_NAMES } from "@/lib/constants";
import type { ProjectKey, SanemiIdea } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "./PlanningSection";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "wenna", label: "WennaShop" },
  { key: "myria", label: "Myria" },
  { key: "hexjen", label: "Hexjen" },
  { key: "fixi", label: "Fixi" },
  { key: "general", label: "Général" },
  { key: "starred", label: "⭐ Favorites" },
];

const PROJECT_OPTIONS: ProjectKey[] = ["general", "wenna", "myria", "hexjen", "fixi"];

export function IdeasSection({ userId }: { userId: string }) {
  const [ideas, setIdeas] = useState<SanemiIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    project: "general" as ProjectKey,
    status: "nouvelle" as SanemiIdea["status"],
    tags: "",
  });

  async function loadIdeas() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sanemi_ideas")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setIdeas(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function toggleStar(id: string, value: boolean) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, is_starred: value } : i)));
    await supabase.from("sanemi_ideas").update({ is_starred: value }).eq("id", id);
  }

  function pickImage(file: File | null) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function saveIdea() {
    if (!form.title.trim()) return;
    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { data: up } = await supabase.storage.from("ideas-images").upload(path, imageFile);
      if (up) {
        const { data: pub } = supabase.storage.from("ideas-images").getPublicUrl(path);
        imageUrl = pub?.publicUrl ?? null;
      }
    }
    await supabase.from("sanemi_ideas").insert({
      title: form.title.trim(),
      content: form.content,
      project: form.project,
      status: form.status,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      image_url: imageUrl,
      is_starred: false,
      user_id: userId,
    });
    await loadIdeas();
    setForm({ title: "", content: "", project: "general", status: "nouvelle", tags: "" });
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(false);
  }

  const filtered = ideas.filter((i) => {
    if (filter === "all") return true;
    if (filter === "starred") return i.is_starred;
    return i.project === filter;
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Idées & Inspirations</div>
          <div className="text-xs text-ink-muted">Capture tout, trie après</div>
        </div>
        <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
          + Idée
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <Empty>Aucune idée capturée</Empty>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => (
            <Card key={i.id} className={i.is_starred ? "border-amber/40 bg-amber/[0.03]" : ""}>
              {i.image_url && (
                <div className="relative mb-2.5 h-32 w-full overflow-hidden rounded-lg">
                  <Image src={i.image_url} alt={i.title} fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="font-display text-sm font-bold">{i.title}</div>
                <button
                  onClick={() => toggleStar(i.id, !i.is_starred)}
                  className={`shrink-0 cursor-pointer px-1 ${i.is_starred ? "text-amber" : "text-ink-dim"}`}
                >
                  {i.is_starred ? "⭐" : "☆"}
                </button>
              </div>
              <div className="mb-2 text-xs leading-relaxed text-ink-muted">{i.content}</div>
              <div className="mb-1.5 flex items-center justify-between">
                <Badge tone={PROJECT_COLORS[i.project]}>{PROJECT_NAMES[i.project]}</Badge>
                <Badge tone={i.status === "nouvelle" ? "orange" : i.status === "en_cours" ? "green" : "muted"}>
                  {i.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {(i.tags || []).map((t) => (
                  <span key={t} className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 text-[10px] text-ink-dim">
                {new Date(i.created_at).toLocaleDateString("fr-FR")}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Capturer une idée"
      >
        <Field label="Titre">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            placeholder="L'idée en une phrase..."
          />
        </Field>
        <Field label="Détail">
          <textarea
            rows={3}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className={inputClass}
            placeholder="Développe, contexte, potentiel..."
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Projet">
            <select
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value as ProjectKey })}
              className={inputClass}
            >
              {PROJECT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PROJECT_NAMES[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as SanemiIdea["status"] })}
              className={inputClass}
            >
              <option value="nouvelle">Nouvelle</option>
              <option value="en_cours">En cours</option>
              <option value="archivée">Archivée</option>
            </select>
          </Field>
        </div>
        <Field label="Tags (virgule)">
          <input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className={inputClass}
            placeholder="UI, mobile, revenu..."
          />
        </Field>
        <Field label="Image (optionnel)">
          <label
            className="block cursor-pointer rounded-lg border border-dashed border-border-strong p-5 text-center text-sm text-ink-muted transition-colors hover:border-orange hover:text-ink"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickImage(e.dataTransfer.files[0] ?? null);
            }}
          >
            {imagePreview ? (
              <div className="relative mx-auto h-28 w-full overflow-hidden rounded-lg">
                <Image src={imagePreview} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : (
              "Clique ou glisse une image ici"
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
        <Button variant="primary" className="w-full" onClick={saveIdea}>
          Capturer ✦
        </Button>
      </Modal>
    </div>
  );
}

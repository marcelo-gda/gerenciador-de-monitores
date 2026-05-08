import { useState, useEffect } from "react";
import { Pencil, Save, X, Plus, Trash2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import MasterSettings from "@/components/MasterSettings";

interface InfoSectionData {
  id: string;
  section_key: string;
  title: string;
  emoji: string;
  content: string;
  sort_order: number;
  visible_to: string[];
}

interface Hierarchy {
  id: string;
  emoji: string;
  name: string;
  slug: string;
}

const toSlug = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const InfoSection = () => {
  const { isAdmin, user } = useAuth();
  const [sections, setSections] = useState<InfoSectionData[]>([]);
  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [userSlugSet, setUserSlugSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    emoji: "",
    content: "",
    visible_to: [] as string[],
  });

  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({
    title: "",
    emoji: "📝",
    content: "",
    visible_to: [] as string[],
  });

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchSections = async () => {
    const { data } = await supabase
      .from("info_sections")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setSections(data as InfoSectionData[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchSections();
    supabase
      .from("hierarchies")
      .select("id, emoji, name, slug")
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setHierarchies(data); });
  }, []);

  // Map user's hierarchy_ids → slugs for visibility filtering
  useEffect(() => {
    if (!user || isAdmin || hierarchies.length === 0) return;
    supabase
      .from("profiles")
      .select("hierarchy_ids")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const ids = (data.hierarchy_ids ?? []) as string[];
        const slugSet = new Set(
          ids
            .map((id) => hierarchies.find((h) => h.id === id)?.slug)
            .filter(Boolean) as string[]
        );
        setUserSlugSet(slugSet);
      });
  }, [user, isAdmin, hierarchies]);

  // ── Visibility ────────────────────────────────────────────────────────────

  const canSee = (s: InfoSectionData) => {
    if (isAdmin) return true;
    if ((s.visible_to ?? []).length === 0) return true;
    return s.visible_to.some((slug) => userSlugSet.has(slug));
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────

  const startEdit = (s: InfoSectionData, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(s.id);
    setEditingId(s.id);
    setEditForm({
      title: s.title,
      emoji: s.emoji,
      content: s.content,
      visible_to: s.visible_to ?? [],
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from("info_sections")
      .update({
        title: editForm.title,
        emoji: editForm.emoji,
        content: editForm.content,
        visible_to: editForm.visible_to,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Painel atualizado!");
      setEditingId(null);
      fetchSections();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este painel?")) return;
    const { error } = await supabase.from("info_sections").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Painel excluído"); fetchSections(); }
  };

  const handleAdd = async () => {
    if (!newForm.title.trim()) { toast.error("Preencha o título"); return; }
    const key = toSlug(newForm.title);
    const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) : 0;
    const { error } = await supabase.from("info_sections").insert({
      section_key: key,
      title: newForm.title,
      emoji: newForm.emoji,
      content: newForm.content,
      sort_order: maxOrder + 1,
      visible_to: newForm.visible_to,
    });
    if (error) toast.error("Erro ao adicionar painel");
    else {
      toast.success("Painel adicionado!");
      setAdding(false);
      setNewForm({ title: "", emoji: "📝", content: "", visible_to: [] });
      fetchSections();
    }
  };

  const toggleSlug = (current: string[], slug: string) =>
    current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border-2 border-border bg-card h-14" />
        ))}
      </div>
    );
  }

  const visibleSections = sections.filter(canSee);

  return (
    <section className="mx-auto max-w-3xl space-y-2.5">
      {visibleSections.map((s) => {
        const isEditing = editingId === s.id;
        const isExpanded = expandedId === s.id;

        return (
          <div
            key={s.id}
            className="rounded-lg border-2 border-border bg-card overflow-hidden"
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center px-4 py-3 gap-2">
              {isEditing ? (
                <>
                  <Input
                    value={editForm.emoji}
                    onChange={(e) => setEditForm({ ...editForm, emoji: e.target.value })}
                    className="w-14 text-center text-xl shrink-0"
                    placeholder="📝"
                  />
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="flex-1"
                    placeholder="Título do painel"
                    autoFocus
                  />
                  <button
                    onClick={cancelEdit}
                    title="Cancelar"
                    className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => saveEdit(s.id)}
                    title="Salvar"
                    className="shrink-0 rounded p-1.5 text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                    className="flex flex-1 items-center gap-2 text-left min-w-0"
                  >
                    <span className="font-display text-base font-bold text-foreground truncate">
                      {s.emoji} {s.title}
                    </span>
                    <ChevronDown
                      className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => startEdit(s, e)}
                      className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Editar painel"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ── Body (always shown when expanded) ──────────────────── */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border/60 space-y-3">
                {isEditing ? (
                  <>
                    <div className="space-y-1.5 pt-3">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Descrição
                      </Label>
                      <Textarea
                        value={editForm.content}
                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                        rows={5}
                        className="font-body text-sm"
                        placeholder="Conteúdo do painel..."
                      />
                    </div>

                    {hierarchies.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Visível para <span className="normal-case font-normal">(vazio = todos os aprovados)</span>
                        </Label>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          {hierarchies.map((h) => (
                            <label key={h.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <Checkbox
                                checked={editForm.visible_to.includes(h.slug)}
                                onCheckedChange={() =>
                                  setEditForm({ ...editForm, visible_to: toggleSlug(editForm.visible_to, h.slug) })
                                }
                              />
                              <span className="text-sm">{h.emoji} {h.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.section_key === "cache" && <MasterSettings readOnly={false} />}

                    <div className="pt-1">
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="flex items-center gap-1 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Excluir painel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-body text-sm leading-relaxed text-card-foreground/80 whitespace-pre-wrap pt-3">
                      {s.content || <span className="italic text-muted-foreground">Sem conteúdo.</span>}
                    </p>
                    {s.section_key === "cache" && <MasterSettings readOnly={true} />}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add panel (admin only) */}
      {isAdmin && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4" /> Adicionar painel
        </button>
      )}

      {isAdmin && adding && (
        <div className="rounded-lg border-2 border-primary bg-card p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={newForm.emoji}
              onChange={(e) => setNewForm({ ...newForm, emoji: e.target.value })}
              className="w-14 text-center text-xl shrink-0"
              placeholder="📝"
            />
            <Input
              value={newForm.title}
              onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
              className="flex-1"
              placeholder="Título do novo painel"
              autoFocus
            />
          </div>
          <Textarea
            value={newForm.content}
            onChange={(e) => setNewForm({ ...newForm, content: e.target.value })}
            rows={5}
            className="font-body text-sm"
            placeholder="Conteúdo do painel..."
          />
          {hierarchies.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Visível para <span className="normal-case font-normal">(vazio = todos)</span>
              </Label>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {hierarchies.map((h) => (
                  <label key={h.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <Checkbox
                      checked={newForm.visible_to.includes(h.slug)}
                      onCheckedChange={() =>
                        setNewForm({ ...newForm, visible_to: toggleSlug(newForm.visible_to, h.slug) })
                      }
                    />
                    <span className="text-sm">{h.emoji} {h.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setAdding(false);
                setNewForm({ title: "", emoji: "📝", content: "", visible_to: [] });
              }}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default InfoSection;

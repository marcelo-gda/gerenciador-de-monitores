import { useState, useEffect } from "react";
import { Pencil, Save, X, Plus, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface InfoSectionData {
  id: string;
  section_key: string;
  title: string;
  emoji: string;
  content: string;
  sort_order: number;
}

const InfoSection = () => {
  const { isAdmin } = useAuth();
  const [sections, setSections] = useState<InfoSectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", emoji: "", content: "" });
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", emoji: "📝", content: "", section_key: "" });

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
  }, []);

  const startEdit = (s: InfoSectionData) => {
    setEditingId(s.id);
    setEditForm({ title: s.title, emoji: s.emoji, content: s.content });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from("info_sections")
      .update({ title: editForm.title, emoji: editForm.emoji, content: editForm.content, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Seção atualizada!");
      setEditingId(null);
      fetchSections();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta seção?")) return;
    const { error } = await supabase.from("info_sections").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Seção excluída"); fetchSections(); }
  };

  const handleAdd = async () => {
    if (!newForm.title.trim() || !newForm.content.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    const key = newForm.section_key.trim() || newForm.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sort_order)) : 0;
    const { error } = await supabase.from("info_sections").insert({
      section_key: key,
      title: newForm.title,
      emoji: newForm.emoji,
      content: newForm.content,
      sort_order: maxOrder + 1,
    });
    if (error) toast.error("Erro ao adicionar seção");
    else {
      toast.success("Seção adicionada!");
      setAdding(false);
      setNewForm({ title: "", emoji: "📝", content: "", section_key: "" });
      fetchSections();
    }
  };

  if (loading) return <p className="text-center text-muted-foreground">Carregando...</p>;

  return (
    <section className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-2xl font-bold text-foreground sm:text-3xl">
        📋 Informações Gerais
      </h2>

      <Accordion type="multiple" className="space-y-3">
        {sections.map((s) => (
          <AccordionItem key={s.id} value={s.section_key} className="rounded-lg border-2 border-border bg-card px-4 overflow-hidden">
            {editingId === s.id ? (
              <div className="py-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={editForm.emoji}
                    onChange={(e) => setEditForm({ ...editForm, emoji: e.target.value })}
                    className="w-16 text-center text-lg"
                    placeholder="🎭"
                  />
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="flex-1"
                    placeholder="Título da seção"
                  />
                </div>
                <Textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  rows={12}
                  className="font-body text-sm"
                  placeholder="Conteúdo da seção..."
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={cancelEdit} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button onClick={() => saveEdit(s.id)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <Save className="h-3.5 w-3.5" /> Salvar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <AccordionTrigger className="font-display text-lg font-bold hover:no-underline">
                  <span className="flex items-center gap-2 flex-1">
                    {s.emoji} {s.title}
                    {isAdmin && (
                      <span className="ml-auto flex gap-1 mr-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="prose prose-sm max-w-none text-card-foreground/80 font-body whitespace-pre-wrap">
                  {s.content}
                </AccordionContent>
              </>
            )}
          </AccordionItem>
        ))}
      </Accordion>

      {isAdmin && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4" /> Adicionar nova seção
        </button>
      )}

      {isAdmin && adding && (
        <div className="mt-4 rounded-lg border-2 border-primary bg-card p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={newForm.emoji}
              onChange={(e) => setNewForm({ ...newForm, emoji: e.target.value })}
              className="w-16 text-center text-lg"
              placeholder="📝"
            />
            <Input
              value={newForm.title}
              onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
              className="flex-1"
              placeholder="Título da nova seção"
            />
          </div>
          <Textarea
            value={newForm.content}
            onChange={(e) => setNewForm({ ...newForm, content: e.target.value })}
            rows={8}
            className="font-body text-sm"
            placeholder="Conteúdo da seção..."
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewForm({ title: "", emoji: "📝", content: "", section_key: "" }); }} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
            <button onClick={handleAdd} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default InfoSection;

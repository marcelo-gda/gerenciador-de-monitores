import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type TableName = "hierarchies" | "roles";

interface Item {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

interface FormData {
  emoji: string;
  name: string;
  description: string;
}

const EMPTY_FORM: FormData = { emoji: "", name: "", description: "" };

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

// ─── Reusable section (shared for Hierarchies and Roles) ───────────────────

interface SectionProps {
  title: string;
  subtitle: string;
  tableName: TableName;
  createLabel: string;
  isAdmin: boolean;
}

const ManageableSection = ({
  title,
  subtitle,
  tableName,
  createLabel,
  isAdmin,
}: SectionProps) => {
  const qc = useQueryClient();
  const queryKey = [tableName];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Item[];
    },
  });

  // ── Save (create or update) ────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({
      item,
      data,
    }: {
      item: Item | null;
      data: FormData;
    }) => {
      if (item) {
        const { error } = await supabase
          .from(tableName)
          .update({
            emoji: data.emoji,
            name: data.name,
            description: data.description,
          })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const maxOrder =
          items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : 0;
        const { error } = await supabase.from(tableName).insert({
          emoji: data.emoji,
          name: data.name,
          slug: toSlug(data.name),
          description: data.description,
          sort_order: maxOrder + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, { item }) => {
      toast.success(item ? "Atualizado com sucesso!" : "Criado com sucesso!");
      qc.invalidateQueries({ queryKey });
      setDialogOpen(false);
    },
    onError: (err) => {
      console.error(`[${tableName}] save error:`, err);
      toast.error("Erro ao salvar. Tente novamente.");
    },
  });

  // ── Delete ─────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Excluído com sucesso!");
      qc.invalidateQueries({ queryKey });
      setDeleteId(null);
    },
    onError: (err) => {
      console.error(`[${tableName}] delete error:`, err);
      toast.error("Erro ao excluir.");
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setForm({ emoji: item.emoji, name: item.name, description: item.description });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("O título é obrigatório");
      return;
    }
    saveMutation.mutate({ item: editingItem, data: form });
  };

  const dialogTitle = editingItem
    ? `Editar ${title.replace(/\p{Emoji}/gu, "").trim()}`
    : createLabel;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <h2 className="font-display text-xl font-bold text-foreground whitespace-nowrap">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <p className="text-sm text-muted-foreground text-center -mt-1">{subtitle}</p>

      {/* Cards */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border-2 border-border bg-card p-4 h-20"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-lg border-2 border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-2xl leading-none">
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-display text-base font-bold text-foreground">
                    {item.name}
                  </p>
                  <p className="font-body text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(item)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add button — admin only */}
      {isAdmin && (
        <button
          type="button"
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          {createLabel}
        </button>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${tableName}-emoji`}>Emoji</Label>
              <Input
                id={`${tableName}-emoji`}
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                placeholder="Cole ou digite o emoji"
                className="text-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${tableName}-name`}>Título</Label>
              <Input
                id={`${tableName}-name`}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Monitor Pleno"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${tableName}-desc`}>Descrição</Label>
              <Textarea
                id={`${tableName}-desc`}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descreva as responsabilidades e características..."
                rows={4}
                className="resize-none font-body text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── Page component ────────────────────────────────────────────────────────

const FuncoesSection = () => {
  const { isAdmin } = useAuth();

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <ManageableSection
        title="🏅 Hierarquias"
        subtitle="Níveis de experiência dos monitores, do iniciante ao líder."
        tableName="hierarchies"
        createLabel="Nova Hierarquia"
        isAdmin={isAdmin}
      />
      <ManageableSection
        title="⭐ Funções Especiais"
        subtitle="Responsabilidades extras que podem ser exercidas durante os eventos."
        tableName="roles"
        createLabel="Nova Função Especial"
        isAdmin={isAdmin}
      />
    </section>
  );
};

export default FuncoesSection;

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Category = "gda" | "gdc";
type TableName = "gdc_hierarchies" | "gdc_roles";

interface GdcItem {
  id: string;
  category: Category;
  emoji: string;
  name: string;
  slug: string;
  description: string | null;
  hours_per_day: number | null;
  value_per_day: number | null;
  sort_order: number;
}

interface FormData {
  emoji: string;
  name: string;
  description: string;
  hours_per_day: string;
  value_per_day: string;
}

const EMPTY_FORM: FormData = { emoji: "⭐", name: "", description: "", hours_per_day: "", value_per_day: "" };

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

interface ListProps {
  title: string;
  tableName: TableName;
  category: Category;
  createLabel: string;
  isAdmin: boolean;
}

const GdcList = ({ title, tableName, category, createLabel, isAdmin }: ListProps) => {
  const qc = useQueryClient();
  const queryKey = [tableName, category];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GdcItem | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("category", category)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as GdcItem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ item, data }: { item: GdcItem | null; data: FormData }) => {
      const payload = {
        emoji: data.emoji || "⭐",
        name: data.name.trim(),
        description: data.description.trim() || null,
        hours_per_day: data.hours_per_day ? parseFloat(data.hours_per_day) : null,
        value_per_day: data.value_per_day ? parseFloat(data.value_per_day) : null,
      };
      if (item) {
        const { error } = await supabase.from(tableName).update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : 0;
        const { error } = await supabase.from(tableName).insert({
          ...payload,
          category,
          slug: toSlug(data.name),
          sort_order: maxOrder + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, { item }) => {
      toast.success(item ? "Atualizado!" : "Criado!");
      qc.invalidateQueries({ queryKey });
      setDialogOpen(false);
    },
    onError: (err) => {
      console.error(`[${tableName}] save error:`, err);
      toast.error("Erro ao salvar. Tente novamente.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Excluído!");
      qc.invalidateQueries({ queryKey });
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: GdcItem) => {
    setEditingItem(item);
    setForm({
      emoji: item.emoji,
      name: item.name,
      description: item.description ?? "",
      hours_per_day: item.hours_per_day != null ? String(item.hours_per_day) : "",
      value_per_day: item.value_per_day != null ? String(item.value_per_day) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }
    saveMutation.mutate({ item: editingItem, data: form });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1.5 text-left group"
        >
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          />
          <h3 className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
        </button>
        {isAdmin && !collapsed && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> {createLabel}
          </button>
        )}
      </div>

      {!collapsed && isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border-2 border-border bg-card h-16" />
          ))}
        </div>
      ) : !collapsed && items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum item cadastrado ainda.</p>
      ) : !collapsed ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="group relative rounded-lg border-2 border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-xl leading-none">{item.emoji}</span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-display text-sm font-bold text-foreground">{item.name}</p>
                  {item.description && (
                    <p className="font-body text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {item.value_per_day != null && (
                      <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        R$ {item.value_per_day.toFixed(2)}/dia
                      </span>
                    )}
                    {item.hours_per_day != null && (
                      <span className="inline-flex items-center rounded-full border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-xs font-semibold text-secondary">
                        {item.hours_per_day}h/dia
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(item)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingItem ? "Editar" : createLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <div className="space-y-1.5">
                <Label>Emoji</Label>
                <Input
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  className="w-16 text-center text-xl"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Médico"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="resize-none font-body text-sm"
                placeholder="Descreva as responsabilidades..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tempo/dia (horas)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.hours_per_day}
                  onChange={(e) => setForm({ ...form, hours_per_day: e.target.value })}
                  placeholder="Ex: 10"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor/dia (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.value_per_day}
                  onChange={(e) => setForm({ ...form, value_per_day: e.target.value })}
                  placeholder="Ex: 250,00"
                />
              </div>
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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

interface GdcRatesManagerProps {
  isAdmin: boolean;
  category: Category;
}

const GdcRatesManager = ({ isAdmin, category }: GdcRatesManagerProps) => {
  return (
    <div className="rounded-xl border-2 border-border bg-card overflow-hidden">
      <div className="p-4 space-y-5">
        <GdcList title="🏅 Cargos" tableName="gdc_hierarchies" category={category} createLabel="Novo Cargo" isAdmin={isAdmin} />
        <GdcList title="⭐ Funções" tableName="gdc_roles" category={category} createLabel="Nova Função" isAdmin={isAdmin} />
      </div>
    </div>
  );
};

export default GdcRatesManager;

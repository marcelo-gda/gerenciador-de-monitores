import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type MonitorLevel = "mestre" | "pleno" | "junior" | "trainee";

interface Hierarchy {
  id: string;
  emoji: string;
  name: string;
  slug: MonitorLevel;
  sort_order: number;
}

const levelColors: Record<string, string> = {
  mestre: "bg-secondary/20 text-secondary border-secondary/30",
  pleno: "bg-primary/20 text-primary border-primary/30",
  junior: "bg-camp/20 text-camp border-camp/30",
  trainee: "bg-muted text-muted-foreground border-border",
};

interface Monitor {
  id: string;
  user_id: string;
  display_name: string;
  is_confirmed?: boolean;
  level?: string | null;
}

interface Props {
  eventId: string;
  eventTitle: string;
  monitors: Monitor[];
  onClose: () => void;
  onFinalized: () => void;
}

const FinalizeScaleDialog = ({ eventId, eventTitle, monitors, onClose, onFinalized }: Props) => {
  const { user } = useAuth();
  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [saving, setSaving] = useState(false);

  // Quais monitores estão selecionados para escalar
  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(monitors.filter((m) => m.is_confirmed).map((m) => m.user_id));
  });

  // Cargos de cada monitor
  const [levels, setLevels] = useState<Record<string, MonitorLevel>>(() => {
    const initial: Record<string, MonitorLevel> = {};
    monitors.forEach((m) => {
      if (m.level) initial[m.user_id] = m.level as MonitorLevel;
    });
    return initial;
  });

  useEffect(() => {
    supabase
      .from("hierarchies")
      .select("id, emoji, name, slug, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setHierarchies(data as Hierarchy[]);
      });
  }, []);

  const toggleMonitor = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectedMonitors = monitors.filter((m) => selected.has(m.user_id));

  const handleFinalize = async () => {
    const missingLevel = selectedMonitors.some((m) => !levels[m.user_id]);
    if (missingLevel) {
      toast.error("Defina o cargo de todos os monitores escalados");
      return;
    }
    if (selectedMonitors.length === 0) {
      toast.error("Selecione ao menos um monitor para escalar");
      return;
    }

    setSaving(true);

    // Reseta is_confirmed de todos os monitores do evento
    await supabase
      .from("event_monitors")
      .update({ is_confirmed: false })
      .eq("event_id", eventId);

    // Confirma e salva cargo dos selecionados
    for (const m of selectedMonitors) {
      await supabase
        .from("event_monitors")
        .update({ is_confirmed: true, level: levels[m.user_id] })
        .eq("event_id", eventId)
        .eq("user_id", m.user_id);
    }

    // Trava o evento
    await supabase.from("events").update({ is_locked: true }).eq("id", eventId);

    // Notifica os escalados
    if (user) {
      const hierarchyLabel = (slug: string) => {
        const h = hierarchies.find((h) => h.slug === slug);
        return h ? `${h.emoji} ${h.name}` : slug;
      };
      const notifications = selectedMonitors.map((m) => ({
        sender_id: user.id,
        recipient_id: m.user_id,
        content: `✅ Você foi escalado(a) para "${eventTitle}" como ${hierarchyLabel(levels[m.user_id])}! Confira os detalhes na escala.`,
      }));
      await supabase.from("messages").insert(notifications);
    }

    toast.success("Escala finalizada com sucesso!");
    setSaving(false);
    onFinalized();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-lg border-2 border-border bg-card shadow-xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display text-lg font-bold text-foreground">
            <CheckCircle2 className="mr-1 inline h-5 w-5 text-camp" />
            Finalizar Escala
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Subheader */}
        <div className="px-5 pt-3 pb-2">
          <p className="text-sm text-muted-foreground">
            Selecione os monitores escalados para <strong>{eventTitle}</strong> e defina os cargos.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedMonitors.length} de {monitors.length} selecionados
          </p>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2">
          {monitors.map((m) => {
            const isSelected = selected.has(m.user_id);
            return (
              <div
                key={m.user_id}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 transition-all cursor-pointer ${
                  isSelected
                    ? "border-camp bg-camp/10"
                    : "border-border bg-background hover:border-border/80"
                }`}
                onClick={() => toggleMonitor(m.user_id)}
              >
                {isSelected ? (
                  <CheckCircle2 className="h-5 w-5 text-camp shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                )}
                <span className={`text-sm font-medium flex-1 min-w-0 truncate ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                  {m.display_name}
                </span>
                {isSelected && (
                  <select
                    value={levels[m.user_id] || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setLevels({ ...levels, [m.user_id]: e.target.value as MonitorLevel });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold outline-none border ${
                      levels[m.user_id]
                        ? levelColors[levels[m.user_id]]
                        : "border-destructive/50 bg-destructive/5 text-destructive"
                    }`}
                  >
                    <option value="">Cargo...</option>
                    {hierarchies.map((h) => (
                      <option key={h.id} value={h.slug}>
                        {h.emoji} {h.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border p-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleFinalize}
            disabled={saving || selectedMonitors.length === 0}
            className="flex-1 rounded-lg bg-camp px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : `Escalar ${selectedMonitors.length > 0 ? `(${selectedMonitors.length})` : ""}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FinalizeScaleDialog;

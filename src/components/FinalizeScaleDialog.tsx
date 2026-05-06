import { useState } from "react";
import { motion } from "framer-motion";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type MonitorLevel = "mestre" | "pleno" | "junior" | "trainee";

const levelLabels: Record<string, string> = {
  mestre: "Mestre",
  pleno: "Pleno",
  junior: "Junior",
  trainee: "Trainee",
};

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
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<Record<string, MonitorLevel>>(() => {
    const initial: Record<string, MonitorLevel> = {};
    monitors.forEach((m) => {
      if (m.is_confirmed && m.level) initial[m.user_id] = m.level as MonitorLevel;
    });
    return initial;
  });

  const confirmedMonitors = monitors.filter((m) => m.is_confirmed);
  const unselectedMonitors = monitors.filter((m) => !m.is_confirmed);

  const handleFinalize = async () => {
    const missingLevel = confirmedMonitors.some((m) => !levels[m.user_id]);
    if (missingLevel) {
      toast.error("Defina o cargo de todos os monitores escalados");
      return;
    }

    setSaving(true);

    for (const m of confirmedMonitors) {
      await supabase
        .from("event_monitors")
        .update({ level: levels[m.user_id] })
        .eq("event_id", eventId)
        .eq("user_id", m.user_id);
    }

    await supabase
      .from("events")
      .update({ is_locked: true })
      .eq("id", eventId);

    // Send notification to confirmed monitors
    if (user) {
      const notifications = confirmedMonitors.map((m) => ({
        sender_id: user.id,
        recipient_id: m.user_id,
        content: `✅ Você foi escalado(a) para "${eventTitle}" como ${levelLabels[levels[m.user_id]] || levels[m.user_id]}! Confira os detalhes na escala.`,
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
        className="w-full max-w-md rounded-lg border-2 border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">
            <CheckCircle2 className="mr-1 inline h-5 w-5 text-camp" />
            Finalizar Escala
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          Deseja escalar esses monitores para <strong>{eventTitle}</strong>?
        </p>

        {confirmedMonitors.length === 0 ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              Nenhum monitor pré-selecionado. Volte e marque os monitores antes de finalizar.
            </p>
          </div>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto mb-4">
            <p className="text-xs font-semibold text-camp mb-1">✅ Escalados ({confirmedMonitors.length}):</p>
            {confirmedMonitors.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-2 rounded-lg border-2 border-camp bg-camp/10 p-3"
              >
                <CheckCircle2 className="h-4 w-4 text-camp shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1">{m.display_name}</span>
                <select
                  value={levels[m.user_id] || ""}
                  onChange={(e) => setLevels({ ...levels, [m.user_id]: e.target.value as MonitorLevel })}
                  className={`rounded-full px-2 py-1 text-xs font-semibold outline-none border ${
                    levels[m.user_id] ? levelColors[levels[m.user_id]] : "border-destructive/50 bg-destructive/5 text-destructive"
                  }`}
                >
                  <option value="">Cargo...</option>
                  <option value="mestre">Mestre</option>
                  <option value="pleno">Pleno</option>
                  <option value="junior">Junior</option>
                  <option value="trainee">Trainee</option>
                </select>
              </div>
            ))}

            {unselectedMonitors.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground mt-3 mb-1">Não escalados ({unselectedMonitors.length}):</p>
                {unselectedMonitors.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-3 rounded-lg border-2 border-border bg-background p-3 opacity-50"
                  >
                    <span className="text-sm font-medium text-foreground">{m.display_name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleFinalize}
            disabled={saving || confirmedMonitors.length === 0}
            className="flex-1 rounded-lg bg-camp px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar e Finalizar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FinalizeScaleDialog;

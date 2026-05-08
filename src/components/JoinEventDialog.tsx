import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SpecialRole {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  description: string;
}

interface Props {
  eventId: string;
  eventTitle: string;
  eventEmoji: string;
  onClose: () => void;
  onJoined: () => void;
}

const JoinEventDialog = ({ eventId, eventTitle, eventEmoji, onClose, onJoined }: Props) => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<SpecialRole[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    supabase
      .from("roles")
      .select("id, emoji, name, slug, description")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setRoles(data);
      });
  }, []);

  const toggleTag = (slug: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const handleJoin = async () => {
    if (!user) return;
    setJoining(true);
    const { error } = await supabase.from("event_monitors").insert({
      event_id: eventId,
      user_id: user.id,
      bonus_tags: Array.from(selectedTags),
    });
    if (error) {
      toast.error("Erro ao entrar na escala");
    } else {
      toast.success("Você entrou na escala!");
      onJoined();
      onClose();
    }
    setJoining(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-lg border-2 border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">
            {eventEmoji} Entrar na Escala
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          Confirmar entrada em <strong>{eventTitle}</strong>?
        </p>

        {roles.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-foreground mb-2">Funções especiais (opcional):</p>
            <div className="space-y-1.5">
              {roles.map((r) => {
                const active = selectedTags.has(r.slug);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleTag(r.slug)}
                    className={`w-full flex items-center gap-2 rounded-lg border-2 p-2.5 text-left text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <span className="text-base shrink-0">{r.emoji}</span>
                    <span className="font-semibold">{r.name}</span>
                    <span className="ml-auto text-xs opacity-70 text-right leading-tight max-w-[120px] truncate">
                      {r.description}
                    </span>
                  </button>
                );
              })}
            </div>
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
            onClick={handleJoin}
            disabled={joining}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {joining ? "Entrando..." : "Confirmar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default JoinEventDialog;

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type BonusTag = "protagonista" | "midia" | "cronista";

const bonusOptions: { value: BonusTag; emoji: string; label: string; desc: string }[] = [
  { value: "protagonista", emoji: "🅿️", label: "Protagonista", desc: "+10% mensal" },
  { value: "midia", emoji: "🎥", label: "Mídia", desc: "Valor do Júnior" },
  { value: "cronista", emoji: "📜", label: "Cronista", desc: "+R$15 por festa" },
];

interface Props {
  eventId: string;
  eventTitle: string;
  eventEmoji: string;
  onClose: () => void;
  onJoined: () => void;
}

const JoinEventDialog = ({ eventId, eventTitle, eventEmoji, onClose, onJoined }: Props) => {
  const { user } = useAuth();
  const [selectedTags, setSelectedTags] = useState<Set<BonusTag>>(new Set());
  const [joining, setJoining] = useState(false);

  const toggleTag = (tag: BonusTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
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

        <div className="mb-4">
          <p className="text-xs font-semibold text-foreground mb-2">Bônus (opcional):</p>
          <div className="space-y-1.5">
            {bonusOptions.map((b) => {
              const active = selectedTags.has(b.value);
              return (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => toggleTag(b.value)}
                  className={`w-full flex items-center gap-2 rounded-lg border-2 p-2.5 text-left text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <span className="text-base">{b.emoji}</span>
                  <span className="font-semibold">{b.label}</span>
                  <span className="ml-auto text-xs opacity-70">{b.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

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

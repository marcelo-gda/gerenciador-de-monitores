import { useState } from "react";
import { X, Clock, MapPin, Users, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JoinEventDialog from "@/components/JoinEventDialog";

interface Monitor {
  id: string;
  user_id: string;
  display_name: string;
  is_confirmed?: boolean;
  level?: string | null;
  bonus_tags?: string[];
}

interface EventData {
  id: string;
  emoji: string;
  type: string;
  title: string;
  event_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  address: string;
  total_slots: number | null;
  is_locked: boolean;
  is_paid?: boolean;
  created_by: string | null;
  team?: number | null;
  monitors: Monitor[];
}

interface CalendarEventModalProps {
  event: EventData;
  onClose: () => void;
  onRefresh: () => void;
}

const levelLabels: Record<string, string> = {
  mestre: "Mestre",
  pleno: "Pleno",
  junior: "Junior",
  trainee: "Trainee",
};

const typeLabels: Record<string, string> = {
  sun: "☀️ Tarde",
  moon: "🌙 Noite",
  camp: "⛺ Acampamento",
};

const typeBadge: Record<string, string> = {
  sun: "bg-sun/20 text-sun border-sun/30",
  moon: "bg-moon/20 text-moon border-moon/30",
  camp: "bg-camp/20 text-camp border-camp/30",
};

const CalendarEventModal = ({ event, onClose, onRefresh }: CalendarEventModalProps) => {
  const { user, isApproved } = useAuth();
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const todayLocal = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );
  const [ey, em, ed] = (event.end_date || event.event_date).split("-").map(Number);
  const isPastEvent = new Date(ey, em - 1, ed) < todayLocal;
  const [eventYear, eventMonth, eventDay] = event.event_date.split("-").map(Number);
  const eventDateLocal = new Date(eventYear, eventMonth - 1, eventDay);
  const diffDays = Math.ceil(
    (eventDateLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isComingSoon = !isPastEvent && diffDays > 30;

  const monitorCount = event.monitors.length;
  const isFull = event.total_slots ? monitorCount >= event.total_slots : false;
  const isUserInEvent = event.monitors.some((m) => m.user_id === user?.id);
  const isFinalized = event.is_locked && event.monitors.some((m) => m.is_confirmed);

  const canJoin =
    isApproved && !event.is_locked && !isFull && !isUserInEvent && !isPastEvent && !isComingSoon;
  const canLeave =
    isApproved && !event.is_locked && isUserInEvent && !isPastEvent && !isComingSoon;

  const handleLeave = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("event_monitors")
      .delete()
      .eq("event_id", event.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao sair da escala");
    } else {
      toast.success("Você saiu da escala");
      onRefresh();
    }
  };

  const fmtDate = (dateStr: string) =>
    new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const confirmedMonitors = event.monitors.filter((m) => m.is_confirmed);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 px-3 pb-3 sm:pb-0"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-xl border-2 border-border bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-card-foreground leading-tight">
                {event.emoji} {event.title}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    typeBadge[event.type] || "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {typeLabels[event.type] || event.type}
                </span>
                {isFinalized && (
                  <span className="flex items-center gap-1 rounded-full bg-camp/20 px-2 py-0.5 text-xs font-semibold text-camp">
                    <CheckCircle2 className="h-3 w-3" /> Escalada
                  </span>
                )}
                {event.is_paid === false && (
                  <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-semibold text-secondary">
                    🤝 Voluntário
                  </span>
                )}
                {event.team && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {event.team === 1 ? "1️⃣" : "2️⃣"} Equipe {event.team}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-muted-foreground">
              <span className="mt-0.5 shrink-0">📅</span>
              <div>
                <div className="capitalize">{fmtDate(event.event_date)}</div>
                {event.end_date && event.end_date !== event.event_date && (
                  <div>até {fmtDate(event.end_date)}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {event.start_time} — {event.end_time}
              </span>
            </div>
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{event.address}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>
                {monitorCount}
                {event.total_slots ? ` / ${event.total_slots}` : ""} monitor
                {monitorCount !== 1 ? "es" : ""}
                {isFull && (
                  <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    Lotado
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Monitors */}
          {event.monitors.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isFinalized ? "✅ Escalados" : "Inscritos"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(isFinalized ? confirmedMonitors : event.monitors).map((m) => (
                  <span
                    key={m.id}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      isFinalized
                        ? "border-camp/40 bg-camp/10 text-camp"
                        : "border-border bg-muted/50 text-foreground"
                    }`}
                  >
                    {m.display_name}
                    {m.level && ` · ${levelLabels[m.level] || m.level}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex gap-2">
            {canJoin && (
              <button
                onClick={() => setShowJoinDialog(true)}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                + Entrar na escala
              </button>
            )}
            {canLeave && (
              <button
                onClick={handleLeave}
                className="flex-1 rounded-lg border border-destructive/30 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
              >
                Sair da escala
              </button>
            )}
            {!canJoin && !canLeave && (
              <p className="flex-1 text-center text-xs text-muted-foreground py-2">
                {isPastEvent
                  ? "Evento encerrado"
                  : isComingSoon
                  ? `⏳ Inscrições abrem em ${diffDays - 30} dia${diffDays - 30 !== 1 ? "s" : ""}`
                  : event.is_locked
                  ? "Escala encerrada"
                  : isUserInEvent
                  ? "Você já está inscrito"
                  : isFull
                  ? "Vagas esgotadas"
                  : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {showJoinDialog && (
        <JoinEventDialog
          eventId={event.id}
          eventTitle={event.title}
          eventEmoji={event.emoji}
          onClose={() => setShowJoinDialog(false)}
          onJoined={() => {
            onRefresh();
          }}
        />
      )}
    </>
  );
};

export default CalendarEventModal;

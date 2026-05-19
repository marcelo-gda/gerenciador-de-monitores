import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Plus, X, Users, Lock, Copy, Trash2, CheckCircle2, ClipboardCheck, Pencil, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FinalizeScaleDialog from "@/components/FinalizeScaleDialog";
import JoinEventDialog from "@/components/JoinEventDialog";
import RejectMonitorDialog from "@/components/RejectMonitorDialog";
import EditEventModal from "@/components/EditEventModal";
import CalendarEventModal from "@/components/CalendarEventModal";
import MonitorProfileModal from "@/components/MonitorProfileModal";

const levelLabels: Record<string, string> = {
  mestre: "Mestre",
  pleno: "Pleno",
  junior: "Junior",
  trainee: "Trainee",
};

const levelColors: Record<string, string> = {
  mestre: "bg-secondary/20 text-secondary",
  pleno: "bg-primary/20 text-primary",
  junior: "bg-camp/20 text-camp",
  trainee: "bg-muted text-muted-foreground",
};

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
  is_deleted?: boolean;
  is_paid?: boolean;
  force_available?: boolean;
  created_by: string | null;
  team?: number | null;
  custom_rates?: Record<string, number> | null;
  observations?: string | null;
  monitors: Monitor[];
}

interface EventCardProps {
  event: EventData;
  onRefresh: () => void;
}

const typeStyles: Record<string, string> = {
  sun: "bg-sun-bg border-sun/30",
  moon: "bg-moon-bg border-moon/30",
  camp: "bg-camp-bg border-camp/30",
};

const badgeStyles: Record<string, string> = {
  sun: "bg-sun/20 text-sun",
  moon: "bg-moon/20 text-moon",
  camp: "bg-camp/20 text-camp",
};

function isGreenEvent(title: string): boolean {
  return /acampamento|gdc/i.test(title);
}

function getCardStyle(title: string, type: string): string {
  if (isGreenEvent(title)) return "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800";
  return typeStyles[type] || "bg-card border-border";
}

function getBadgeStyle(title: string, type: string): string {
  if (isGreenEvent(title)) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  return badgeStyles[type] || "";
}

const EventCard = ({ event, onRefresh }: EventCardProps) => {
  const { user, isAdmin } = useAuth();
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rejectingMonitor, setRejectingMonitor] = useState<{ userId: string; name: string } | null>(null);
  const [viewingMonitorId, setViewingMonitorId] = useState<string | null>(null);
  const [localMonitors, setLocalMonitors] = useState(event.monitors);
  const [preSelected, setPreSelected] = useState<Set<string>>(() => {
    return new Set(event.monitors.filter((m) => m.is_confirmed).map((m) => m.user_id));
  });

  useEffect(() => {
    setLocalMonitors(event.monitors);
  }, [event.monitors]);

  const monitorCount = localMonitors.length;
  const isUserInEvent = localMonitors.some((m) => m.user_id === user?.id);
  const todayLocal = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const [ey, em, ed] = (event.end_date || event.event_date).split("-").map(Number);
  const isPastEvent = new Date(ey, em - 1, ed) < todayLocal;
  const [eventYear, eventMonth, eventDay] = event.event_date.split("-").map(Number);
  const eventDateLocal = new Date(eventYear, eventMonth - 1, eventDay);
  const diffDays = Math.ceil((eventDateLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));
  const isComingSoon = !isPastEvent && diffDays > 30 && !event.force_available;

  const canJoin = !!user && !event.is_locked && !isUserInEvent && !isPastEvent && !isComingSoon;
  const canLeave = !!user && !event.is_locked && isUserInEvent && !isPastEvent && !isComingSoon;
  const hasConfirmed = localMonitors.some((m) => m.is_confirmed);
  const isFinalized = event.is_locked && hasConfirmed;

  const togglePreSelect = async (userId: string) => {
    const next = new Set(preSelected);
    const newValue = !next.has(userId);
    if (newValue) next.add(userId); else next.delete(userId);
    setPreSelected(next);
    await supabase.from("event_monitors").update({ is_confirmed: newValue }).eq("event_id", event.id).eq("user_id", userId);
    setLocalMonitors(prev =>
      prev.map(m => m.user_id === userId ? { ...m, is_confirmed: newValue } : m)
    );
  };

  const handleJoin = () => {
    setShowJoinDialog(true);
  };

  const handleLeave = async () => {
    if (!user) return;
    const { error } = await supabase.from("event_monitors").delete().eq("event_id", event.id).eq("user_id", user.id);
    if (error) toast.error("Erro ao sair da escala");
    else { toast.success("Você saiu da escala"); onRefresh(); }
  };

  const handleToggleLock = async () => {
    const { error } = await supabase.from("events").update({ is_locked: !event.is_locked }).eq("id", event.id);
    if (error) toast.error("Erro ao alterar status");
    else { toast.success(event.is_locked ? "Escala desbloqueada" : "Escala encerrada"); onRefresh(); }
  };

  const handleSoftDelete = async () => {
    if (!confirm("Mover este evento para a lixeira?")) return;
    const { data, error } = await supabase.from("events").update({ is_deleted: true }).eq("id", event.id).select("id");
    if (error || !data?.length) toast.error("Erro ao arquivar evento");
    else { toast.success("Evento movido para a lixeira"); onRefresh(); }
  };

  const handleRestore = async () => {
    const { data, error } = await supabase.from("events").update({ is_deleted: false }).eq("id", event.id).select("id");
    if (error || !data?.length) toast.error("Erro ao restaurar evento");
    else { toast.success("Evento restaurado!"); onRefresh(); }
  };

  const handlePermanentDelete = async () => {
    if (!confirm("Deletar permanentemente? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) toast.error("Erro ao deletar evento");
    else { toast.success("Evento deletado permanentemente"); onRefresh(); }
  };

  const handleCopyWhatsApp = () => {
    const confirmed = localMonitors.filter((m) => m.is_confirmed);
    const list = confirmed.length > 0 ? confirmed : localMonitors;
    const lines = [
      `${event.emoji} ${event.title} - ${event.event_date} ${event.start_time} | ${event.end_time}`,
      "", event.address, "",
      ...(isFinalized ? ["✅ *Monitores Escalados:*", ""] : []),
      ...list.map((m, i) => `${i + 1}. ${m.display_name}${m.level ? ` (${levelLabels[m.level] || m.level})` : ""}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copiado para a área de transferência!");
  };

  const emptySlots = event.total_slots ? Math.max(0, event.total_slots - monitorCount) : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`relative rounded-lg border-2 p-3 sm:p-5 ${getCardStyle(event.title, event.type)} transition-shadow hover:shadow-md ${
          isPastEvent ? "opacity-50" : ""
        } ${isFinalized ? "ring-2 ring-camp/40" : event.is_locked ? "ring-2 ring-destructive/30" : ""}`}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => setShowDetailModal(true)}
              className="text-left w-full hover:underline"
            >
              <h3 className="font-display text-base sm:text-lg font-bold leading-tight text-foreground md:text-xl">
                <span className="mr-1">{event.emoji}</span>
                {event.title}
                {isComingSoon && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-semibold text-secondary">
                    🕐 Em breve
                  </span>
                )}
                {event.force_available && diffDays > 30 && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                    🔓 Inscrições abertas
                  </span>
                )}
                {isFinalized && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-camp/20 px-2 py-0.5 text-xs font-semibold text-camp">
                    <CheckCircle2 className="h-3 w-3" /> ESCALADA
                  </span>
                )}
                {event.is_paid === false && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-semibold text-secondary">
                    🤝 Voluntário
                  </span>
                )}
                {event.is_locked && !isFinalized && <Lock className="ml-2 inline h-4 w-4 text-destructive" />}
              </h3>
            </button>
          </div>

          {/* Edit button + Date badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <button
                onClick={() => setShowEditModal(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Editar evento"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <span className={`rounded-full px-3 py-1 font-display text-xs font-semibold ${getBadgeStyle(event.title, event.type)}`}>
              {new Date(event.event_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "numeric" })}
              {event.end_date && event.end_date !== event.event_date && (
                <> — {new Date(event.end_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "numeric" })}</>
              )}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{event.start_time} | {event.end_time}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.address}</span>
        </div>

        {/* Observações (visível para todos) */}
        {event.observations && (
          <div className="mb-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground border border-border/50">
            <span className="font-semibold text-foreground">📝 Obs: </span>
            {event.observations}
          </div>
        )}

        {/* Monitor Count & Team */}
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground flex-wrap">
          <Users className="h-4 w-4" />
          <span>
            Monitores: {monitorCount}
            {event.team && <span className="ml-2 text-muted-foreground">• Equipe {event.team === 1 ? "1️⃣" : "2️⃣"}</span>}
          </span>
        </div>

        {/* Monitors */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <AnimatePresence>
            {localMonitors.map((monitor) => {
              const confirmed = monitor.is_confirmed;
              const notSelected = isFinalized && !confirmed;
              const isPreSelected = preSelected.has(monitor.user_id);
              return (
                <motion.span
                  key={monitor.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={`group relative inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium shadow-sm border transition-all ${
                    confirmed || (isAdmin && !isFinalized && isPreSelected)
                      ? "bg-camp/15 border-camp/50 text-foreground"
                      : notSelected
                        ? "bg-card border-border text-card-foreground opacity-40"
                        : "bg-card border-border text-card-foreground"
                  }`}
                >
                  {isAdmin && !isFinalized && !isPastEvent ? (
                    <button
                      onClick={() => togglePreSelect(monitor.user_id)}
                      className="flex items-center gap-0"
                      title={isPreSelected ? "Desmarcar monitor" : "Escalar monitor"}
                    >
                      <CheckCircle2 className={`h-3 w-3 transition-colors ${isPreSelected ? "text-camp" : "text-muted-foreground/40"}`} />
                    </button>
                  ) : confirmed ? (
                    <CheckCircle2 className="h-3 w-3 text-camp" />
                  ) : (
                    <CheckCircle2 className={`h-3 w-3 ${notSelected ? "text-muted-foreground/40" : "text-muted-foreground"}`} />
                  )}
                  {isAdmin ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingMonitorId(monitor.user_id); }}
                      className="hover:underline"
                    >
                      {monitor.display_name}
                    </button>
                  ) : (
                    monitor.display_name
                  )}
                  {monitor.bonus_tags && monitor.bonus_tags.length > 0 && (
                    <span className="ml-0.5 text-xs">
                      {monitor.bonus_tags.map((tag) => {
                        const emoji = tag === "protagonista" ? "🅿️" : tag === "midia" ? "🎥" : tag === "cronista" ? "📜" : "";
                        return emoji;
                      }).join("")}
                    </span>
                  )}
                  {confirmed && monitor.level && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${levelColors[monitor.level] || ""}`}>
                      {levelLabels[monitor.level] || monitor.level}
                    </span>
                  )}
                  {!event.is_locked && !isPastEvent && monitor.user_id === user?.id && (
                    <button
                      onClick={handleLeave}
                      className="ml-0.5 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10"
                      aria-label="Sair da escala"
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                  {!event.is_locked && !isPastEvent && isAdmin && monitor.user_id !== user?.id && (
                    <button
                      onClick={() => setRejectingMonitor({ userId: monitor.user_id, name: monitor.display_name })}
                      className="ml-0.5 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10"
                      aria-label={`Rejeitar ${monitor.display_name}`}
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                </motion.span>
              );
            })}
          </AnimatePresence>
          {emptySlots > 0 &&
            Array.from({ length: emptySlots }).map((_, i) => (
              <span key={`empty-${i}`} className="inline-flex rounded-full border-2 border-dashed border-muted-foreground/30 px-3 py-1 text-sm text-muted-foreground">—</span>
            ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {isComingSoon && !isPastEvent && (
            <button disabled
              className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/30 px-4 py-2 text-sm font-semibold text-muted-foreground cursor-not-allowed opacity-60">
              🕐 Inscrições abrem em {diffDays - 30} dia{diffDays - 30 !== 1 ? "s" : ""}
            </button>
          )}
          {canJoin && (
            <button onClick={handleJoin}
              className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-primary/40 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/5">
              <Plus className="h-4 w-4" />Entrar na escala
            </button>
          )}
          {canLeave && (
            <button onClick={handleLeave}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5">
              <X className="h-4 w-4" />Sair da escala
            </button>
          )}
          {isAdmin && (
            <div className="flex gap-1.5 ml-auto">
              {event.is_deleted ? (
                <>
                  <button onClick={handleRestore}
                    className="rounded-lg bg-camp/20 px-3 py-2 text-xs font-semibold text-camp hover:bg-camp/30" title="Restaurar evento">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={handlePermanentDelete}
                    className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/20" title="Deletar permanentemente">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  {isFinalized && (
                    <button onClick={handleToggleLock}
                      className="rounded-lg bg-secondary/20 px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/30" title="Reabrir escala">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!isFinalized && localMonitors.length > 0 && (
                    <button onClick={() => setShowFinalize(true)}
                      className="rounded-lg bg-camp/20 px-3 py-2 text-xs font-semibold text-camp hover:bg-camp/30" title="Finalizar escala">
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={handleCopyWhatsApp} className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground hover:bg-muted/80" title="Copiar para WhatsApp">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={handleSoftDelete} className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/20" title="Mover para lixeira">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {showEditModal && (
        <EditEventModal
          event={event}
          onClose={() => setShowEditModal(false)}
          onSaved={onRefresh}
        />
      )}

      {showDetailModal && (
        <CalendarEventModal
          event={event}
          onClose={() => setShowDetailModal(false)}
          onRefresh={() => { onRefresh(); setShowDetailModal(false); }}
        />
      )}

      {showFinalize && (
        <FinalizeScaleDialog
          eventId={event.id}
          eventTitle={event.title}
          monitors={localMonitors}
          onClose={() => setShowFinalize(false)}
          onFinalized={onRefresh}
        />
      )}

      {showJoinDialog && (
        <JoinEventDialog
          eventId={event.id}
          eventTitle={event.title}
          eventEmoji={event.emoji}
          onClose={() => setShowJoinDialog(false)}
          onJoined={onRefresh}
        />
      )}

      {rejectingMonitor && (
        <RejectMonitorDialog
          eventId={event.id}
          eventTitle={event.title}
          monitorUserId={rejectingMonitor.userId}
          monitorName={rejectingMonitor.name}
          onClose={() => setRejectingMonitor(null)}
          onRejected={onRefresh}
        />
      )}
      {viewingMonitorId && (
        <MonitorProfileModal
          userId={viewingMonitorId}
          onClose={() => setViewingMonitorId(null)}
        />
      )}
    </>
  );
};

export default EventCard;

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Plus, X, Users, Lock, Copy, Trash2, CheckCircle2, ClipboardCheck, ExternalLink, Pencil, Save, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import FinalizeScaleDialog from "@/components/FinalizeScaleDialog";
import JoinEventDialog from "@/components/JoinEventDialog";
import RejectMonitorDialog from "@/components/RejectMonitorDialog";

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
  created_by: string | null;
  team?: number | null;
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

const EventCard = ({ event, onRefresh }: EventCardProps) => {
  const { user, isAdmin, isSpecialUser, isApproved } = useAuth();
  const [joining, setJoining] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [rejectingMonitor, setRejectingMonitor] = useState<{ userId: string; name: string } | null>(null);
  const [preSelected, setPreSelected] = useState<Set<string>>(() => {
    return new Set(event.monitors.filter((m) => m.is_confirmed).map((m) => m.user_id));
  });

  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editDate, setEditDate] = useState(event.event_date);
  const [editEndDate, setEditEndDate] = useState(event.end_date || "");
  const [editStart, setEditStart] = useState(event.start_time);
  const [editEnd, setEditEnd] = useState(event.end_time);
  const [editAddress, setEditAddress] = useState(event.address);
  const [editSlots, setEditSlots] = useState(event.total_slots?.toString() || "");
  const [editTeam, setEditTeam] = useState<number>(event.team || 1);
  const [editIsPaid, setEditIsPaid] = useState(event.is_paid !== false);

  const monitorCount = event.monitors.length;
  const isFull = event.total_slots ? monitorCount >= event.total_slots : false;
  const isUserInEvent = event.monitors.some((m) => m.user_id === user?.id);
  const todayLocal = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const [ey, em, ed] = (event.end_date || event.event_date).split("-").map(Number);
  const isPastEvent = new Date(ey, em - 1, ed) < todayLocal;
  // 30-day window: events more than 30 days away are "Em Breve"
  const [eventYear, eventMonth, eventDay] = event.event_date.split("-").map(Number);
  const eventDateLocal = new Date(eventYear, eventMonth - 1, eventDay);
  const diffDays = Math.ceil((eventDateLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));
  const isComingSoon = !isPastEvent && diffDays > 30;

  const canJoin = isApproved && !event.is_locked && !isFull && !isUserInEvent && !isPastEvent && !isComingSoon;
  const canLeave = isApproved && !event.is_locked && isUserInEvent && !isPastEvent && !isComingSoon;
  const hasConfirmed = event.monitors.some((m) => m.is_confirmed);
  const isFinalized = event.is_locked && hasConfirmed;

  const startEditing = () => {
    setEditTitle(event.title);
    setEditDate(event.event_date);
    setEditEndDate(event.end_date || "");
    setEditStart(event.start_time);
    setEditEnd(event.end_time);
    setEditAddress(event.address);
    setEditSlots(event.total_slots?.toString() || "");
    setEditTeam(event.team || 1);
    setEditIsPaid(event.is_paid !== false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editDate || !editStart.trim() || !editEnd.trim() || !editAddress.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const newSlots = editSlots ? parseInt(editSlots) : null;
    if (newSlots !== null && newSlots < monitorCount) {
      toast.warning(`Atenção: O novo limite de vagas (${newSlots}) é menor que a quantidade de inscritos atual (${monitorCount})`);
    }

    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({
        title: editTitle.trim(),
        event_date: editDate,
        end_date: event.type === "camp" && editEndDate ? editEndDate : null,
        start_time: editStart.trim(),
        end_time: editEnd.trim(),
        address: editAddress.trim(),
        total_slots: newSlots,
        team: editTeam,
        is_paid: editIsPaid,
      })
      .eq("id", event.id);

    if (error) {
      toast.error("Erro ao salvar alterações");
    } else {
      toast.success("Evento atualizado!");
      setEditing(false);
      onRefresh();
    }
    setSaving(false);
  };

  const togglePreSelect = async (userId: string) => {
    const next = new Set(preSelected);
    const newValue = !next.has(userId);
    if (newValue) next.add(userId); else next.delete(userId);
    setPreSelected(next);
    await supabase.from("event_monitors").update({ is_confirmed: newValue }).eq("event_id", event.id).eq("user_id", userId);
    onRefresh();
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

  const handleRemoveMonitor = async (monitorUserId: string) => {
    const { error } = await supabase.from("event_monitors").delete().eq("event_id", event.id).eq("user_id", monitorUserId);
    if (error) toast.error("Erro ao remover monitor");
    else { toast.success("Monitor removido"); onRefresh(); }
  };

  const handleToggleLock = async () => {
    const { error } = await supabase.from("events").update({ is_locked: !event.is_locked }).eq("id", event.id);
    if (error) toast.error("Erro ao alterar status");
    else { toast.success(event.is_locked ? "Escala desbloqueada" : "Escala encerrada"); onRefresh(); }
  };

  const handleSoftDelete = async () => {
    if (!confirm("Mover este evento para a lixeira?")) return;
    const { data, error } = await supabase
      .from("events")
      .update({ is_deleted: true })
      .eq("id", event.id)
      .select("id");
    if (error || !data?.length) toast.error("Erro ao arquivar evento");
    else { toast.success("Evento movido para a lixeira"); onRefresh(); }
  };

  const handleRestore = async () => {
    const { data, error } = await supabase
      .from("events")
      .update({ is_deleted: false })
      .eq("id", event.id)
      .select("id");
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
    const confirmed = event.monitors.filter((m) => m.is_confirmed);
    const list = confirmed.length > 0 ? confirmed : event.monitors;
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

  const inputClass = "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`relative rounded-lg border-2 p-3 sm:p-5 ${typeStyles[event.type] || "bg-card border-border"} transition-shadow hover:shadow-md ${
          isPastEvent ? "opacity-50" : ""
        } ${isFinalized ? "ring-2 ring-camp/40" : event.is_locked ? "ring-2 ring-destructive/30" : ""} ${saving ? "pointer-events-none" : ""}`}
      >
        {/* Saving overlay */}
        {saving && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={`${inputClass} w-full font-display text-lg font-bold`}
                placeholder="Nome da festa"
              />
            ) : (
              <Link to={`/event/${event.id}`} className="hover:underline">
                <h3 className="font-display text-base sm:text-lg font-bold leading-tight text-foreground md:text-xl">
                  <span className="mr-1">{event.emoji}</span>
                  {event.title}
                  {isComingSoon && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-semibold text-secondary">
                      ⏳ Em Breve
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
                  <ExternalLink className="ml-1 inline h-3 w-3 text-muted-foreground" />
                </h3>
              </Link>
            )}
          </div>

          {/* Edit button / Date badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && !editing && (
              <button
                onClick={startEditing}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Editar evento"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {!editing && (
              <span className={`rounded-full px-3 py-1 font-display text-xs font-semibold ${badgeStyles[event.type] || ""}`}>
                {new Date(event.event_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "numeric" })}
                {event.end_date && event.end_date !== event.event_date && (
                  <> — {new Date(event.end_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "numeric" })}</>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {editing ? (
            <div className="flex flex-wrap gap-2 w-full">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={`${inputClass} w-32`} />
              </div>
              {event.type === "camp" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">até</span>
                  <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} min={editDate} className={`${inputClass} w-32`} />
                </div>
              )}
              <div className="flex items-center gap-1">
                <input value={editStart} onChange={(e) => setEditStart(e.target.value)} className={`${inputClass} w-16 text-center`} placeholder="14h" />
                <span className="text-muted-foreground">|</span>
                <input value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={`${inputClass} w-16 text-center`} placeholder="18h" />
              </div>
              <div className="flex items-center gap-1.5 w-full">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className={`${inputClass} flex-1`} placeholder="Endereço" />
              </div>
            </div>
          ) : (
            <>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{event.start_time} | {event.end_time}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.address}</span>
            </>
          )}
        </div>

        {/* Monitor Count & Team */}
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground flex-wrap">
          <Users className="h-4 w-4" />
          {editing ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Monitores: {monitorCount} /</span>
              <input
                value={editSlots}
                onChange={(e) => setEditSlots(e.target.value)}
                type="number"
                min="1"
                max="50"
                className={`${inputClass} w-14 text-center`}
                placeholder="∞"
              />
              <span className="ml-2 text-muted-foreground">Equipe:</span>
              {[1, 2].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEditTeam(t)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors ${
                    editTeam === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {t === 1 ? "1️⃣" : "2️⃣"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEditIsPaid((v) => !v)}
                className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors ${
                  editIsPaid ? "border-camp/40 bg-camp/10 text-camp" : "border-border text-muted-foreground"
                }`}
              >
                {editIsPaid ? "💰 Remunerado" : "🤝 Voluntário"}
              </button>
            </div>
          ) : (
            <span>
              Monitores: {monitorCount}{event.total_slots ? ` / ${event.total_slots}` : ""}
              {event.team && <span className="ml-2 text-muted-foreground">• Equipe {event.team === 1 ? "1️⃣" : "2️⃣"}</span>}
            </span>
          )}
          {!editing && isFull && (
            <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Lotado</span>
          )}
        </div>

        {/* Inline edit actions */}
        {editing && (
          <div className="mb-3 flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-camp px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Salvar
            </button>
            <button
              onClick={cancelEditing}
              className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        )}

        {/* Monitors */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <AnimatePresence>
            {event.monitors.map((monitor) => {
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
                      title={isPreSelected ? "Desmarcar monitor" : "Pré-escalar monitor"}
                    >
                      <CheckCircle2 className={`h-3 w-3 transition-colors ${isPreSelected ? "text-camp" : "text-muted-foreground/40"}`} />
                    </button>
                  ) : confirmed ? (
                    <CheckCircle2 className="h-3 w-3 text-camp" />
                  ) : (
                    <CheckCircle2 className={`h-3 w-3 ${notSelected ? "text-muted-foreground/40" : "text-muted-foreground"}`} />
                  )}
                  {monitor.display_name}
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
        {!editing && (
          <div className="flex flex-wrap gap-2">
            {isComingSoon && !isPastEvent && (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/30 px-4 py-2 text-sm font-semibold text-muted-foreground cursor-not-allowed opacity-60">
                ⏳ Inscrições abrem em {diffDays - 30} dia{diffDays - 30 !== 1 ? "s" : ""}
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
                    {!isFinalized && event.monitors.length > 0 && (
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
        )}
      </motion.div>

      {showFinalize && (
        <FinalizeScaleDialog
          eventId={event.id}
          eventTitle={event.title}
          monitors={event.monitors}
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
    </>
  );
};

export default EventCard;

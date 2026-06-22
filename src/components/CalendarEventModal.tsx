import { useState, useEffect } from "react";
import { X, Clock, MapPin, Users, CheckCircle2, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JoinEventDialog from "@/components/JoinEventDialog";
import EditEventModal from "@/components/EditEventModal";
import { calcHours, formatCurrency } from "@/utils/payments";

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
  force_available?: boolean;
  created_by: string | null;
  team?: number | null;
  custom_rates?: Record<string, number> | null;
  observations?: string | null;
  monitors: Monitor[];
}

interface CalendarEventModalProps {
  event: EventData;
  onClose: () => void;
  onRefresh: () => void;
}

interface Hierarchy {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  sort_order: number;
}

interface TeamRole {
  team_id: string;
  hierarchy_id: string;
  hourly_rate: number;
}

interface Team {
  id: string;
  sort_order: number;
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
  const { user, isAdmin } = useAuth();
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Linked special event banner
  const [linkedSpecialEvent, setLinkedSpecialEvent] = useState<{ id: string; title: string } | null | undefined>(undefined);

  useEffect(() => {
    (supabase as any)
      .from("special_events")
      .select("id, title")
      .eq("event_id", event.id)
      .limit(1)
      .then(({ data }: { data: { id: string; title: string }[] | null }) => {
        setLinkedSpecialEvent(data?.[0] ?? null);
      });
  }, [event.id]);

  // Rates data (loaded for paid events)
  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [teamRoles, setTeamRoles] = useState<TeamRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);

  useEffect(() => {
    if (event.is_paid === false) return;
    setRatesLoading(true);
    Promise.all([
      supabase.from("hierarchies").select("id, slug, name, emoji, sort_order").order("sort_order"),
      supabase.from("team_roles").select("team_id, hierarchy_id, hourly_rate"),
      supabase.from("teams").select("id, sort_order"),
    ]).then(([hierRes, rolesRes, teamsRes]) => {
      setHierarchies(hierRes.data ?? []);
      setTeamRoles(rolesRes.data ?? []);
      setTeams(teamsRes.data ?? []);
      setRatesLoading(false);
    });
  }, [event.id, event.is_paid]);

  const getEffectiveRate = (h: Hierarchy): { rate: number; isCustom: boolean } | null => {
    const customRates = event.custom_rates ?? {};
    if (customRates[h.slug] !== undefined) {
      return { rate: customRates[h.slug], isCustom: true };
    }
    const teamNum = event.team;
    const teamObj = teamNum != null
      ? (teams.find((t) => t.sort_order === teamNum) ??
         teams.find((t) => t.sort_order === teamNum - 1))
      : teams.reduce<Team | null>(
          (min, t) => (min === null || t.sort_order < min.sort_order ? t : min),
          null
        );
    if (!teamObj) return null;
    const tr = teamRoles.find((r) => r.team_id === teamObj.id && r.hierarchy_id === h.id);
    if (!tr) return null;
    return { rate: tr.hourly_rate, isCustom: false };
  };

  const extraRates = Object.entries(event.custom_rates ?? {}).filter(
    ([key]) => !hierarchies.some((h) => h.slug === key)
  );

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
  const isComingSoon = !isPastEvent && diffDays > 30 && !event.force_available;

  const monitorCount = event.monitors.length;
  const isUserInEvent = event.monitors.some((m) => m.user_id === user?.id);
  const isFinalized = event.is_locked && event.monitors.some((m) => m.is_confirmed);
  const confirmedMonitors = event.monitors.filter((m) => m.is_confirmed);

  // Qualquer usuário logado pode se inscrever — total_slots é apenas informativo
  const canJoin = !!user && !event.is_locked && !isUserInEvent && !isPastEvent && !isComingSoon;
  const canLeave = !!user && !event.is_locked && isUserInEvent && !isPastEvent && !isComingSoon;

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

  const hasAnyCustomRate =
    hierarchies.some((h) => getEffectiveRate(h)?.isCustom) || extraRates.length > 0;

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
            <div className="min-w-0 flex-1">
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
            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                  title="Editar evento"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
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
                {monitorCount} monitor{monitorCount !== 1 ? "es" : ""} inscritos
                {event.total_slots ? ` · ${event.total_slots} vagas` : ""}
              </span>
            </div>
          </div>

          {/* Observações */}
          {event.observations && (
            <div className="mt-3 rounded-md bg-muted/60 border border-border/50 px-3 py-2.5 text-sm">
              <p className="text-xs font-semibold text-muted-foreground mb-1">📝 Observações</p>
              <p className="text-foreground whitespace-pre-wrap">{event.observations}</p>
            </div>
          )}

          {/* Banner: evento especial vinculado */}
          {linkedSpecialEvent && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border-2 border-yellow-400/70 bg-yellow-50/70 px-4 py-3 dark:bg-yellow-900/20 dark:border-yellow-500/50">
              <span className="text-lg leading-none shrink-0">⭐</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                  Este é um Evento Especial
                </p>
                <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-400">
                  ℹ️ Acesse a aba Eventos Especiais para ver detalhes e se voluntariar
                </p>
              </div>
            </div>
          )}

          {/* Remuneração — visível para todos em eventos pagos */}
          {event.is_paid !== false && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isAdmin ? "💰 Remuneração / hora" : "💰 Remuneração total"}
              </p>
              {ratesLoading ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
                  Carregando...
                </div>
              ) : hierarchies.length > 0 ? (
                <>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full">
                      <tbody className="divide-y divide-border">
                        {(() => {
                          const eventHours = calcHours(event.start_time, event.end_time);
                          return hierarchies.map((h) => {
                            const effective = getEffectiveRate(h);
                            const displayValue = effective
                              ? isAdmin
                                ? `${formatCurrency(effective.rate)}/h`
                                : formatCurrency(effective.rate * eventHours)
                              : "—";
                            return (
                              <tr key={h.id}>
                                <td className="px-3 py-1.5 text-sm font-medium text-foreground">
                                  {h.emoji} {h.name}
                                </td>
                                <td className={`px-3 py-1.5 text-right text-sm font-medium ${effective?.isCustom ? "text-amber-600" : "text-muted-foreground"}`}>
                                  {displayValue}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                        {(() => {
                          const eventHours = calcHours(event.start_time, event.end_time);
                          return extraRates.map(([key, val]) => (
                            <tr key={key}>
                              <td className="px-3 py-1.5 text-sm font-medium text-foreground">
                                {key}
                              </td>
                              <td className="px-3 py-1.5 text-right text-sm font-medium text-amber-600">
                                {isAdmin
                                  ? `${formatCurrency(val)}/h`
                                  : formatCurrency(val * eventHours)}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {hasAnyCustomRate && (
                    <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      Valores específicos para este evento
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}

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
                  ? `🕐 Inscrições abrem em ${diffDays - 30} dia${diffDays - 30 !== 1 ? "s" : ""}`
                  : event.is_locked
                  ? "Escala encerrada"
                  : isUserInEvent
                  ? "Você já está inscrito"
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
          onJoined={onRefresh}
        />
      )}

      {showEditModal && (
        <EditEventModal
          event={event}
          onClose={() => setShowEditModal(false)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
};

export default CalendarEventModal;

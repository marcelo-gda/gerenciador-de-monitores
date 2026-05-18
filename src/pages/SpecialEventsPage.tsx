import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Plus, ChevronDown, ChevronRight, X, Save,
  Loader2, Trash2, Check, Users, Pencil,
} from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile { id: string; display_name: string }

interface Assignment {
  id: string;
  function_id: string;
  user_id: string;
  status: string; // 'volunteer' | 'confirmed' | 'rejected'
  created_at: string;
  profiles: Profile | null;
}

interface SefFunction {
  id: string;
  day_id: string;
  emoji: string;
  name: string;
  hours: number;
  hourly_rate: number;
  max_monitors: number | null;
  sort_order: number;
  time_start: string | null;
  time_end: string | null;
  special_event_assignments: Assignment[];
}

interface SefDay {
  id: string;
  special_event_id: string;
  date: string;
  sort_order: number;
  special_event_functions: SefFunction[];
}

interface SpecialEvent {
  id: string;
  event_id: string | null;
  title: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
  special_event_days: SefDay[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const fmtDateLong = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

const statusLabel: Record<string, { label: string; cls: string }> = {
  volunteer: { label: "Aguardando", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" },
  confirmed: { label: "✅ Escalado",  cls: "bg-camp/15 text-camp" },
  rejected:  { label: "❌ Rejeitado", cls: "bg-destructive/10 text-destructive" },
};

const inputCls = "rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors";

const getDatesInRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const cur = new Date(start + "T12:00:00");
  const endD = new Date(end + "T12:00:00");
  while (cur <= endD) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const computePeriodHours = (start: string, end: string): string => {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return String(Math.round((mins / 60) * 100) / 100);
};

// ── Create Modal ──────────────────────────────────────────────────────────────

interface CalEvent { id: string; title: string; event_date: string; end_date: string | null }
interface CreateModalProps { onClose: () => void; onCreated: () => void }

const CreateSpecialEventModal = ({ onClose, onCreated }: CreateModalProps) => {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [eventId, setEventId] = useState<string>("");
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("events")
      .select("id, title, event_date, end_date")
      .eq("is_deleted", false)
      .order("event_date", { ascending: false })
      .then(({ data }) => setCalEvents((data ?? []) as CalEvent[]));
  }, []);

  // Auto-fill when a calendar event is selected
  useEffect(() => {
    if (!eventId) return;
    const ev = calEvents.find((e) => e.id === eventId);
    if (!ev) return;
    setTitle(ev.title);
    setStartDate(ev.event_date);
    setEndDate(ev.end_date ?? ev.event_date);
  }, [eventId, calEvents]);

  const handleSave = async () => {
    if (!title.trim() || !startDate || !endDate) {
      toast.error("Preencha título e datas");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("special_events").insert({
      title: title.trim(),
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() || null,
      event_id: eventId || null,
    } as any);
    setSaving(false);
    if (error) { toast.error("Erro ao criar evento especial"); return; }
    toast.success("Evento especial criado!");
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 px-3 pb-3 sm:pb-0" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border-2 border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="font-display text-lg font-bold">Novo Evento Especial</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Vincular evento — primeiro para auto-preencher */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Vincular evento do calendário</label>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={`${inputCls} w-full`}>
              <option value="">— Nenhum —</option>
              {calEvents.map((e) => (
                <option key={e.id} value={e.id}>{e.title} ({fmtDate(e.event_date)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} w-full`} placeholder="Nome do evento especial" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Início *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Fim *</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputCls} w-full`} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} w-full min-h-[70px] resize-y`} placeholder="Notas sobre o evento..." />
          </div>
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button onClick={handleSave} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Criar
          </button>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted">Cancelar</button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const SpecialEventsPage = () => {
  const { user, isAdmin, isApproved } = useAuth();

  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);

  // Admin: add day
  const [addingDayTo, setAddingDayTo] = useState<string | null>(null);
  const [newDayDate, setNewDayDate] = useState("");
  const [savingDay, setSavingDay] = useState(false);

  // Admin: add function
  const [addingFnTo, setAddingFnTo] = useState<string | null>(null);
  const [newFn, setNewFn] = useState({ emoji: "⭐", name: "", hours: "", hourly_rate: "", max_monitors: "" });
  const [newFnHoursMode, setNewFnHoursMode] = useState<"duracao" | "periodo">("duracao");
  const [newFnPeriod, setNewFnPeriod] = useState({ start: "", end: "" });
  const [savingFn, setSavingFn] = useState(false);

  // Admin: edit function
  const [editingFnId, setEditingFnId] = useState<string | null>(null);
  const [editFn, setEditFn] = useState({ emoji: "", name: "", hours: "", hourly_rate: "", max_monitors: "" });
  const [editFnHoursMode, setEditFnHoursMode] = useState<"duracao" | "periodo">("duracao");
  const [editFnPeriod, setEditFnPeriod] = useState({ start: "", end: "" });
  const [savingEditFn, setSavingEditFn] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("special_events")
      .select(`
        *,
        special_event_days(
          *,
          special_event_functions(
            *,
            special_event_assignments(
              *,
              profiles:user_id(id, display_name)
            )
          )
        )
      `)
      .order("start_date", { ascending: true });

    if (error) { toast.error("Erro ao carregar eventos especiais"); setLoading(false); return; }

    // Sort days and functions by sort_order
    const sorted = (data ?? []).map((ev: any) => ({
      ...ev,
      special_event_days: (ev.special_event_days ?? [])
        .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.sort_order - b.sort_order)
        .map((day: any) => ({
          ...day,
          special_event_functions: (day.special_event_functions ?? [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order),
        })),
    }));

    setEvents(sorted);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── Admin: add day ──────────────────────────────────────────────────────────

  const handleAddDay = async (specialEventId: string) => {
    if (!newDayDate) { toast.error("Selecione uma data"); return; }
    setSavingDay(true);
    const { error } = await (supabase as any).from("special_event_days").insert({
      special_event_id: specialEventId,
      date: newDayDate,
      sort_order: 0,
    });
    setSavingDay(false);
    if (error) { toast.error("Erro ao adicionar dia"); return; }
    setAddingDayTo(null);
    setNewDayDate("");
    fetchData();
  };

  const handleRemoveDay = async (dayId: string) => {
    if (!confirm("Remover este dia e todas as suas funções?")) return;
    const { error } = await (supabase as any).from("special_event_days").delete().eq("id", dayId);
    if (error) { toast.error("Erro ao remover dia"); return; }
    fetchData();
  };

  // ── Admin: add function ─────────────────────────────────────────────────────

  const handleAddFn = async (dayId: string) => {
    if (!newFn.name.trim() || !newFn.hours || !newFn.hourly_rate) {
      toast.error("Preencha nome, horas e valor/hora");
      return;
    }
    setSavingFn(true);
    const { error } = await (supabase as any).from("special_event_functions").insert({
      day_id: dayId,
      emoji: newFn.emoji || "⭐",
      name: newFn.name.trim(),
      hours: parseFloat(newFn.hours),
      hourly_rate: parseFloat(newFn.hourly_rate),
      max_monitors: newFn.max_monitors ? parseInt(newFn.max_monitors) : null,
      sort_order: 0,
      time_start: newFnHoursMode === "periodo" && newFnPeriod.start ? newFnPeriod.start : null,
      time_end: newFnHoursMode === "periodo" && newFnPeriod.end ? newFnPeriod.end : null,
    });
    setSavingFn(false);
    if (error) { toast.error("Erro ao adicionar função"); return; }
    setAddingFnTo(null);
    setNewFn({ emoji: "⭐", name: "", hours: "", hourly_rate: "", max_monitors: "" });
    fetchData();
  };

  const handleRemoveFn = async (fnId: string) => {
    if (!confirm("Remover esta função?")) return;
    const { error } = await (supabase as any).from("special_event_functions").delete().eq("id", fnId);
    if (error) { toast.error("Erro ao remover função"); return; }
    fetchData();
  };

  const startEditFn = (fn: SefFunction) => {
    setEditingFnId(fn.id);
    if (fn.time_start && fn.time_end) {
      setEditFnHoursMode("periodo");
      setEditFnPeriod({ start: fn.time_start.slice(0, 5), end: fn.time_end.slice(0, 5) });
    } else {
      setEditFnHoursMode("duracao");
      setEditFnPeriod({ start: "", end: "" });
    }
    setEditFn({
      emoji: fn.emoji,
      name: fn.name,
      hours: fn.hours.toString(),
      hourly_rate: fn.hourly_rate.toString(),
      max_monitors: fn.max_monitors?.toString() ?? "",
    });
  };

  const handleSaveEditFn = async () => {
    if (!editFn.name.trim() || !editFn.hours || !editFn.hourly_rate) {
      toast.error("Preencha nome, horas e valor/hora");
      return;
    }
    setSavingEditFn(true);
    const { error } = await (supabase as any).from("special_event_functions").update({
      emoji: editFn.emoji || "⭐",
      name: editFn.name.trim(),
      hours: parseFloat(editFn.hours),
      hourly_rate: parseFloat(editFn.hourly_rate),
      max_monitors: editFn.max_monitors ? parseInt(editFn.max_monitors) : null,
      time_start: editFnHoursMode === "periodo" && editFnPeriod.start ? editFnPeriod.start : null,
      time_end: editFnHoursMode === "periodo" && editFnPeriod.end ? editFnPeriod.end : null,
    }).eq("id", editingFnId);
    setSavingEditFn(false);
    if (error) { toast.error("Erro ao salvar função"); return; }
    setEditingFnId(null);
    fetchData();
  };

  // ── Assignment actions ──────────────────────────────────────────────────────

  const handleVolunteer = async (functionId: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("special_event_assignments").insert({
      function_id: functionId,
      user_id: user.id,
      status: "volunteer",
    });
    if (error) {
      if (error.code === "23505") toast.error("Você já está inscrito nesta função");
      else toast.error("Erro ao se voluntariar");
      return;
    }
    toast.success("Voluntariado registrado!");
    fetchData();
  };

  const handleLeaveFunction = async (assignmentId: string) => {
    const { error } = await (supabase as any).from("special_event_assignments").delete().eq("id", assignmentId);
    if (error) { toast.error("Erro ao cancelar inscrição"); return; }
    toast.success("Inscrição cancelada");
    fetchData();
  };

  const handleSetStatus = async (assignmentId: string, status: "confirmed" | "rejected") => {
    const { error } = await (supabase as any)
      .from("special_event_assignments")
      .update({ status })
      .eq("id", assignmentId);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    fetchData();
  };

  const handleRemoveSpecialEvent = async (id: string) => {
    if (!confirm("Remover este evento especial e todos os seus dados?")) return;
    const { error } = await (supabase as any).from("special_events").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover evento especial"); return; }
    toast.success("Evento especial removido");
    fetchData();
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderAssignment = (a: Assignment, fn: SefFunction) => {
    const st = statusLabel[a.status] ?? statusLabel.volunteer;
    const isOwn = a.user_id === user?.id;
    return (
      <div key={a.id} className="flex items-center justify-between gap-2 py-1">
        <span className="text-sm font-medium text-foreground">{a.profiles?.display_name ?? "Monitor"}</span>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
          {isAdmin ? (
            <>
              {a.status !== "confirmed" && (
                <button onClick={() => handleSetStatus(a.id, "confirmed")}
                  className="rounded-lg bg-camp/20 px-2 py-1 text-xs font-semibold text-camp hover:bg-camp/30" title="Escalar">
                  <Check className="h-3 w-3" />
                </button>
              )}
              {a.status !== "rejected" && (
                <button onClick={() => handleSetStatus(a.id, "rejected")}
                  className="rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20" title="Rejeitar">
                  <X className="h-3 w-3" />
                </button>
              )}
            </>
          ) : isOwn && a.status === "volunteer" ? (
            <button onClick={() => handleLeaveFunction(a.id)}
              className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderFunction = (fn: SefFunction) => {
    const total = fn.hours * fn.hourly_rate;
    const confirmedCount = fn.special_event_assignments.filter((a) => a.status === "confirmed").length;
    const myAssignment = fn.special_event_assignments.find((a) => a.user_id === user?.id);
    const isFull = fn.max_monitors != null && confirmedCount >= fn.max_monitors;

    if (isAdmin && editingFnId === fn.id) {
      return (
        <div key={fn.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex gap-2">
            <input value={editFn.emoji} onChange={(e) => setEditFn((p) => ({ ...p, emoji: e.target.value }))}
              className={`${inputCls} w-14 text-center text-lg`} maxLength={2} />
            <input value={editFn.name} onChange={(e) => setEditFn((p) => ({ ...p, name: e.target.value }))}
              className={`${inputCls} flex-1`} placeholder="Nome da função" />
          </div>
          <div className="flex gap-2 flex-wrap items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Duração:</span>
                <button type="button" onClick={() => setEditFnHoursMode("duracao")}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${editFnHoursMode === "duracao" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"}`}>
                  Horas
                </button>
                <button type="button" onClick={() => setEditFnHoursMode("periodo")}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${editFnHoursMode === "periodo" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"}`}>
                  Período
                </button>
              </div>
              {editFnHoursMode === "duracao" ? (
                <input type="number" min="0" step="0.5" value={editFn.hours}
                  onChange={(e) => setEditFn((p) => ({ ...p, hours: e.target.value }))}
                  className={`${inputCls} w-16 text-center`} />
              ) : (
                <div className="flex items-center gap-1">
                  <input type="time" value={editFnPeriod.start}
                    onChange={(e) => {
                      const s = e.target.value;
                      setEditFnPeriod((p) => ({ ...p, start: s }));
                      const h = computePeriodHours(s, editFnPeriod.end);
                      if (h) setEditFn((p) => ({ ...p, hours: h }));
                    }}
                    className={`${inputCls} w-24 text-center text-xs`} />
                  <span className="text-xs text-muted-foreground">→</span>
                  <input type="time" value={editFnPeriod.end}
                    onChange={(e) => {
                      const end = e.target.value;
                      setEditFnPeriod((p) => ({ ...p, end }));
                      const h = computePeriodHours(editFnPeriod.start, end);
                      if (h) setEditFn((p) => ({ ...p, hours: h }));
                    }}
                    className={`${inputCls} w-24 text-center text-xs`} />
                  {editFn.hours && (
                    <span className="text-xs font-semibold text-foreground">{editFn.hours}h</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">R$/h:</span>
              <input type="number" min="0" step="0.01" value={editFn.hourly_rate} onChange={(e) => setEditFn((p) => ({ ...p, hourly_rate: e.target.value }))}
                className={`${inputCls} w-20 text-center`} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Vagas:</span>
              <input type="number" min="1" value={editFn.max_monitors} onChange={(e) => setEditFn((p) => ({ ...p, max_monitors: e.target.value }))}
                className={`${inputCls} w-16 text-center`} placeholder="∞" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveEditFn} disabled={savingEditFn}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {savingEditFn ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
            </button>
            <button onClick={() => setEditingFnId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
              Cancelar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={fn.id} className="rounded-lg border border-border bg-card p-3">
        {/* Function header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base">{fn.emoji}</span>
              <span className="font-semibold text-sm text-foreground">{fn.name}</span>
              <span className="text-xs text-muted-foreground">
                {fn.time_start && fn.time_end
                  ? `${fn.time_start.slice(0, 5)} – ${fn.time_end.slice(0, 5)} (${fn.hours}h)`
                  : `${fn.hours}h`}
              </span>
              {isAdmin && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">R$ {fn.hourly_rate.toFixed(2)}/h</span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">
                {isAdmin ? `Total: R$ ${total.toFixed(2)}` : `R$ ${total.toFixed(2)}`}
              </span>
              {fn.max_monitors != null && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isFull ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  <Users className="inline h-3 w-3 mr-0.5" />
                  {confirmedCount}/{fn.max_monitors} {isFull ? "· Lotado" : ""}
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-1 shrink-0">
              <button onClick={() => startEditFn(fn)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" title="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleRemoveFn(fn.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" title="Remover">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Assignments */}
        {fn.special_event_assignments.length > 0 && (
          <div className="mt-2 border-t border-border/60 pt-2 space-y-0.5">
            {fn.special_event_assignments.map((a) => renderAssignment(a, fn))}
          </div>
        )}

        {/* Monitor: volunteer button */}
        {!isAdmin && !myAssignment && !isFull && (
          <button onClick={() => handleVolunteer(fn.id)}
            className="mt-2 flex items-center gap-1.5 rounded-lg border-2 border-dashed border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary hover:bg-primary/5 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Me voluntariar
          </button>
        )}
        {!isAdmin && isFull && !myAssignment && (
          <p className="mt-2 text-xs text-muted-foreground">Vagas esgotadas</p>
        )}
      </div>
    );
  };

  const renderDay = (day: SefDay) => (
    <div key={day.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
      {/* Day header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-display font-semibold text-sm text-foreground">
          📅 {fmtDateLong(day.date)}
        </h4>
        {isAdmin && (
          <button onClick={() => handleRemoveDay(day.id)}
            className="rounded-lg p-1 text-destructive hover:bg-destructive/10" title="Remover dia">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Functions list */}
      <div className="space-y-2">
        {day.special_event_functions.map(renderFunction)}
      </div>

      {/* Admin: add function */}
      {isAdmin && (
        addingFnTo === day.id ? (
          <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex gap-2">
              <input value={newFn.emoji} onChange={(e) => setNewFn((p) => ({ ...p, emoji: e.target.value }))}
                className={`${inputCls} w-14 text-center text-lg`} maxLength={2} />
              <input value={newFn.name} onChange={(e) => setNewFn((p) => ({ ...p, name: e.target.value }))}
                className={`${inputCls} flex-1`} placeholder="Nome da função" />
            </div>
            <div className="flex gap-2 flex-wrap items-start">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Duração:</span>
                  <button type="button" onClick={() => setNewFnHoursMode("duracao")}
                    className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${newFnHoursMode === "duracao" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"}`}>
                    Horas
                  </button>
                  <button type="button" onClick={() => setNewFnHoursMode("periodo")}
                    className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${newFnHoursMode === "periodo" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"}`}>
                    Período
                  </button>
                </div>
                {newFnHoursMode === "duracao" ? (
                  <input type="number" min="0" step="0.5" value={newFn.hours}
                    onChange={(e) => setNewFn((p) => ({ ...p, hours: e.target.value }))}
                    className={`${inputCls} w-16 text-center`} placeholder="8" />
                ) : (
                  <div className="flex items-center gap-1">
                    <input type="time" value={newFnPeriod.start}
                      onChange={(e) => {
                        const s = e.target.value;
                        setNewFnPeriod((p) => ({ ...p, start: s }));
                        const h = computePeriodHours(s, newFnPeriod.end);
                        if (h) setNewFn((p) => ({ ...p, hours: h }));
                      }}
                      className={`${inputCls} w-24 text-center text-xs`} />
                    <span className="text-xs text-muted-foreground">→</span>
                    <input type="time" value={newFnPeriod.end}
                      onChange={(e) => {
                        const end = e.target.value;
                        setNewFnPeriod((p) => ({ ...p, end }));
                        const h = computePeriodHours(newFnPeriod.start, end);
                        if (h) setNewFn((p) => ({ ...p, hours: h }));
                      }}
                      className={`${inputCls} w-24 text-center text-xs`} />
                    {newFn.hours && (
                      <span className="text-xs font-semibold text-foreground">{newFn.hours}h</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">R$/h:</span>
                <input type="number" min="0" step="0.01" value={newFn.hourly_rate} onChange={(e) => setNewFn((p) => ({ ...p, hourly_rate: e.target.value }))}
                  className={`${inputCls} w-20 text-center`} placeholder="30" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Vagas:</span>
                <input type="number" min="1" value={newFn.max_monitors} onChange={(e) => setNewFn((p) => ({ ...p, max_monitors: e.target.value }))}
                  className={`${inputCls} w-16 text-center`} placeholder="∞" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleAddFn(day.id)} disabled={savingFn}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {savingFn ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Adicionar
              </button>
              <button onClick={() => setAddingFnTo(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setAddingFnTo(day.id); setNewFn({ emoji: "⭐", name: "", hours: "", hourly_rate: "", max_monitors: "" }); setNewFnHoursMode("duracao"); setNewFnPeriod({ start: "", end: "" }); }}
            className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
            <Plus className="h-3.5 w-3.5" /> Adicionar função
          </button>
        )
      )}
    </div>
  );

  const renderSpecialEvent = (ev: SpecialEvent) => {
    const isOpen = expanded.has(ev.id);
    return (
      <div key={ev.id} className="rounded-xl border-2 border-border bg-card shadow-sm">
        {/* Event header */}
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base sm:text-lg font-bold text-foreground">
              ⭐ {ev.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtDate(ev.start_date)} — {fmtDate(ev.end_date)}
              {ev.notes && <> · <span className="italic">{ev.notes}</span></>}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <button onClick={() => handleRemoveSpecialEvent(ev.id)}
                className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" title="Remover evento especial">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => toggleExpand(ev.id)}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {isOpen ? "Fechar" : "Expandir"}
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isOpen && (
          <div className="border-t border-border p-4 space-y-3">
            {ev.special_event_days.length === 0 && !isAdmin && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dia cadastrado ainda.</p>
            )}

            {ev.special_event_days.map(renderDay)}

            {/* Admin: add day */}
            {isAdmin && (
              addingDayTo === ev.id ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  {(() => {
                    const addedDates = new Set(ev.special_event_days.map((d) => d.date));
                    const available = getDatesInRange(ev.start_date, ev.end_date).filter((d) => !addedDates.has(d));
                    return available.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Todos os dias do evento já foram adicionados.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {available.map((date) => (
                          <button
                            key={date}
                            type="button"
                            onClick={() => setNewDayDate(date)}
                            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                              newDayDate === date
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border bg-background text-foreground hover:bg-muted"
                            }`}
                          >
                            {fmtDateLong(date)}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <button onClick={() => handleAddDay(ev.id)} disabled={savingDay || !newDayDate}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                      {savingDay ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Adicionar
                    </button>
                    <button onClick={() => { setAddingDayTo(null); setNewDayDate(""); }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAddingDayTo(ev.id); setNewDayDate(""); }}
                  className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Adicionar dia
                </button>
              )
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background font-body">
      <AppNavbar />

      <main className="px-3 sm:container py-5 sm:py-8 max-w-3xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5 gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="font-display text-xl font-bold text-foreground">⭐ Eventos Especiais</h1>
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Novo
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border-2 border-border bg-card p-4">
                <div className="h-5 w-48 rounded bg-muted mb-2" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-4xl mb-3 block">⭐</span>
            <p className="font-display text-lg font-bold text-foreground mb-1">Nenhum evento especial</p>
            {isAdmin && (
              <p className="text-sm text-muted-foreground">Clique em "Novo" para criar o primeiro.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(renderSpecialEvent)}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateSpecialEventModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
};

export default SpecialEventsPage;

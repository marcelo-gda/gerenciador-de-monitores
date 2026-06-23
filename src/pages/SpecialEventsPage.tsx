import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Plus, ChevronDown, ChevronRight, X, Save,
  Loader2, Trash2, Check, ArrowUpDown, ChevronUp, CheckCircle2,
} from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile { id: string; display_name: string }

interface GdcOption {
  id: string;
  emoji: string;
  name: string;
  value_per_day: number | null;
  category: "gda" | "gdc";
}

interface DaySignupEdit {
  id: string;
  user_id: string;
  display_name: string;
  status: string;
  hierarchy_id: string | null;
  role_id_1: string | null;
  bonus: number;
}

interface DaySignup {
  id: string;
  day_id: string;
  user_id: string;
  status: string;
  hierarchy_id: string | null;
  role_id_1: string | null;
  bonus: number | null;
  value_per_day: number | null;
  created_at: string;
  profiles: Profile | null;
}

interface SefDay {
  id: string;
  special_event_id: string;
  date: string;
  sort_order: number;
  time_start: string | null;
  time_end: string | null;
  monitors_needed: number | null;
  special_event_day_signups: DaySignup[];
}

interface SpecialEvent {
  id: string;
  event_id: string | null;
  title: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
  category: "gda" | "gdc";
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

// ── Create Modal ──────────────────────────────────────────────────────────────

interface CalEvent { id: string; title: string; event_date: string; end_date: string | null; type: string }
interface CreateModalProps { onClose: () => void; onCreated: () => void }

const CreateSpecialEventModal = ({ onClose, onCreated }: CreateModalProps) => {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [eventId, setEventId] = useState<string>("");
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [category, setCategory] = useState<"gda" | "gdc">("gda");
  const [autoCreateDays, setAutoCreateDays] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("events")
      .select("id, title, event_date, end_date, type")
      .eq("is_deleted", false)
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as CalEvent[];
        const isBig = (e: CalEvent) => e.type === "camp" || /acampamento|gdc/i.test(e.title);
        setCalEvents([
          ...list.filter(isBig),
          ...list.filter((e) => !isBig(e)),
        ]);
      });
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
    const { data: inserted, error } = await (supabase as any)
      .from("special_events")
      .insert({
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || null,
        event_id: eventId || null,
        category,
      } as any)
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      toast.error("Erro ao criar evento especial");
      return;
    }

    if (autoCreateDays && inserted) {
      const dates = getDatesInRange(startDate, endDate);
      const dayRows = dates.map((date, i) => ({
        special_event_id: (inserted as any).id,
        date,
        sort_order: i,
      }));
      const { error: daysError } = await (supabase as any)
        .from("special_event_days")
        .insert(dayRows);
      if (daysError) {
        toast.error("Evento criado, mas houve um erro ao gerar os dias automaticamente");
      }
    }

    setSaving(false);
    toast.success(
      autoCreateDays
        ? "Evento especial criado com os dias gerados automaticamente!"
        : "Evento especial criado!"
    );
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
          <div className="flex gap-2">
            {(["gda", "gdc"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-display font-bold transition-colors ${
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Vincular evento — primeiro para auto-preencher */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Vincular evento do calendário</label>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={`${inputCls} w-full`}>
              <option value="">— Nenhum —</option>
              {(() => {
                const isBig = (e: CalEvent) => e.type === "camp" || /acampamento|gdc/i.test(e.title);
                const big = calEvents.filter(isBig);
                const regular = calEvents.filter((e) => !isBig(e));
                return (
                  <>
                    {big.length > 0 && (
                      <optgroup label="⛺ Camps e Grandes">
                        {big.map((e) => (
                          <option key={e.id} value={e.id}>{e.title} ({fmtDate(e.event_date)})</option>
                        ))}
                      </optgroup>
                    )}
                    {regular.length > 0 && (
                      <optgroup label="🎉 Outros eventos">
                        {regular.map((e) => (
                          <option key={e.id} value={e.id}>{e.title} ({fmtDate(e.event_date)})</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                );
              })()}
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
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <input
              type="checkbox"
              id="auto-create-days"
              checked={autoCreateDays}
              onChange={(e) => setAutoCreateDays(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <label htmlFor="auto-create-days" className="text-sm cursor-pointer select-none">
              <span className="font-semibold text-foreground">Criar dias automaticamente</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {startDate && endDate
                  ? `Serão criadas ${getDatesInRange(startDate, endDate).length} caixas, uma para cada dia entre ${fmtDate(startDate)} e ${fmtDate(endDate)}.`
                  : "Gera uma caixa para cada dia do período acima. Desmarque para continuar adicionando os dias manualmente, como hoje."}
              </p>
            </label>
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
  const { user, isMasterAdmin, isApproved } = useAuth();
  const isAdmin = isMasterAdmin; // admins comuns veem a view de monitor

  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);

  // Admin: add day
  const [addingDayTo, setAddingDayTo] = useState<string | null>(null);
  const [newDayDate, setNewDayDate] = useState("");
  const [savingDay, setSavingDay] = useState(false);

  // Opções de cargo/função (GDA/GDC) para os selects do admin
  const [gdcHierarchies, setGdcHierarchies] = useState<GdcOption[]>([]);
  const [gdcRoles, setGdcRoles] = useState<GdcOption[]>([]);
  const [dayModalDayId, setDayModalDayId] = useState<string | null>(null);
  const [dayModalCategory, setDayModalCategory] = useState<"gda" | "gdc">("gdc");
  const [dayModalDate, setDayModalDate] = useState<string>("");
  const [modalSignups, setModalSignups] = useState<DaySignupEdit[]>([]);
  const [signupSortField, setSignupSortField] = useState<"name" | "cargo" | "funcao">("name");
  const [signupSortDir, setSignupSortDir] = useState<"asc" | "desc">("asc");
  const [savingModal, setSavingModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("special_events")
      .select(`
        *,
        special_event_days(
          *,
          special_event_day_signups(
            *,
            profiles:user_id(id, display_name)
          )
        )
      `)
      .order("start_date", { ascending: true });

    if (error) { toast.error("Erro ao carregar eventos especiais"); setLoading(false); return; }

    const sorted = (data ?? []).map((ev: any) => ({
      ...ev,
      special_event_days: (ev.special_event_days ?? [])
        .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.sort_order - b.sort_order),
    }));

    setEvents(sorted);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    (supabase as any).from("gdc_hierarchies").select("id, emoji, name, value_per_day, category")
      .order("sort_order").then(({ data }: any) => setGdcHierarchies(data ?? []));
    (supabase as any).from("gdc_roles").select("id, emoji, name, value_per_day, category")
      .order("sort_order").then(({ data }: any) => setGdcRoles(data ?? []));
  }, []);

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

  // ── Inscrição direta no dia ──────────────────────────────────────────────────

  const handleJoinDay = async (dayId: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("special_event_day_signups").insert({
      day_id: dayId,
      user_id: user.id,
      status: "volunteer",
    });
    if (error) {
      if (error.code === "23505") toast.error("Você já está inscrito neste dia");
      else toast.error("Erro ao se inscrever");
      return;
    }
    toast.success("Inscrição registrada!");
    fetchData();
  };

  const handleLeaveDay = async (signupId: string) => {
    const { error } = await (supabase as any).from("special_event_day_signups").delete().eq("id", signupId);
    if (error) { toast.error("Erro ao cancelar inscrição"); return; }
    toast.success("Inscrição cancelada");
    fetchData();
  };

  const handleUpdateMonitorsNeeded = async (dayId: string, value: string) => {
    const num = value.trim() ? parseInt(value) : null;
    const { error } = await (supabase as any)
      .from("special_event_days")
      .update({ monitors_needed: num })
      .eq("id", dayId);
    if (error) toast.error("Erro ao salvar");
    else fetchData();
  };

  const openDayModal = (day: SefDay, category: "gda" | "gdc") => {
    setModalSignups(
      day.special_event_day_signups.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        display_name: s.profiles?.display_name ?? "Monitor",
        status: s.status,
        hierarchy_id: s.hierarchy_id,
        role_id_1: s.role_id_1,
        bonus: s.bonus ?? 0,
      }))
    );
    setDayModalCategory(category);
    setDayModalDate(day.date);
    setDayModalDayId(day.id);
    setSignupSortField("name");
    setSignupSortDir("asc");
  };

  const updateModalSignup = (id: string, field: keyof DaySignupEdit, value: any) => {
    setModalSignups((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const toggleSignupSort = (field: "name" | "cargo" | "funcao") => {
    if (signupSortField === field) {
      setSignupSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSignupSortField(field);
      setSignupSortDir("asc");
    }
  };

  const handleSaveModal = async () => {
    setSavingModal(true);
    try {
      await Promise.all(
        modalSignups.map(async (edit) => {
          const h = gdcHierarchies.find((x) => x.id === edit.hierarchy_id);
          const r = gdcRoles.find((x) => x.id === edit.role_id_1);
          const computed = h || r || edit.bonus > 0
            ? (h?.value_per_day ?? 0) + (r?.value_per_day ?? 0) + edit.bonus
            : null;
          const { error } = await (supabase as any)
            .from("special_event_day_signups")
            .update({
              status: edit.status,
              hierarchy_id: edit.hierarchy_id || null,
              role_id_1: edit.role_id_1 || null,
              bonus: edit.bonus,
              value_per_day: computed,
            })
            .eq("id", edit.id);
          if (error) throw error;
        })
      );
      toast.success("Escala salva!");
      setDayModalDayId(null);
      fetchData();
    } catch {
      toast.error("Erro ao salvar escala");
    } finally {
      setSavingModal(false);
    }
  };

  const handleUpdateDayTime = async (dayId: string, time_start: string, time_end: string) => {
    const { error } = await (supabase as any).from("special_event_days").update({
      time_start: time_start || null,
      time_end: time_end || null,
    }).eq("id", dayId);
    if (error) { toast.error("Erro ao salvar horário"); return; }
    toast.success("Horário salvo!");
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

  const renderDay = (day: SefDay, category: "gda" | "gdc") => {
    const mySignup = day.special_event_day_signups.find((s) => s.user_id === user?.id);
    const overnight = !!(day.time_start && day.time_end && day.time_end <= day.time_start);
    const totalCount = day.special_event_day_signups.length;

    if (isAdmin) {
      const confirmedSignups = day.special_event_day_signups.filter((s) => s.status === "confirmed");
      const totalValue = confirmedSignups.reduce((sum, s) => sum + (s.value_per_day ?? 0), 0);

      return (
        <div
          key={day.id}
          className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
          onClick={() => openDayModal(day, category)}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <h4 className="font-display font-semibold text-sm text-foreground">
              📅 {fmtDateLong(day.date)}
            </h4>
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveDay(day.id); }}
              className="rounded-lg p-1 text-destructive hover:bg-destructive/10"
              title="Remover dia"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Horário */}
          <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 flex-nowrap">
              <input type="time" defaultValue={day.time_start?.slice(0, 5) ?? ""}
                onBlur={(e) => handleUpdateDayTime(day.id, e.target.value, day.time_end?.slice(0, 5) ?? "")}
                className="w-[4.7rem] shrink-0 rounded-md border border-input bg-background px-1 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring" />
              <span className="text-[11px] text-muted-foreground shrink-0">até</span>
              <input type="time" defaultValue={day.time_end?.slice(0, 5) ?? ""}
                onBlur={(e) => handleUpdateDayTime(day.id, day.time_start?.slice(0, 5) ?? "", e.target.value)}
                className="w-[4.7rem] shrink-0 rounded-md border border-input bg-background px-1 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring" />
            </div>
            {overnight && (
              <span className="text-[10px] text-muted-foreground italic self-end">(dia seguinte)</span>
            )}
          </div>

          {/* Info de monitores */}
          <div className="border-t border-border/60 pt-2 space-y-1.5">
            <p className="text-center text-sm font-semibold text-foreground">👥 Monitores</p>
            <div className="flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
              <span className="text-muted-foreground">Necessários:</span>
              <input
                type="number"
                min="0"
                defaultValue={day.monitors_needed ?? ""}
                onBlur={(e) => handleUpdateMonitorsNeeded(day.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-10 rounded border border-input bg-background px-1 py-0.5 text-xs text-center outline-none focus:ring-1 focus:ring-ring"
                placeholder="—"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Escalados/Inscritos:</span>
              <span className="font-semibold text-foreground">
                {confirmedSignups.length}/{totalCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Valor total:</span>
              <span className="font-semibold text-foreground">
                {totalValue > 0 ? `R$ ${totalValue.toFixed(2)}` : "—"}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Monitor view
    const myHier = mySignup ? gdcHierarchies.find((h) => h.id === mySignup.hierarchy_id) : null;
    const myRole = mySignup ? gdcRoles.find((r) => r.id === mySignup.role_id_1) : null;

    const cardCls = !mySignup
      ? "rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5 relative"
      : mySignup.status === "confirmed"
        ? "rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/40 dark:border-green-800 p-3 space-y-1.5 relative"
        : "rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/40 dark:border-yellow-800 p-3 space-y-1.5 relative";

    return (
      <div key={day.id} className={cardCls}>
        {mySignup?.status === "confirmed" && (
          <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-green-500" />
        )}
        <h4 className="font-display font-semibold text-sm text-foreground pr-6">
          📅 {fmtDateLong(day.date)}
        </h4>
        <p className="text-xs text-muted-foreground">
          ⏰ {day.time_start && day.time_end
            ? `${day.time_start.slice(0, 5)} — ${day.time_end.slice(0, 5)}${overnight ? " (dia seguinte)" : ""}`
            : "Horário a definir"}
        </p>

        {mySignup && (
          <div className="border-t border-border/60 pt-1.5 space-y-0.5">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Cargo:</span>{" "}
              {myHier ? `${myHier.emoji} ${myHier.name}` : "A escalar"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Função:</span>{" "}
              {myRole ? `${myRole.emoji} ${myRole.name}` : "A escalar"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Valor/dia:</span>{" "}
              {mySignup.value_per_day != null ? `R$ ${mySignup.value_per_day.toFixed(2)}` : "A definir"}
            </p>
          </div>
        )}

        {!mySignup ? (
          <button onClick={() => handleJoinDay(day.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary hover:bg-primary/5 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Me inscrever
          </button>
        ) : mySignup.status === "volunteer" ? (
          <button onClick={() => handleLeaveDay(mySignup.id)}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-yellow-300 px-2 py-1 text-xs text-yellow-700 hover:bg-yellow-100 transition-colors">
            Cancelar inscrição
          </button>
        ) : null}
      </div>
    );
  };

  const renderSpecialEvent = (ev: SpecialEvent) => {
    const isOpen = expanded.has(ev.id);

    const allSignups = ev.special_event_days.flatMap((d) => d.special_event_day_signups);

    const myTotal = !isAdmin
      ? allSignups
          .filter((s) => s.user_id === user?.id && s.status === "confirmed" && s.value_per_day != null)
          .reduce((sum, s) => sum + (s.value_per_day ?? 0), 0)
      : 0;

    const adminTotal = isAdmin
      ? allSignups
          .filter((s) => s.status === "confirmed" && s.value_per_day != null)
          .reduce((sum, s) => sum + (s.value_per_day ?? 0), 0)
      : 0;

    return (
      <div key={ev.id} className="rounded-xl border-2 border-border bg-card shadow-sm">
        {/* Event header */}
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              ⭐ {ev.title}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                {ev.category}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtDate(ev.start_date)} — {fmtDate(ev.end_date)}
              {ev.notes && <> · <span className="italic">{ev.notes}</span></>}
            </p>
          </div>
          {isOpen && (
            <div className="shrink-0 text-center px-2">
              {!isAdmin && myTotal > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground leading-tight">A receber</p>
                  <p className="text-sm font-bold text-primary leading-tight">R$ {myTotal.toFixed(2)}</p>
                </>
              )}
              {isAdmin && adminTotal > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground leading-tight">Total a pagar</p>
                  <p className="text-sm font-bold text-primary leading-tight">R$ {adminTotal.toFixed(2)}</p>
                </>
              )}
            </div>
          )}
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
              {isOpen ? "Retrair" : "Expandir"}
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isOpen && (
          <div className="border-t border-border p-4 space-y-3">
            {ev.special_event_days.length === 0 && !isAdmin && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dia cadastrado ainda.</p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ev.special_event_days.map((day) => renderDay(day, ev.category))}
            </div>

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

      {/* Admin: escalar monitores modal */}
      <Dialog open={!!dayModalDayId} onOpenChange={(open) => { if (!open) setDayModalDayId(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              📅 {fmtDateLong(dayModalDate)} — Escalar Monitores
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const hierOptions = gdcHierarchies.filter((h) => h.category === dayModalCategory);
            const roleOptions = gdcRoles.filter((r) => r.category === dayModalCategory);

            const sorted = [...modalSignups].sort((a, b) => {
              let va = "", vb = "";
              if (signupSortField === "name") { va = a.display_name; vb = b.display_name; }
              else if (signupSortField === "cargo") {
                va = hierOptions.find((h) => h.id === a.hierarchy_id)?.name ?? "";
                vb = hierOptions.find((h) => h.id === b.hierarchy_id)?.name ?? "";
              } else {
                va = roleOptions.find((r) => r.id === a.role_id_1)?.name ?? "";
                vb = roleOptions.find((r) => r.id === b.role_id_1)?.name ?? "";
              }
              return signupSortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            });

            const sortBtn = (field: "name" | "cargo" | "funcao", label: string) => (
              <button
                onClick={() => toggleSignupSort(field)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
                {signupSortField === field
                  ? signupSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />
                  : <ArrowUpDown className="h-3 w-3 opacity-40" />}
              </button>
            );

            return (
              <div className="space-y-3">
                {modalSignups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum monitor inscrito neste dia.</p>
                ) : (
                  <>
                    <div className="flex gap-2 pb-1.5 border-b border-border">
                      <div className="w-6 shrink-0"></div>
                      <div className="w-28 shrink-0">{sortBtn("name", "Monitor")}</div>
                      <div className="flex-1">{sortBtn("cargo", "Cargo")}</div>
                      <div className="flex-1">{sortBtn("funcao", "Função")}</div>
                      <div className="w-20 shrink-0 text-xs font-semibold text-muted-foreground">Bônus</div>
                      <div className="w-20 shrink-0 text-xs font-semibold text-muted-foreground">Valor/dia</div>
                    </div>
                    <div className="space-y-2">
                      {sorted.map((s) => {
                        const h = hierOptions.find((x) => x.id === s.hierarchy_id);
                        const r = roleOptions.find((x) => x.id === s.role_id_1);
                        const total = (h?.value_per_day ?? 0) + (r?.value_per_day ?? 0) + s.bonus;
                        return (
                          <div key={s.id} className="flex items-center gap-2">
                            <div className="w-6 shrink-0">
                              <input
                                type="checkbox"
                                checked={s.status === "confirmed"}
                                onChange={(e) =>
                                  updateModalSignup(s.id, "status", e.target.checked ? "confirmed" : "volunteer")
                                }
                                className="h-4 w-4 cursor-pointer accent-primary"
                              />
                            </div>
                            <div className="w-28 shrink-0">
                              <p className="text-xs font-semibold text-foreground truncate">{s.display_name}</p>
                            </div>
                            <div className="flex-1">
                              <select
                                value={s.hierarchy_id ?? ""}
                                onChange={(e) => updateModalSignup(s.id, "hierarchy_id", e.target.value || null)}
                                className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                              >
                                <option value="">— Cargo —</option>
                                {hierOptions.map((hOpt) => (
                                  <option key={hOpt.id} value={hOpt.id}>{hOpt.emoji} {hOpt.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1">
                              <select
                                value={s.role_id_1 ?? ""}
                                onChange={(e) => updateModalSignup(s.id, "role_id_1", e.target.value || null)}
                                className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                              >
                                <option value="">— Função —</option>
                                {roleOptions.map((rOpt) => (
                                  <option key={rOpt.id} value={rOpt.id}>{rOpt.emoji} {rOpt.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-20 shrink-0">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground shrink-0">R$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={s.bonus || ""}
                                  onChange={(e) =>
                                    updateModalSignup(s.id, "bonus", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-14 rounded border border-input bg-background px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                                  placeholder="0,00"
                                />
                              </div>
                            </div>
                            <div className="w-20 shrink-0 text-xs font-semibold text-foreground whitespace-nowrap">
                              {total > 0 ? `R$ ${total.toFixed(2)}` : "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button variant="outline" onClick={() => setDayModalDayId(null)}>Cancelar</Button>
                  <Button onClick={handleSaveModal} disabled={savingModal || modalSignups.length === 0}>
                    {savingModal ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                    Salvar Escala
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SpecialEventsPage;

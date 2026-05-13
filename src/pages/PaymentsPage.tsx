import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Banknote, ChevronDown, ChevronUp, Copy, MessageCircle } from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calcHours, formatCurrency, getPeriodLabel } from "@/utils/payments";

// ── Types ──────────────────────────────────────────────────────────────────────

interface EventEntry {
  emId: string;
  eventId: string;
  eventDate: string;
  title: string;
  emoji: string;
  startTime: string;
  endTime: string;
  level: string | null;
  hierarchyName: string;
  hierarchyEmoji: string;
  transportAmount: number;
  noTransport: boolean;
  hours: number;
  eventValue: number;
  transport: number;
  total: number;
}

interface PaymentRecord {
  id: string;
  periodLabel: string;
  calculatedAmount: number;
  adminAmount: number | null;
  status: string;
  notes: string | null;
  monitorNotes: string | null;
  paidAt: string | null;
  monitorConfirmed: boolean;
}

interface MonitorSummary {
  userId: string;
  displayName: string;
  pixKey: string | null;
  events: EventEntry[];
  calculatedTotal: number;
  payment: PaymentRecord | null;
}

// ── Data fetch ─────────────────────────────────────────────────────────────────

async function buildSummaries(filterUserId?: string): Promise<MonitorSummary[]> {
  const today = new Date().toISOString().split("T")[0];

  const [eventsRes, hierarchiesRes, teamsRes, teamRolesRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, emoji, event_date, start_time, end_time, team")
      .lt("event_date", today)
      .eq("is_deleted", false)
      .eq("is_paid", true),
    supabase.from("hierarchies").select("id, slug, name, emoji"),
    supabase.from("teams").select("id, sort_order, name"),
    supabase.from("team_roles").select("id, team_id, hierarchy_id, hourly_rate"),
  ]);

  const pastEvents = eventsRes.data ?? [];
  const hierarchies = hierarchiesRes.data ?? [];
  const teams = teamsRes.data ?? [];
  const teamRoles = teamRolesRes.data ?? [];

  if (!pastEvents.length) return [];

  const eventIds = pastEvents.map((e) => e.id);

  let emQuery = supabase
    .from("event_monitors")
    .select("id, event_id, user_id, level, transport_amount, no_transport")
    .in("event_id", eventIds)
    .eq("is_confirmed", true);
  if (filterUserId) emQuery = emQuery.eq("user_id", filterUserId);

  const { data: eventMonitors } = await emQuery;
  if (!eventMonitors?.length) return [];

  const userIds = filterUserId
    ? [filterUserId]
    : [...new Set(eventMonitors.map((m) => m.user_id))];

  const [profilesWithPix, paymentsRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, pix_key").in("id", userIds),
    supabase.from("monitor_payments").select("*").in("monitor_id", userIds),
  ]);

  let profilesData = profilesWithPix.data;
  if (profilesWithPix.error) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    profilesData = data;
  }

  const eventsMap = Object.fromEntries(pastEvents.map((e) => [e.id, e]));
  const hierarchiesBySlug = Object.fromEntries(hierarchies.map((h) => [h.slug, h]));
  const profilesMap = Object.fromEntries((profilesData ?? []).map((p) => [p.id, p]));

  // Keep the most recent payment record per monitor
  const paymentsMap: Record<string, any> = {};
  for (const p of paymentsRes.data ?? []) {
    const existing = paymentsMap[p.monitor_id];
    if (!existing || p.created_at > existing.created_at) {
      paymentsMap[p.monitor_id] = p;
    }
  }

  const byUser: Record<string, EventEntry[]> = {};
  for (const em of eventMonitors) {
    const event = eventsMap[em.event_id];
    if (!event) continue;

    const hierarchy = em.level ? hierarchiesBySlug[em.level] : null;
    let hourlyRate = 0;
    if (hierarchy && event.team != null) {
      const teamNum = event.team as number;
      const team =
        teams.find((t) => t.sort_order === teamNum - 1) ??
        teams.find((t) => t.sort_order === teamNum);
      if (team) {
        const tr = teamRoles.find(
          (r) => r.team_id === team.id && r.hierarchy_id === hierarchy.id
        );
        if (tr) hourlyRate = tr.hourly_rate ?? 0;
      }
    }

    const hours = calcHours(event.start_time, event.end_time);
    const eventValue = (hourlyRate || 0) * hours || 0;
    const transport = em.no_transport ? 0 : (em.transport_amount ?? 0);

    const entry: EventEntry = {
      emId: em.id,
      eventId: em.event_id,
      eventDate: event.event_date,
      title: event.title,
      emoji: event.emoji,
      startTime: event.start_time,
      endTime: event.end_time,
      level: em.level ?? null,
      hierarchyName: hierarchy?.name ?? (em.level ?? "—"),
      hierarchyEmoji: hierarchy?.emoji ?? "",
      transportAmount: em.transport_amount ?? 0,
      noTransport: em.no_transport ?? false,
      hours,
      eventValue,
      transport,
      total: eventValue + transport,
    };

    if (!byUser[em.user_id]) byUser[em.user_id] = [];
    byUser[em.user_id].push(entry);
  }

  const summaries: MonitorSummary[] = userIds.map((uid) => {
    const profile = profilesMap[uid];
    const events = (byUser[uid] ?? []).sort((a, b) =>
      b.eventDate.localeCompare(a.eventDate)
    );
    const calculatedTotal = events.reduce((s, e) => s + e.total, 0);
    const raw = paymentsMap[uid];

    return {
      userId: uid,
      displayName: profile?.display_name ?? "Monitor",
      pixKey: profile?.pix_key ?? null,
      events,
      calculatedTotal,
      payment: raw
        ? {
            id: raw.id,
            periodLabel: raw.period_label,
            calculatedAmount: raw.calculated_amount,
            adminAmount: raw.admin_amount ?? null,
            status: raw.status,
            notes: raw.notes ?? null,
            monitorNotes: raw.monitor_notes ?? null,
            paidAt: raw.paid_at ?? null,
            monitorConfirmed: raw.monitor_confirmed ?? false,
          }
        : null,
    };
  });

  return summaries.sort((a, b) => {
    const aPaid = a.payment?.status === "paid";
    const bPaid = b.payment?.status === "paid";
    if (aPaid !== bPaid) return aPaid ? 1 : -1;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border-2 border-border bg-card p-4">
          <div className="flex justify-between mb-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-5 w-24 rounded bg-muted" />
          </div>
          <div className="h-4 w-28 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ── Admin view ─────────────────────────────────────────────────────────────────

function AdminView() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["payments-admin"],
    queryFn: () => buildSummaries(),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminAmounts, setAdminAmounts] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showMyWallet, setShowMyWallet] = useState(false);

  useEffect(() => {
    const amounts: Record<string, string> = {};
    const notes: Record<string, string> = {};
    for (const m of monitors) {
      if (m.payment?.adminAmount != null)
        amounts[m.userId] = String(m.payment.adminAmount);
      if (m.payment?.notes) notes[m.userId] = m.payment.notes;
    }
    setAdminAmounts((prev) => ({ ...amounts, ...prev }));
    setAdminNotes((prev) => ({ ...notes, ...prev }));
  }, [monitors]);

  const upsertPayment = async (
    m: MonitorSummary,
    extra: Record<string, unknown> = {}
  ) => {
    const rawAmt = adminAmounts[m.userId];
    const adminAmt =
      rawAmt !== undefined && rawAmt !== ""
        ? parseFloat(rawAmt)
        : null;

    const payload = {
      monitor_id: m.userId,
      period_label: getPeriodLabel(),
      calculated_amount: m.calculatedTotal,
      admin_amount: adminAmt != null && !isNaN(adminAmt) ? adminAmt : null,
      notes: adminNotes[m.userId] ?? null,
      updated_at: new Date().toISOString(),
      ...extra,
    };

    if (m.payment?.id) {
      return supabase
        .from("monitor_payments")
        .update(payload)
        .eq("id", m.payment.id);
    }
    return supabase
      .from("monitor_payments")
      .insert({ ...payload, status: "pending" });
  };

  const handleSave = async (m: MonitorSummary) => {
    setSaving(m.userId);
    const { error } = await upsertPayment(m);
    setSaving(null);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo com sucesso!");
    qc.invalidateQueries({ queryKey: ["payments-admin"] });
  };

  const handleMarkPaid = async (m: MonitorSummary) => {
    const key = m.userId + ":paid";
    setSaving(key);
    const { error } = await upsertPayment(m, {
      status: "paid",
      paid_at: new Date().toISOString(),
    });
    setSaving(null);
    if (error) { toast.error("Erro ao marcar como pago"); return; }
    toast.success("Marcado como pago!");
    qc.invalidateQueries({ queryKey: ["payments-admin"] });
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* My wallet toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Monitores
        </p>
        <Button
          size="sm"
          variant={showMyWallet ? "default" : "outline"}
          onClick={() => setShowMyWallet((v) => !v)}
        >
          💼 Minha Carteira
        </Button>
      </div>

      {showMyWallet && user && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
          <MonitorView userId={user.id} />
        </div>
      )}

      {!monitors.length ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhum monitor com festas passadas confirmadas.
        </p>
      ) : null}

      <div className="space-y-3">
      {monitors.map((monitor) => {
        const expanded = expandedId === monitor.userId;
        const isPaid = monitor.payment?.status === "paid";
        const displayAmount =
          monitor.payment?.adminAmount != null
            ? monitor.payment.adminAmount
            : adminAmounts[monitor.userId]
              ? parseFloat(adminAmounts[monitor.userId]) || monitor.calculatedTotal
              : monitor.calculatedTotal;

        return (
          <Card
            key={monitor.userId}
            className={`border-2 transition-colors ${isPaid ? "border-green-500/30" : "border-border"}`}
          >
            <CardContent className="p-4">
              <button
                className="flex w-full items-center justify-between text-left gap-3"
                onClick={() =>
                  setExpandedId(expanded ? null : monitor.userId)
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display font-bold text-foreground truncate">
                    {monitor.displayName}
                  </span>
                  {isPaid ? (
                    <Badge className="bg-green-500/20 text-green-700 border-green-300 shrink-0">
                      ✅ Pago
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="shrink-0 text-amber-600 border-amber-400"
                    >
                      ⏳ Pendente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-primary">
                    {formatCurrency(displayAmount)}
                  </span>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {expanded && (
                <div className="mt-4 space-y-4">
                  <Separator />

                  {/* Events table */}
                  <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left pb-2 pr-3 font-semibold">Data</th>
                          <th className="text-left pb-2 pr-3 font-semibold">Evento</th>
                          <th className="text-left pb-2 pr-3 font-semibold">Hierarquia</th>
                          <th className="text-right pb-2 pr-3 font-semibold">Horas</th>
                          <th className="text-right pb-2 pr-3 font-semibold">Valor</th>
                          <th className="text-right pb-2 pr-3 font-semibold">Transp.</th>
                          <th className="text-right pb-2 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {monitor.events.map((e) => (
                          <tr key={e.emId}>
                            <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                              {formatDate(e.eventDate)}
                            </td>
                            <td className="py-1.5 pr-3 font-medium">
                              {e.emoji} {e.title}
                            </td>
                            <td className="py-1.5 pr-3 whitespace-nowrap">
                              {e.hierarchyEmoji} {e.hierarchyName}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-muted-foreground">
                              {e.hours.toFixed(1)}h
                            </td>
                            <td className="py-1.5 pr-3 text-right">
                              {formatCurrency(e.eventValue)}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-muted-foreground">
                              {e.noTransport ? "—" : formatCurrency(e.transport)}
                            </td>
                            <td className="py-1.5 text-right font-semibold">
                              {formatCurrency(e.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border">
                          <td
                            colSpan={6}
                            className="pt-2 text-xs font-semibold text-muted-foreground"
                          >
                            Subtotal calculado
                          </td>
                          <td className="pt-2 text-right font-bold text-primary">
                            {formatCurrency(monitor.calculatedTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Admin amount */}
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                          Valor definido pelo admin (opcional)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={monitor.calculatedTotal.toFixed(2)}
                            value={adminAmounts[monitor.userId] ?? ""}
                            onChange={(ev) =>
                              setAdminAmounts((p) => ({
                                ...p,
                                [monitor.userId]: ev.target.value,
                              }))
                            }
                            className={`pl-8 ${adminAmounts[monitor.userId] ? "border-primary/50 bg-primary/5" : ""}`}
                          />
                        </div>
                        {adminAmounts[monitor.userId] && (
                          <p className="mt-1 text-xs text-primary">
                            Valor final:{" "}
                            <strong>
                              {formatCurrency(
                                parseFloat(adminAmounts[monitor.userId]) || 0
                              )}
                            </strong>
                          </p>
                        )}
                      </div>

                      {/* PIX key */}
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                          Chave PIX
                        </label>
                        <div className="rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm min-h-[38px] flex items-center justify-between gap-2">
                          {monitor.pixKey ? (
                            <>
                              <span className="font-mono text-foreground break-all">
                                {monitor.pixKey}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(monitor.pixKey!);
                                  toast.success("PIX copiado!");
                                }}
                                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Copiar chave PIX"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="italic text-muted-foreground">
                              Não cadastrada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Mensagem / Observação
                      </label>
                      <Textarea
                        placeholder="Ex: Pago via PIX em 08/05/2026..."
                        rows={2}
                        value={adminNotes[monitor.userId] ?? ""}
                        onChange={(ev) =>
                          setAdminNotes((p) => ({
                            ...p,
                            [monitor.userId]: ev.target.value,
                          }))
                        }
                      />
                    </div>

                    {monitor.payment?.paidAt && (
                      <p className="text-xs text-muted-foreground">
                        Pago em:{" "}
                        {new Date(monitor.payment.paidAt).toLocaleDateString(
                          "pt-BR"
                        )}
                        {monitor.payment.monitorConfirmed && (
                          <span className="ml-2 text-green-600 font-medium">
                            · Monitor confirmou recebimento
                          </span>
                        )}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(monitor)}
                        disabled={saving === monitor.userId}
                      >
                        {saving === monitor.userId ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMarkPaid(monitor)}
                        disabled={
                          saving === monitor.userId + ":paid" ||
                          isPaid
                        }
                        className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                      >
                        {saving === monitor.userId + ":paid"
                          ? "Salvando..."
                          : "✅ Marcar como Pago"}
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="pointer-events-none"
                            >
                              📎 Enviar Comprovante
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Em breve</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );
}

// ── Monitor view ───────────────────────────────────────────────────────────────

interface LocalTransport {
  amount: number;
  noTransport: boolean;
}

function MonitorView({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ["payments-monitor", userId],
    queryFn: () => buildSummaries(userId),
  });

  const me = summaries[0] ?? null;

  // ── Transport state ──
  const [localTransport, setLocalTransport] = useState<
    Record<string, LocalTransport>
  >({});
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const initialized = useRef(false);

  // ── PIX state ──
  const [editingPix, setEditingPix] = useState(false);
  const [pixInput, setPixInput] = useState("");
  const [savingPix, setSavingPix] = useState(false);

  const handleStartEditPix = () => {
    setPixInput(me?.pixKey ?? "");
    setEditingPix(true);
  };

  const handleSavePix = async () => {
    setSavingPix(true);
    const { error } = await supabase
      .from("profiles")
      .update({ pix_key: pixInput.trim() || null })
      .eq("id", userId);
    setSavingPix(false);
    if (error) { toast.error("Erro ao salvar PIX"); return; }
    toast.success("Chave PIX salva!");
    setEditingPix(false);
    qc.invalidateQueries({ queryKey: ["payments-monitor", userId] });
  };

  useEffect(() => {
    if (!me || initialized.current) return;
    initialized.current = true;
    const init: Record<string, LocalTransport> = {};
    for (const e of me.events) {
      init[e.emId] = { amount: e.transportAmount, noTransport: e.noTransport };
    }
    setLocalTransport(init);
  }, [me]);

  const saveTransport = useCallback(
    async (emId: string, amount: number, noTransport: boolean) => {
      const { error } = await supabase
        .from("event_monitors")
        .update(
          { transport_amount: amount, no_transport: noTransport },
          { count: "exact" }
        )
        .eq("id", emId);
      if (error) { toast.error("Erro ao salvar transporte"); return; }
      toast.success("Transporte salvo!");
      qc.invalidateQueries({ queryKey: ["payments-monitor", userId] });
    },
    [userId, qc]
  );

  const handleTransportChange = useCallback(
    (emId: string, amount: number, noTransport: boolean) => {
      setLocalTransport((prev) => ({
        ...prev,
        [emId]: { amount, noTransport },
      }));
      clearTimeout(debounceRef.current[emId]);
      debounceRef.current[emId] = setTimeout(
        () => saveTransport(emId, amount, noTransport),
        800
      );
    },
    [saveTransport]
  );

  const handleConfirmReceipt = async (paymentId: string) => {
    const { error } = await supabase
      .from("monitor_payments")
      .update({ monitor_confirmed: true })
      .eq("id", paymentId);
    if (error) { toast.error("Erro ao confirmar"); return; }
    toast.success("Recebimento confirmado!");
    qc.invalidateQueries({ queryKey: ["payments-monitor", userId] });
  };

  if (isLoading) return <LoadingSkeleton />;

  const adminAmount = me?.payment?.adminAmount ?? null;
  const totalToReceive = adminAmount ?? me?.calculatedTotal ?? 0;

  const recentPayment = (() => {
    if (!me?.payment || me.payment.status !== "paid" || !me.payment.paidAt)
      return null;
    const diffDays =
      (Date.now() - new Date(me.payment.paidAt).getTime()) /
      (1000 * 60 * 60 * 24);
    return diffDays <= 30 && !me.payment.monitorConfirmed ? me.payment : null;
  })();

  return (
    <div className="space-y-4">
      {/* Total card (with inline PIX) */}
      <Card className="border-2 border-primary/40 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Total a receber
              </p>
              {adminAmount != null ? (
                <div className="space-y-0.5">
                  <div className="flex items-baseline gap-2">
                    <p className="font-display text-3xl font-extrabold text-primary">
                      {formatCurrency(adminAmount)}
                    </p>
                    <span className="text-xs font-semibold text-primary/70 uppercase tracking-wide">
                      Proposta do admin
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-through">
                    {formatCurrency(me?.calculatedTotal ?? 0)}{" "}
                    <span className="no-underline text-xs">calculado</span>
                  </p>
                </div>
              ) : (
                <p className="font-display text-3xl font-extrabold text-primary">
                  {formatCurrency(totalToReceive)}
                </p>
              )}
              {!me?.events.length && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nenhuma festa passada confirmada.
                </p>
              )}

              {/* PIX inline */}
              <div className="mt-3 pt-3 border-t border-primary/20">
                {editingPix ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={pixInput}
                      onChange={(ev) => setPixInput(ev.target.value)}
                      placeholder="CPF, e-mail, telefone ou chave aleatória"
                      className="flex-1 h-7 text-xs"
                      autoFocus
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") handleSavePix();
                        if (ev.key === "Escape") setEditingPix(false);
                      }}
                    />
                    <Button size="sm" className="h-7 text-xs px-2" onClick={handleSavePix} disabled={savingPix}>
                      {savingPix ? "..." : "Salvar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingPix(false)}>
                      Cancelar
                    </Button>
                  </div>
                ) : me?.pixKey ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">💳</span>
                    <span className="font-mono text-xs text-foreground break-all flex-1">{me.pixKey}</span>
                    <button
                      onClick={handleStartEditPix}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0"
                    >
                      Alterar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartEditPix}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    + Cadastrar chave PIX
                  </button>
                )}
              </div>
            </div>
            <Banknote className="h-10 w-10 text-primary/25 shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Admin notes card */}
      {me?.payment?.notes && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <MessageCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
                💬 Observação do Admin
              </p>
              <p className="text-sm italic text-foreground">{me.payment.notes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent payment banner */}
      {recentPayment && (
        <Card className="border-2 border-green-500/40 bg-green-500/5">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-green-700">
                🎉 Você recebeu um pagamento recentemente!
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {recentPayment.notes ??
                  `Pago em ${new Date(recentPayment.paidAt!).toLocaleDateString("pt-BR")}`}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white shrink-0"
              onClick={() => handleConfirmReceipt(recentPayment.id)}
            >
              ✅ Confirmar recebimento
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Event cards */}
      {!!me?.events.length && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Festas passadas
          </p>
          {me.events.map((e) => {
            const local = localTransport[e.emId] ?? {
              amount: e.transportAmount,
              noTransport: e.noTransport,
            };
            const localTransportValue = local.noTransport ? 0 : local.amount;
            const localTotal = e.eventValue + localTransportValue;

            return (
              <Card key={e.emId} className="border-2 border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-bold text-foreground">
                        {e.emoji} {e.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(e.eventDate)} · {e.startTime}–{e.endTime}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-primary">
                        {formatCurrency(localTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {e.hierarchyEmoji} {e.hierarchyName} · {e.hours.toFixed(1)}h
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center gap-2 flex-wrap">
                    <Checkbox
                      id={`no-transport-${e.emId}`}
                      checked={local.noTransport}
                      onCheckedChange={(checked) =>
                        handleTransportChange(e.emId, 0, checked === true)
                      }
                    />
                    <label
                      htmlFor={`no-transport-${e.emId}`}
                      className="text-xs text-muted-foreground cursor-pointer select-none"
                    >
                      Não precisei de transporte
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={local.noTransport}
                      value={local.noTransport ? "" : (local.amount || "")}
                      placeholder={local.noTransport ? "—" : "0,00"}
                      onChange={(ev) =>
                        handleTransportChange(
                          e.emId,
                          parseFloat(ev.target.value) || 0,
                          false
                        )
                      }
                      className="w-24 h-7 text-sm"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="pointer-events-none opacity-60"
                          >
                            📎 Enviar comprovante
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Em breve</TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <main className="px-3 sm:container max-w-3xl mx-auto py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-primary flex items-center gap-2 flex-1">
            <Banknote className="h-5 w-5" />
            Pagamentos
          </h1>
          {isAdmin && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              Visão Admin
            </span>
          )}
        </div>
        {isAdmin ? (
          <AdminView />
        ) : user ? (
          <MonitorView userId={user.id} />
        ) : null}
      </main>
    </div>
  );
}

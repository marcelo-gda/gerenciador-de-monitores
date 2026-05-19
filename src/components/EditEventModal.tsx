import { useState, useEffect } from "react";
import { X, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface EventData {
  id: string;
  type: string;
  title: string;
  event_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  address: string;
  total_slots: number | null;
  is_paid?: boolean;
  force_available?: boolean;
  team?: number | null;
  custom_rates?: Record<string, number> | null;
  observations?: string | null;
}

interface EditEventModalProps {
  event: EventData;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors";
const labelClass = "block text-xs font-semibold text-muted-foreground mb-1";

const EditEventModal = ({ event, onClose, onSaved }: EditEventModalProps) => {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.event_date);
  const [endDate, setEndDate] = useState(event.end_date || "");
  const [startTime, setStartTime] = useState(event.start_time);
  const [endTime, setEndTime] = useState(event.end_time);
  const [address, setAddress] = useState(event.address);
  const [slots, setSlots] = useState(event.total_slots?.toString() || "");
  const [team, setTeam] = useState<number>(event.team || 1);
  const [isPaid, setIsPaid] = useState(event.is_paid !== false);
  const [forceAvailable, setForceAvailable] = useState(event.force_available ?? false);
  const [observations, setObservations] = useState(event.observations || "");

  // Standard hierarchy overrides — populated after hierarchies load
  const [customRates, setCustomRates] = useState<Record<string, number | "">>({});
  // Extra (non-standard) entries from custom_rates
  const [extraRates, setExtraRates] = useState<{ key: string; value: number | "" }[]>([]);

  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [teamRoles, setTeamRoles] = useState<TeamRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRates, setEditingRates] = useState(false);

  const getDurationHours = (): number => {
    const [sh = 0, sm = 0] = startTime.split(":").map(Number);
    const [eh = 0, em = 0] = endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins <= startMins) endMins += 24 * 60;
    return (endMins - startMins) / 60;
  };

  useEffect(() => {
    const load = async () => {
      const [hierRes, rolesRes, teamsRes] = await Promise.all([
        supabase.from("hierarchies").select("id, slug, name, emoji, sort_order").order("sort_order"),
        supabase.from("team_roles").select("team_id, hierarchy_id, hourly_rate"),
        supabase.from("teams").select("id, sort_order"),
      ]);

      const loadedHierarchies = hierRes.data ?? [];
      setHierarchies(loadedHierarchies);
      setTeamRoles(rolesRes.data ?? []);
      setTeams(teamsRes.data ?? []);

      // Split event.custom_rates into:
      // - standard: keys that match a hierarchy slug → shown inline on each hierarchy row
      // - extra: unknown keys → shown as editable extra rows
      const knownSlugs = new Set(loadedHierarchies.map((h) => h.slug));
      const raw = event.custom_rates ?? {};
      const standard: Record<string, number | ""> = {};
      const extra: { key: string; value: number | "" }[] = [];

      for (const [key, val] of Object.entries(raw)) {
        if (knownSlugs.has(key)) {
          standard[key] = val;
        } else {
          extra.push({ key, value: val });
        }
      }

      setCustomRates(standard);
      setExtraRates(extra);
      setDataLoading(false);
    };
    load();
  }, []);

  const getDefaultRate = (hierarchyId: string): number | null => {
    const teamObj =
      teams.find((t) => t.sort_order === team - 1) ?? teams.find((t) => t.sort_order === team);
    if (!teamObj) return null;
    const tr = teamRoles.find((r) => r.team_id === teamObj.id && r.hierarchy_id === hierarchyId);
    return tr?.hourly_rate ?? null;
  };

  const handleSave = async () => {
    if (!title.trim() || !date || !startTime.trim() || !endTime.trim() || !address.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Merge standard overrides + extra entries into one object
    const finalRates: Record<string, number> = {};
    for (const [key, val] of Object.entries(customRates)) {
      if (val !== "" && val !== null) finalRates[key] = Number(val);
    }
    for (const extra of extraRates) {
      if (extra.key.trim() && extra.value !== "") finalRates[extra.key.trim()] = Number(extra.value);
    }

    const payload = {
      title: title.trim(),
      event_date: date,
      end_date: event.type === "camp" && endDate ? endDate : null,
      start_time: startTime.trim(),
      end_time: endTime.trim(),
      address: address.trim(),
      total_slots: slots ? parseInt(slots) : null,
      team,
      is_paid: isPaid,
      force_available: forceAvailable,
      observations: observations.trim() || null,
      custom_rates: Object.keys(finalRates).length > 0 ? finalRates : {},
    };
    console.log("[EditEventModal] payload enviado:", payload);

    setSaving(true);
    const { error } = await supabase.from("events").update(payload).eq("id", event.id);
    setSaving(false);

    if (error) {
      console.error("[EditEventModal] erro do Supabase:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } else {
      toast.success("Evento atualizado!");
      onSaved();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 px-3 pb-3 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border-2 border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">Editar Evento</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Campos básicos */}
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Título *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="Nome da festa"
              />
            </div>
            <div className={`grid gap-3 ${event.type === "camp" ? "grid-cols-2" : "grid-cols-1"}`}>
              <div>
                <label className={labelClass}>Data *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              {event.type === "camp" && (
                <div>
                  <label className={labelClass}>Data fim</label>
                  <input
                    type="date"
                    value={endDate}
                    min={date}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Início *</label>
                <input
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClass}
                  placeholder="14h"
                />
              </div>
              <div>
                <label className={labelClass}>Fim *</label>
                <input
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputClass}
                  placeholder="18h"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Endereço *</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
                placeholder="Endereço"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Vagas (vazio = ilimitado)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={slots}
                  onChange={(e) => setSlots(e.target.value)}
                  className={inputClass}
                  placeholder="∞"
                />
              </div>
              <div>
                <label className={labelClass}>Equipe</label>
                <div className="flex gap-2 mt-1">
                  {[1, 2].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTeam(t)}
                      className={`flex-1 rounded-lg border py-1.5 text-sm font-semibold transition-colors ${
                        team === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t === 1 ? "1️⃣" : "2️⃣"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Remuneração</label>
              <button
                type="button"
                onClick={() => setIsPaid((v) => !v)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors ${
                  isPaid
                    ? "border-camp/40 bg-camp/10 text-camp"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {isPaid ? "💰 Remunerado" : "🤝 Voluntário"}
              </button>
            </div>
            <div>
              <label className={labelClass}>Disponibilidade</label>
              <button
                type="button"
                onClick={() => setForceAvailable((v) => !v)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  forceAvailable
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className={`inline-flex h-4 w-7 items-center rounded-full transition-colors ${forceAvailable ? "bg-primary" : "bg-muted-foreground/30"}`}>
                  <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${forceAvailable ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </span>
                {forceAvailable ? "🔓 Inscrições antecipadas liberadas" : "🔒 Regra padrão (30 dias)"}
              </button>
              <p className="mt-1 text-xs text-muted-foreground">
                Quando ativado, ignora a janela de 30 dias e permite inscrições imediatamente.
              </p>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              📝 Observações
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Visível para todos os monitores no detalhe do evento.
            </p>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className={`${inputClass} min-h-[80px] resize-y`}
              placeholder="Informações importantes para os monitores deste evento..."
            />
          </div>

          {/* Tabela de valores */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">💰 Tabela de valores</span>
                <span className="text-xs text-muted-foreground">(somente para este evento)</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingRates((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                  editingRates
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {editingRates ? "✅ Editando" : "✏️ Editar valores"}
              </button>
            </div>
            {dataLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Hierarquia</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Padrão/h</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Custom/h</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {hierarchies.map((h) => {
                      const defaultRate = getDefaultRate(h.id);
                      const customVal = customRates[h.slug];
                      const effectiveRate =
                        customVal !== undefined && customVal !== "" ? Number(customVal) : (defaultRate ?? 0);
                      const duration = getDurationHours();
                      const computedTotal = effectiveRate * duration;

                      return (
                        <tr key={h.id}>
                          <td className="px-3 py-2 font-medium text-xs">{h.emoji} {h.name}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                            {defaultRate !== null ? `R$ ${defaultRate.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {editingRates ? (
                              <div className="flex items-center justify-end gap-0.5">
                                <span className="text-[10px] text-muted-foreground">R$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="—"
                                  value={customVal ?? ""}
                                  onChange={(e) =>
                                    setCustomRates((prev) => ({
                                      ...prev,
                                      [h.slug]: e.target.value === "" ? "" : Number(e.target.value),
                                    }))
                                  }
                                  className="w-14 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-ring"
                                />
                                <span className="text-[10px] text-muted-foreground">/h</span>
                              </div>
                            ) : (
                              <span className="block text-right text-xs text-muted-foreground">
                                {customVal !== undefined && customVal !== ""
                                  ? `R$ ${Number(customVal).toFixed(2)}`
                                  : <span className="opacity-40">Padrão</span>}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {editingRates ? (
                              <div className="flex items-center justify-end gap-0.5">
                                <span className="text-[10px] text-muted-foreground">R$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="—"
                                  value={duration > 0 && effectiveRate > 0 ? computedTotal.toFixed(2) : ""}
                                  onChange={(e) => {
                                    if (duration <= 0) return;
                                    const total = e.target.value === "" ? "" : Number(e.target.value);
                                    const rate = total !== "" ? Number(total) / duration : "";
                                    setCustomRates((prev) => ({ ...prev, [h.slug]: rate }));
                                  }}
                                  className="w-14 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-ring"
                                />
                              </div>
                            ) : (
                              <span className="block text-right text-xs font-semibold text-foreground">
                                {duration > 0 && effectiveRate > 0
                                  ? `R$ ${computedTotal.toFixed(2)}`
                                  : <span className="text-muted-foreground/40">—</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {extraRates.map((extra, i) => {
                      const duration = getDurationHours();
                      const rate = extra.value !== "" ? Number(extra.value) : 0;
                      return (
                        <tr key={`extra-${i}`}>
                          <td className="px-3 py-2">
                            <input
                              value={extra.key}
                              onChange={(e) =>
                                setExtraRates((prev) =>
                                  prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r))
                                )
                              }
                              placeholder="Nome"
                              className="w-full rounded border border-input bg-background px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground text-xs">—</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-0.5">
                              <span className="text-[10px] text-muted-foreground">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={extra.value}
                                onChange={(e) =>
                                  setExtraRates((prev) =>
                                    prev.map((r, j) =>
                                      j === i ? { ...r, value: e.target.value === "" ? "" : Number(e.target.value) } : r
                                    )
                                  )
                                }
                                className="w-14 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-ring"
                              />
                              <span className="text-[10px] text-muted-foreground">/h</span>
                              <button
                                type="button"
                                onClick={() => setExtraRates((prev) => prev.filter((_, j) => j !== i))}
                                className="ml-0.5 shrink-0 rounded p-1 text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                            {duration > 0 && rate > 0 ? `R$ ${(rate * duration).toFixed(2)}` : <span className="text-muted-foreground/40">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => setExtraRates((prev) => [...prev, { key: "", value: "" }])}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar hierarquia extra
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card px-5 py-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditEventModal;

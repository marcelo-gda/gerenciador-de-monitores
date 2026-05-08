import { useState, useEffect } from "react";
import { Save, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PartySettings {
  id: string;
  incentive_message: string;
  duration_min: number;
  duration_max: number;
  teams_visible_to: string[];
}

interface Hierarchy {
  id: string;
  emoji: string;
  name: string;
  slug: string;
}

interface SpecialRole {
  id: string;
  emoji: string;
  name: string;
  slug: string;
}

interface TeamFormRole {
  id: string;
  emoji: string;
  name: string;
  hourly_rate: number;
  sort_order: number;
  hierarchy_id: string | null;
  role_id: string | null;
}

interface TeamFormState {
  name: string;
  roles: TeamFormRole[];
}

interface Team {
  id: string;
  name: string;
  sort_order: number;
  roles: TeamFormRole[];
}

const NONE = "__none__";

const MasterSettings = ({ readOnly = false }: { readOnly?: boolean }) => {
  const [settings, setSettings] = useState<PartySettings | null>(null);
  const [form, setForm] = useState({
    incentive_message: "",
    duration_min: 3,
    duration_max: 6,
    teams_visible_to: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [specialRoles, setSpecialRoles] = useState<SpecialRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamForms, setTeamForms] = useState<Record<string, TeamFormState>>({});
  const [teamSaving, setTeamSaving] = useState<string | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  // ── Helpers ───────────────────────────────────────────────────────────────

  const computeEmoji = (hId: string | null, rId: string | null): string => {
    const h = hierarchies.find((x) => x.id === hId);
    const r = specialRoles.find((x) => x.id === rId);
    if (h && r) return `${h.emoji}${r.emoji}`;
    if (h) return h.emoji;
    if (r) return r.emoji;
    return "";
  };

  const suggestName = (hId: string | null, rId: string | null): string => {
    const h = hierarchies.find((x) => x.id === hId);
    const r = specialRoles.find((x) => x.id === rId);
    if (h && r) return `${h.name} – ${r.name}`;
    if (h) return h.name;
    if (r) return r.name;
    return "";
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("party_settings")
        .select("*")
        .maybeSingle();
      if (data) {
        const s: PartySettings = {
          id: data.id,
          incentive_message: data.incentive_message,
          duration_min: data.duration_min,
          duration_max: data.duration_max,
          teams_visible_to: data.teams_visible_to ?? [],
        };
        setSettings(s);
        setForm({
          incentive_message: s.incentive_message,
          duration_min: s.duration_min,
          duration_max: s.duration_max,
          teams_visible_to: s.teams_visible_to,
        });
      }
    } catch (err) {
      console.error("fetchSettings error:", err);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .order("sort_order", { ascending: true });
      if (teamsError) {
        console.error("fetchTeams error:", teamsError);
        return;
      }
      const { data: rolesData, error: rolesError } = await supabase
        .from("team_roles")
        .select("*")
        .order("sort_order", { ascending: true });
      if (rolesError) console.error("fetchRoles error:", rolesError);

      const mapped: Team[] = (teamsData || []).map((t) => ({
        ...t,
        roles: (rolesData || [])
          .filter((r) => r.team_id === t.id)
          .map((r) => ({
            id: r.id,
            emoji: r.emoji,
            name: r.name,
            hourly_rate: r.hourly_rate,
            sort_order: r.sort_order,
            hierarchy_id: r.hierarchy_id ?? null,
            role_id: r.role_id ?? null,
          })),
      }));
      setTeams(mapped);

      const forms: Record<string, TeamFormState> = {};
      mapped.forEach((t) => { forms[t.id] = { name: t.name, roles: t.roles }; });
      setTeamForms(forms);
    } catch (err) {
      console.error("fetchTeams exception:", err);
    } finally {
      setTeamsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchTeams();
    supabase
      .from("hierarchies")
      .select("id, emoji, name, slug")
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setHierarchies(data); });
    supabase
      .from("roles")
      .select("id, emoji, name, slug")
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setSpecialRoles(data); });
  }, []);

  // ── Save settings ─────────────────────────────────────────────────────────

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        incentive_message: form.incentive_message,
        duration_min: form.duration_min,
        duration_max: form.duration_max,
        teams_visible_to: form.teams_visible_to,
        updated_at: new Date().toISOString(),
      };
      let error;
      if (settings) {
        ({ error } = await supabase
          .from("party_settings")
          .update(payload)
          .eq("id", settings.id));
      } else {
        ({ error } = await supabase.from("party_settings").insert(payload));
      }
      if (error) {
        toast.error("Erro ao salvar configurações");
      } else {
        toast.success("Configurações salvas!");
        fetchSettings();
      }
    } catch (err) {
      console.error("saveSettings exception:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  // ── Team handlers ─────────────────────────────────────────────────────────

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error("Digite o nome da equipe");
      return;
    }
    try {
      const maxOrder = teams.length > 0 ? Math.max(...teams.map((t) => t.sort_order)) : 0;
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({ name: newTeamName.trim(), sort_order: maxOrder + 1 })
        .select()
        .single();
      if (teamError || !team) {
        toast.error("Erro ao criar equipe");
        return;
      }
      const roles = hierarchies.map((h, idx) => ({
        team_id: team.id,
        emoji: h.emoji,
        name: h.name,
        hierarchy_id: h.id,
        hourly_rate: 0,
        sort_order: idx,
      }));
      if (roles.length > 0) {
        await supabase.from("team_roles").insert(roles);
      }
      toast.success("Equipe criada!");
      setNewTeamName("");
      setAddingTeam(false);
      fetchTeams();
    } catch (err) {
      console.error("handleAddTeam exception:", err);
      toast.error("Erro ao criar equipe");
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Excluir esta equipe e todos os seus cargos?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir equipe");
    } else {
      toast.success("Equipe excluída");
      fetchTeams();
    }
  };

  const handleSaveTeam = async (teamId: string) => {
    const tf = teamForms[teamId];
    if (!tf) return;
    setTeamSaving(teamId);
    try {
      const { error: nameError } = await supabase
        .from("teams")
        .update({ name: tf.name })
        .eq("id", teamId);
      if (nameError) {
        toast.error("Erro ao salvar equipe");
        return;
      }
      for (const role of tf.roles) {
        const { error: roleError } = await supabase
          .from("team_roles")
          .update({
            emoji: role.emoji,
            name: role.name,
            hourly_rate: role.hourly_rate,
            hierarchy_id: role.hierarchy_id || null,
            role_id: role.role_id || null,
          })
          .eq("id", role.id);
        if (roleError) console.error("handleSaveTeam role error:", roleError);
      }
      toast.success("Equipe salva!");
      fetchTeams();
    } catch (err) {
      console.error("handleSaveTeam exception:", err);
      toast.error("Erro ao salvar equipe");
    } finally {
      setTeamSaving(null);
    }
  };

  const updateTeamForm = (teamId: string, patch: Partial<TeamFormState>) => {
    setTeamForms((prev) => ({ ...prev, [teamId]: { ...prev[teamId], ...patch } }));
  };

  const updateTeamRole = (teamId: string, roleIdx: number, patch: Partial<TeamFormRole>) => {
    setTeamForms((prev) => {
      const tf = prev[teamId];
      if (!tf) return prev;
      const roles = [...tf.roles];
      roles[roleIdx] = { ...roles[roleIdx], ...patch };
      return { ...prev, [teamId]: { ...tf, roles } };
    });
  };

  const handleHierarchyChange = (teamId: string, roleIdx: number, hId: string | null) => {
    const cur = teamForms[teamId]?.roles[roleIdx];
    if (!cur) return;
    const emoji = computeEmoji(hId, cur.role_id);
    const name = suggestName(hId, cur.role_id);
    updateTeamRole(teamId, roleIdx, {
      hierarchy_id: hId,
      emoji: emoji || cur.emoji,
      name: name || cur.name,
    });
  };

  const handleSpecialRoleChange = (teamId: string, roleIdx: number, rId: string | null) => {
    const cur = teamForms[teamId]?.roles[roleIdx];
    if (!cur) return;
    const emoji = computeEmoji(cur.hierarchy_id, rId);
    const name = suggestName(cur.hierarchy_id, rId);
    updateTeamRole(teamId, roleIdx, {
      role_id: rId,
      emoji: emoji || cur.emoji,
      name: name || cur.name,
    });
  };

  const toggleVisibility = (slug: string) => {
    setForm((prev) => ({
      ...prev,
      teams_visible_to: prev.teams_visible_to.includes(slug)
        ? prev.teams_visible_to.filter((s) => s !== slug)
        : [...prev.teams_visible_to, slug],
    }));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (readOnly) {
    return (
      <div className="mt-3 space-y-4">
        {settings && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Duração das festas:{" "}
              <span className="font-semibold text-foreground">
                {settings.duration_min}h – {settings.duration_max}h
              </span>
            </p>
            {settings.incentive_message && (
              <p className="font-body text-sm text-card-foreground/80 italic">
                "{settings.incentive_message}"
              </p>
            )}
          </div>
        )}

        {teamsLoading ? (
          <p className="text-sm text-muted-foreground">Carregando equipes...</p>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-lg border border-border bg-background p-3 space-y-2"
              >
                <p className="font-semibold text-sm text-foreground">{team.name}</p>
                <div className="space-y-1">
                  {team.roles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between">
                      <span className="text-sm text-foreground/80">{role.emoji} {role.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        R$ {role.hourly_rate.toFixed(2)}/h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-5">
      {/* Duração das festas */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Duração das festas</Label>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Mínimo</span>
            <div className="relative w-20">
              <Input
                type="number"
                min={1}
                max={24}
                value={form.duration_min}
                onChange={(e) => setForm({ ...form, duration_min: parseInt(e.target.value) || 1 })}
                className="pr-6 text-center"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">h</span>
            </div>
          </div>
          <span className="text-muted-foreground">—</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Máximo</span>
            <div className="relative w-20">
              <Input
                type="number"
                min={1}
                max={24}
                value={form.duration_max}
                onChange={(e) => setForm({ ...form, duration_max: parseInt(e.target.value) || 1 })}
                className="pr-6 text-center"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Equipes */}
      <div className="border-t border-border/60 pt-4 space-y-4">
        <h4 className="font-display text-base font-bold text-foreground">Painel de Equipes</h4>

        {/* Mensagem de incentivo — belongs to the teams section */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Mensagem de incentivo</Label>
          <Textarea
            value={form.incentive_message}
            onChange={(e) => setForm({ ...form, incentive_message: e.target.value })}
            placeholder="Ex: Você faz a diferença em cada festa! Nosso time é incrível. 🚀"
            className="font-body text-sm resize-none overflow-y-auto"
            style={{ minHeight: "4.5rem", maxHeight: "12rem" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 192) + "px";
            }}
          />
        </div>

        {/* Visibility */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quem pode ver este painel
          </Label>
          {hierarchies.length === 0 ? (
            <p className="text-xs text-muted-foreground">Carregando hierarquias...</p>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {hierarchies.map((h) => (
                <label key={h.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <Checkbox
                    checked={form.teams_visible_to.includes(h.slug)}
                    onCheckedChange={() => toggleVisibility(h.slug)}
                  />
                  <span className="text-sm">{h.emoji} {h.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Save settings */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>

        {/* Teams list */}
        {teamsLoading ? (
          <p className="text-sm text-muted-foreground">Carregando equipes...</p>
        ) : (
          <>
            {teams.map((team) => {
              const tf = teamForms[team.id];
              if (!tf) return null;
              return (
                <div
                  key={team.id}
                  className="rounded-lg border border-border bg-card p-3 space-y-3"
                >
                  {/* Team name row */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={tf.name}
                      onChange={(e) => updateTeamForm(team.id, { name: e.target.value })}
                      className="flex-1 font-semibold"
                      placeholder="Nome da equipe"
                    />
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                      title="Excluir equipe"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Role rows */}
                  <div className="space-y-2">
                    {tf.roles.map((role, idx) => (
                      <div
                        key={role.id}
                        className="rounded-md border border-border/60 bg-background p-2 space-y-1.5"
                      >
                        {/* Row 1: emoji + hierarchy + special role */}
                        <div className="flex items-center gap-2">
                          <span
                            className="w-8 shrink-0 text-center text-xl leading-none"
                            title="Emoji automático"
                          >
                            {role.emoji || "?"}
                          </span>
                          <Select
                            value={role.hierarchy_id || ""}
                            onValueChange={(v) => handleHierarchyChange(team.id, idx, v || null)}
                          >
                            <SelectTrigger className="flex-1 h-8 text-xs">
                              <SelectValue placeholder="Hierarquia..." />
                            </SelectTrigger>
                            <SelectContent>
                              {hierarchies.map((h) => (
                                <SelectItem key={h.id} value={h.id}>
                                  {h.emoji} {h.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={role.role_id || NONE}
                            onValueChange={(v) =>
                              handleSpecialRoleChange(team.id, idx, v === NONE ? null : v)
                            }
                          >
                            <SelectTrigger className="flex-1 h-8 text-xs">
                              <SelectValue placeholder="Função esp." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Nenhuma</SelectItem>
                              {specialRoles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.emoji} {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Row 2: name + rate */}
                        <div className="flex items-center gap-2">
                          <Input
                            value={role.name}
                            onChange={(e) =>
                              updateTeamRole(team.id, idx, { name: e.target.value })
                            }
                            placeholder="Nome do cargo"
                            className="flex-1 h-8 text-xs"
                          />
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              R$
                            </span>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={role.hourly_rate}
                              onChange={(e) =>
                                updateTeamRole(team.id, idx, {
                                  hourly_rate: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="h-8 pl-8 pr-6 text-xs"
                              placeholder="0,00"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              /h
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save team */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSaveTeam(team.id)}
                      disabled={teamSaving === team.id}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                      <Save className="h-3 w-3" />
                      {teamSaving === team.id ? "Salvando..." : "Salvar equipe"}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add team */}
            {addingTeam ? (
              <div className="rounded-lg border-2 border-primary bg-card p-3 space-y-2">
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Nome da equipe"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTeam();
                    if (e.key === "Escape") { setAddingTeam(false); setNewTeamName(""); }
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setAddingTeam(false); setNewTeamName(""); }}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3 w-3" /> Cancelar
                  </button>
                  <button
                    onClick={handleAddTeam}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Criar equipe
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingTeam(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Nova equipe
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MasterSettings;

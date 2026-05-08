import { useState, useEffect } from "react";
import { Save, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Hierarchy { id: string; emoji: string; name: string; slug: string; }
interface SpecialRole { id: string; emoji: string; name: string; slug: string; }

interface TeamFormRole {
  id: string; emoji: string; name: string;
  hourly_rate: number; sort_order: number;
  hierarchy_id: string | null; role_id: string | null;
}
interface TeamFormState { name: string; roles: TeamFormRole[]; }
interface Team { id: string; name: string; sort_order: number; roles: TeamFormRole[]; }
interface PartySetting { id: string; duration_min: number; duration_max: number; }

const NONE = "__none__";

const CachePanelExtra = ({ hierarchies }: { hierarchies: Hierarchy[] }) => {
  const [specialRoles, setSpecialRoles] = useState<SpecialRole[]>([]);
  const [partySetting, setPartySetting] = useState<PartySetting | null>(null);
  const [duration, setDuration] = useState({ min: 3, max: 6 });
  const [durationSaving, setDurationSaving] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamForms, setTeamForms] = useState<Record<string, TeamFormState>>({});
  const [teamSaving, setTeamSaving] = useState<string | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  // ── Helpers ───────────────────────────────────────────────────────────────

  const computeEmoji = (hId: string | null, rId: string | null) => {
    const h = hierarchies.find((x) => x.id === hId);
    const r = specialRoles.find((x) => x.id === rId);
    if (h && r) return `${h.emoji}${r.emoji}`;
    if (h) return h.emoji;
    if (r) return r.emoji;
    return "";
  };

  const suggestName = (hId: string | null, rId: string | null) => {
    const h = hierarchies.find((x) => x.id === hId);
    const r = specialRoles.find((x) => x.id === rId);
    if (h && r) return `${h.name} – ${r.name}`;
    if (h) return h.name;
    if (r) return r.name;
    return "";
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchPartySetting = async () => {
    try {
      const { data } = await supabase
        .from("party_settings")
        .select("id, duration_min, duration_max")
        .maybeSingle();
      if (data) {
        setPartySetting({ id: data.id, duration_min: data.duration_min, duration_max: data.duration_max });
        setDuration({ min: data.duration_min, max: data.duration_max });
      }
    } catch (err) {
      console.error("fetchPartySetting error:", err);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .order("sort_order", { ascending: true });
      if (teamsError) { console.error(teamsError); return; }

      const { data: rolesData } = await supabase
        .from("team_roles")
        .select("*")
        .order("sort_order", { ascending: true });

      const mapped: Team[] = (teamsData ?? []).map((t) => ({
        ...t,
        roles: (rolesData ?? [])
          .filter((r) => r.team_id === t.id)
          .map((r) => ({
            id: r.id, emoji: r.emoji, name: r.name,
            hourly_rate: r.hourly_rate, sort_order: r.sort_order,
            hierarchy_id: r.hierarchy_id ?? null,
            role_id: r.role_id ?? null,
          })),
      }));
      setTeams(mapped);

      const forms: Record<string, TeamFormState> = {};
      mapped.forEach((t) => { forms[t.id] = { name: t.name, roles: t.roles }; });
      setTeamForms(forms);
    } catch (err) {
      console.error("fetchTeams error:", err);
    } finally {
      setTeamsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartySetting();
    fetchTeams();
    supabase
      .from("roles")
      .select("id, emoji, name, slug")
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setSpecialRoles(data); });
  }, []);

  // ── Duration ──────────────────────────────────────────────────────────────

  const saveDuration = async () => {
    setDurationSaving(true);
    try {
      const payload = {
        duration_min: duration.min,
        duration_max: duration.max,
        updated_at: new Date().toISOString(),
      };
      const { error } = partySetting
        ? await supabase.from("party_settings").update(payload).eq("id", partySetting.id)
        : await supabase.from("party_settings").insert(payload);
      if (error) toast.error("Erro ao salvar duração");
      else { toast.success("Duração salva!"); fetchPartySetting(); }
    } catch {
      toast.error("Erro ao salvar duração");
    } finally {
      setDurationSaving(false);
    }
  };

  // ── Teams ─────────────────────────────────────────────────────────────────

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) { toast.error("Digite o nome da equipe"); return; }
    try {
      const maxOrder = teams.length > 0 ? Math.max(...teams.map((t) => t.sort_order)) : 0;
      const { data: team, error } = await supabase
        .from("teams")
        .insert({ name: newTeamName.trim(), sort_order: maxOrder + 1 })
        .select()
        .single();
      if (error || !team) { toast.error("Erro ao criar equipe"); return; }
      const roles = hierarchies.map((h, idx) => ({
        team_id: team.id, emoji: h.emoji, name: h.name,
        hierarchy_id: h.id, hourly_rate: 0, sort_order: idx,
      }));
      if (roles.length > 0) await supabase.from("team_roles").insert(roles);
      toast.success("Equipe criada!");
      setNewTeamName("");
      setAddingTeam(false);
      fetchTeams();
    } catch {
      toast.error("Erro ao criar equipe");
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Excluir esta equipe e todos os seus cargos?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir equipe");
    else { toast.success("Equipe excluída"); fetchTeams(); }
  };

  const handleSaveTeam = async (teamId: string) => {
    const tf = teamForms[teamId];
    if (!tf) return;
    setTeamSaving(teamId);
    try {
      const { error: nameErr } = await supabase
        .from("teams").update({ name: tf.name }).eq("id", teamId);
      if (nameErr) { toast.error("Erro ao salvar equipe"); return; }
      for (const role of tf.roles) {
        await supabase.from("team_roles").update({
          emoji: role.emoji, name: role.name,
          hourly_rate: role.hourly_rate,
          hierarchy_id: role.hierarchy_id || null,
          role_id: role.role_id || null,
        }).eq("id", role.id);
      }
      toast.success("Equipe salva!");
      fetchTeams();
    } catch {
      toast.error("Erro ao salvar equipe");
    } finally {
      setTeamSaving(null);
    }
  };

  const updateTeamForm = (teamId: string, patch: Partial<TeamFormState>) =>
    setTeamForms((prev) => ({ ...prev, [teamId]: { ...prev[teamId], ...patch } }));

  const updateRole = (teamId: string, idx: number, patch: Partial<TeamFormRole>) =>
    setTeamForms((prev) => {
      const tf = prev[teamId];
      if (!tf) return prev;
      const roles = [...tf.roles];
      roles[idx] = { ...roles[idx], ...patch };
      return { ...prev, [teamId]: { ...tf, roles } };
    });

  const handleHierarchyChange = (teamId: string, idx: number, hId: string | null) => {
    const cur = teamForms[teamId]?.roles[idx];
    if (!cur) return;
    const emoji = computeEmoji(hId, cur.role_id);
    const name = suggestName(hId, cur.role_id);
    updateRole(teamId, idx, { hierarchy_id: hId, emoji: emoji || cur.emoji, name: name || cur.name });
  };

  const handleSpecialRoleChange = (teamId: string, idx: number, rId: string | null) => {
    const cur = teamForms[teamId]?.roles[idx];
    if (!cur) return;
    const emoji = computeEmoji(cur.hierarchy_id, rId);
    const name = suggestName(cur.hierarchy_id, rId);
    updateRole(teamId, idx, { role_id: rId, emoji: emoji || cur.emoji, name: name || cur.name });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="border-t border-border/60 mt-2 pt-4 space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Duração & Equipes
      </p>

      {/* Duration */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Duração das festas</Label>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Mínimo</span>
            <div className="relative w-20">
              <Input
                type="number" min={1} max={24} value={duration.min}
                onChange={(e) => setDuration((d) => ({ ...d, min: parseInt(e.target.value) || 1 }))}
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
                type="number" min={1} max={24} value={duration.max}
                onChange={(e) => setDuration((d) => ({ ...d, max: parseInt(e.target.value) || 1 }))}
                className="pr-6 text-center"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">h</span>
            </div>
          </div>
          <button
            onClick={saveDuration} disabled={durationSaving}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            <Save className="h-3 w-3" />
            {durationSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Equipes & Cargos</Label>

        {teamsLoading ? (
          <p className="text-xs text-muted-foreground">Carregando equipes...</p>
        ) : (
          <>
            {teams.map((team) => {
              const tf = teamForms[team.id];
              if (!tf) return null;
              return (
                <div key={team.id} className="rounded-lg border border-border bg-background p-3 space-y-3">
                  {/* Team name */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={tf.name}
                      onChange={(e) => updateTeamForm(team.id, { name: e.target.value })}
                      className="flex-1 font-semibold"
                      placeholder="Nome da equipe"
                    />
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                      title="Excluir equipe"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Roles */}
                  <div className="space-y-2">
                    {tf.roles.map((role, idx) => (
                      <div key={role.id} className="rounded-md border border-border/60 bg-card p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-8 shrink-0 text-center text-xl leading-none">{role.emoji || "?"}</span>
                          <Select
                            value={role.hierarchy_id || ""}
                            onValueChange={(v) => handleHierarchyChange(team.id, idx, v || null)}
                          >
                            <SelectTrigger className="flex-1 h-8 text-xs">
                              <SelectValue placeholder="Hierarquia..." />
                            </SelectTrigger>
                            <SelectContent>
                              {hierarchies.map((h) => (
                                <SelectItem key={h.id} value={h.id}>{h.emoji} {h.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={role.role_id || NONE}
                            onValueChange={(v) => handleSpecialRoleChange(team.id, idx, v === NONE ? null : v)}
                          >
                            <SelectTrigger className="flex-1 h-8 text-xs">
                              <SelectValue placeholder="Função esp." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Nenhuma</SelectItem>
                              {specialRoles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>{r.emoji} {r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={role.name}
                            onChange={(e) => updateRole(team.id, idx, { name: e.target.value })}
                            placeholder="Nome do cargo"
                            className="flex-1 h-8 text-xs"
                          />
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">R$</span>
                            <Input
                              type="number" min={0} step={0.01}
                              value={role.hourly_rate}
                              onChange={(e) => updateRole(team.id, idx, { hourly_rate: parseFloat(e.target.value) || 0 })}
                              className="h-8 pl-8 pr-6 text-xs"
                              placeholder="0,00"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">/h</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

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
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3 w-3" /> Cancelar
                  </button>
                  <button
                    onClick={handleAddTeam}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
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

export default CachePanelExtra;

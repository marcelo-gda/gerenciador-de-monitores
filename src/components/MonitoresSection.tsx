import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import MonitorProfileModal from "@/components/MonitorProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Profile {
  id: string;
  display_name: string;
  nickname: string | null;
  identity: string | null;
  hierarchy_ids: string[];
  role_ids: string[];
}

interface Hierarchy { id: string; emoji: string; name: string; slug: string; }
interface SpecialRole { id: string; emoji: string; name: string; slug: string; }

interface EditForm {
  nickname: string;
  identity: string;
  hierarchy_ids: string[];
  role_ids: string[];
}

type SortField = "name";
type SortDir = "asc" | "desc";

const MonitoresSection = () => {
  const { isAdmin } = useAuth();
  const [viewingMonitorId, setViewingMonitorId] = useState<string | null>(null);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [hierarchyFilter, setHierarchyFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    nickname: "", identity: "", hierarchy_ids: [], role_ids: [],
  });

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["monitors-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, nickname, identity, hierarchy_ids, role_ids")
        .eq("status", "approved")
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: hierarchies = [] } = useQuery({
    queryKey: ["hierarchies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hierarchies")
        .select("id, emoji, name, slug")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Hierarchy[];
    },
  });

  const { data: specialRoles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, emoji, name, slug")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialRole[];
    },
  });

  const { data: inscStats = {} } = useQuery({
    queryKey: ["monitors-insc-stats"],
    queryFn: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const nextMonth = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const day = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - day);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      const { data: monthEvents } = await supabase
        .from("events")
        .select("id, event_date")
        .gte("event_date", monthStart)
        .lt("event_date", nextMonth);

      if (!monthEvents?.length) return {};

      const eventIds = monthEvents.map((e: any) => e.id);
      const weekEventIds = new Set(
        monthEvents
          .filter((e: any) => e.event_date >= weekStartStr && e.event_date <= weekEndStr)
          .map((e: any) => e.id)
      );

      const { data } = await supabase
        .from("event_monitors")
        .select("user_id, event_id")
        .in("event_id", eventIds);

      const stats: Record<string, { mes: number; semana: number }> = {};
      (data ?? []).forEach((row: any) => {
        if (!stats[row.user_id]) stats[row.user_id] = { mes: 0, semana: 0 };
        stats[row.user_id].mes += 1;
        if (weekEventIds.has(row.event_id)) stats[row.user_id].semana += 1;
      });
      return stats;
    },
  });

  const { data: adminStats = {} } = useQuery({
    queryKey: ["monitors-admin-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const yearStart = `${year}-01-01`;
      const nextYear = `${year + 1}-01-01`;
      const month = now.getMonth() + 1;
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const nextMonth = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      const { data: yearEvents } = await supabase
        .from("events")
        .select("id, event_date")
        .gte("event_date", yearStart)
        .lt("event_date", nextYear);

      if (!yearEvents?.length) return {};

      const yearEventIds = yearEvents.map((e: any) => e.id);
      const monthEventIds = new Set(
        yearEvents
          .filter((e: any) => e.event_date >= monthStart && e.event_date < nextMonth)
          .map((e: any) => e.id)
      );

      const { data } = await supabase
        .from("event_monitors")
        .select("user_id, event_id")
        .eq("is_confirmed", true)
        .in("event_id", yearEventIds);

      const stats: Record<string, { mes: number; ano: number }> = {};
      (data ?? []).forEach((row: any) => {
        if (!stats[row.user_id]) stats[row.user_id] = { mes: 0, ano: 0 };
        stats[row.user_id].ano += 1;
        if (monthEventIds.has(row.event_id)) stats[row.user_id].mes += 1;
      });
      return stats;
    },
  });

  // ── Mutation ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: EditForm }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          nickname: form.nickname.trim() || null,
          identity: form.identity.trim() || null,
          hierarchy_ids: form.hierarchy_ids,
          role_ids: form.role_ids,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Monitor atualizado!");
      qc.invalidateQueries({ queryKey: ["monitors-profiles"] });
      setEditing(null);
    },
    onError: () => {
      toast.error("Erro ao salvar. Tente novamente.");
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openEdit = (profile: Profile) => {
    setEditing(profile);
    setEditForm({
      nickname: profile.nickname ?? "",
      identity: profile.identity ?? "",
      hierarchy_ids: profile.hierarchy_ids ?? [],
      role_ids: profile.role_ids ?? [],
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const toggleFilter = (key: "hierarchy" | "role", id: string) => {
    if (key === "hierarchy")
      setHierarchyFilter((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    else
      setRoleFilter((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleId = (key: "hierarchy_ids" | "role_ids", id: string) => {
    setEditForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter((x) => x !== id) : [...prev[key], id],
    }));
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const hierarchyById = Object.fromEntries(hierarchies.map((h) => [h.id, h]));
  const roleById = Object.fromEntries(specialRoles.map((r) => [r.id, r]));

  const filteredAndSorted = useMemo(() => {
    let result = [...profiles];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.display_name.toLowerCase().includes(q) ||
          (p.nickname?.toLowerCase().includes(q) ?? false)
      );
    }
    if (hierarchyFilter.length > 0)
      result = result.filter((p) =>
        hierarchyFilter.some((id) => (p.hierarchy_ids ?? []).includes(id))
      );
    if (roleFilter.length > 0)
      result = result.filter((p) =>
        roleFilter.some((id) => (p.role_ids ?? []).includes(id))
      );
    result.sort((a, b) => {
      const cmp = a.display_name.localeCompare(b.display_name, "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [profiles, search, hierarchyFilter, roleFilter, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronsUpDown className="ml-1 inline-block h-3 w-3 text-muted-foreground/40" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 inline-block h-3 w-3" />
      : <ChevronDown className="ml-1 inline-block h-3 w-3" />;
  };

  const colSpan = isAdmin ? 8 : 5;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <h2 className="font-display text-xl font-bold text-foreground whitespace-nowrap">
          👥 Monitores
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Hierarchy filter dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex w-40 items-center justify-between gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors shrink-0">
              <span>
                {hierarchyFilter.length > 0
                  ? `Hierarquia (${hierarchyFilter.length})`
                  : "Hierarquia"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            <div className="space-y-1">
              {hierarchies.map((h) => (
                <label key={h.id} className="flex items-center gap-2 rounded px-1.5 py-1 cursor-pointer hover:bg-muted select-none">
                  <Checkbox
                    checked={hierarchyFilter.includes(h.id)}
                    onCheckedChange={() => toggleFilter("hierarchy", h.id)}
                  />
                  <span className="text-sm">{h.emoji} {h.name}</span>
                </label>
              ))}
              {hierarchyFilter.length > 0 && (
                <button
                  onClick={() => setHierarchyFilter([])}
                  className="mt-1 w-full text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground text-left px-1.5"
                >
                  limpar
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Role filter dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex w-40 items-center justify-between gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors shrink-0">
              <span>
                {roleFilter.length > 0
                  ? `Função (${roleFilter.length})`
                  : "Função"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            <div className="space-y-1">
              {specialRoles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 rounded px-1.5 py-1 cursor-pointer hover:bg-muted select-none">
                  <Checkbox
                    checked={roleFilter.includes(r.id)}
                    onCheckedChange={() => toggleFilter("role", r.id)}
                  />
                  <span className="text-sm">{r.emoji} {r.name}</span>
                </label>
              ))}
              {roleFilter.length > 0 && (
                <button
                  onClick={() => setRoleFilter([])}
                  className="mt-1 w-full text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground text-left px-1.5"
                >
                  limpar
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {filteredAndSorted.length} de {profiles.length} monitor{profiles.length !== 1 ? "es" : ""}
      </p>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse h-14 bg-muted/40" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("name")}>
                  Nome <SortIcon field="name" />
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs">Hierarquias</TableHead>
                <TableHead className="whitespace-nowrap text-xs">Funções</TableHead>
                {isAdmin && (
                  <>
                    <TableHead className="whitespace-nowrap text-center text-xs">Festas/mês</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-xs">Festas/ano</TableHead>
                  </>
                )}
                <TableHead className="whitespace-nowrap text-center text-xs">Inscr./mês</TableHead>
                <TableHead className="whitespace-nowrap text-center text-xs">Inscr./semana</TableHead>
                {isAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-12 text-center text-muted-foreground">
                    Nenhum monitor encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSorted.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="py-2">
                      {isAdmin ? (
                        <button
                          onClick={() => setViewingMonitorId(p.id)}
                          className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                        >
                          <div className="text-xs font-medium text-foreground whitespace-nowrap">{p.display_name}</div>
                          {p.nickname && <div className="text-[10px] text-muted-foreground">@{p.nickname}</div>}
                        </button>
                      ) : (
                        <div>
                          <div className="text-xs font-medium text-foreground whitespace-nowrap">{p.display_name}</div>
                          {p.nickname && <div className="text-[10px] text-muted-foreground">@{p.nickname}</div>}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {(p.hierarchy_ids ?? []).map((id) => { const h = hierarchyById[id]; return h ? (
                          <span key={id} className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary whitespace-nowrap">
                            {h.emoji} {h.name}
                          </span>) : null; })}
                      </div>
                    </TableCell>

                    <TableCell className="py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {(p.role_ids ?? []).map((id) => { const r = roleById[id]; return r ? (
                          <span key={id} className="inline-flex items-center gap-0.5 rounded-full border border-secondary/30 bg-secondary/10 px-1.5 py-0 text-[10px] font-semibold text-secondary whitespace-nowrap">
                            {r.emoji} {r.name}
                          </span>) : null; })}
                      </div>
                    </TableCell>

                    {isAdmin && (
                      <>
                        <TableCell className="text-center text-xs tabular-nums">
                          {adminStats[p.id]?.mes ?? 0}
                        </TableCell>
                        <TableCell className="text-center text-xs tabular-nums">
                          {adminStats[p.id]?.ano ?? 0}
                        </TableCell>
                      </>
                    )}

                    <TableCell className="text-center text-xs tabular-nums">
                      {inscStats[p.id]?.mes ?? 0}
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">
                      {inscStats[p.id]?.semana ?? 0}
                    </TableCell>

                    {isAdmin && (
                      <TableCell className="py-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Editar monitor"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Editar — {editing?.display_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="monitor-nickname">Apelido</Label>
              <Input
                id="monitor-nickname"
                value={editForm.nickname}
                onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                placeholder="Ex: João, Mamão, Ze..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monitor-identity">Identidade</Label>
              <Input
                id="monitor-identity"
                value={editForm.identity}
                onChange={(e) => setEditForm({ ...editForm, identity: e.target.value })}
                placeholder="CPF, RG, identificador interno..."
              />
            </div>

            <div className="space-y-2">
              <Label>Hierarquias</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3 space-y-2">
                {hierarchies.map((h) => (
                  <label key={h.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={editForm.hierarchy_ids.includes(h.id)}
                      onCheckedChange={() => toggleId("hierarchy_ids", h.id)}
                    />
                    <span className="text-sm">{h.emoji} {h.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Funções Especiais</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3 space-y-2">
                {specialRoles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={editForm.role_ids.includes(r.id)}
                      onCheckedChange={() => toggleId("role_ids", r.id)}
                    />
                    <span className="text-sm">{r.emoji} {r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => editing && saveMutation.mutate({ id: editing.id, form: editForm })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {viewingMonitorId && (
        <MonitorProfileModal
          userId={viewingMonitorId}
          onClose={() => setViewingMonitorId(null)}
        />
      )}
    </section>
  );
};

export default MonitoresSection;

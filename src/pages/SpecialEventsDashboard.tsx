import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, LayoutDashboard, Filter } from "lucide-react";
import AppNavbar from "@/components/AppNavbar";

interface GdcHierarchy {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  sort_order: number;
}

interface GdcRole {
  id: string;
  emoji: string;
  name: string;
  slug: string;
}

interface DaySignup {
  id: string;
  day_id: string;
  user_id: string;
  status: string;
  hierarchy_id: string | null;
  role_id_1: string | null;
}

interface SpecialEventDay {
  id: string;
  special_event_id: string;
  date: string;
  sort_order: number;
  time_start: string | null;
  time_end: string | null;
  monitors_needed: number | null;
  signups: DaySignup[];
}

interface SpecialEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  days: SpecialEventDay[];
}

interface Profile {
  id: string;
  display_name: string;
  nickname: string | null;
}

interface MonitorRow {
  user_id: string;
  display_name: string;
  nickname: string | null;
  hierarchy_id: string | null;
  role_id_1: string | null;
  dayIds: Set<string>;
  signupMap: Map<string, DaySignup>;
}

export default function SpecialEventsDashboard() {
  const navigate = useNavigate();
  const { isMasterAdmin } = useAuth();

  const [allEvents, setAllEvents] = useState<SpecialEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [monitors, setMonitors] = useState<MonitorRow[]>([]);
  const [gdcHierarchies, setGdcHierarchies] = useState<GdcHierarchy[]>([]);
  const [gdcRoles, setGdcRoles] = useState<GdcRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [localHierarchy, setLocalHierarchy] = useState<Record<string, string>>({});
  const [localRole, setLocalRole] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<"name" | "days" | "hierarchy">("days");

  if (!isMasterAdmin) {
    navigate("/");
    return null;
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [{ data: hierarchiesData }, { data: rolesData }, { data: eventsData }] =
          await Promise.all([
            supabase
              .from("gdc_hierarchies")
              .select("id, emoji, name, slug, sort_order")
              .order("sort_order"),
            supabase
              .from("gdc_roles")
              .select("id, emoji, name, slug")
              .order("sort_order"),
            supabase
              .from("special_events")
              .select(
                "id, title, start_date, end_date, special_event_days(id, special_event_id, date, sort_order, time_start, time_end, monitors_needed, special_event_day_signups(id, day_id, user_id, status, hierarchy_id, role_id_1))"
              )
              .order("start_date"),
          ]);

        const hierarchies: GdcHierarchy[] = hierarchiesData ?? [];
        const roles: GdcRole[] = rolesData ?? [];

        setGdcHierarchies(hierarchies);
        setGdcRoles(roles);

        const mappedEvents: SpecialEvent[] = (eventsData ?? []).map((ev: any) => ({
          id: ev.id,
          title: ev.title,
          start_date: ev.start_date,
          end_date: ev.end_date,
          days: ((ev.special_event_days ?? []) as any[])
            .map((d: any) => ({
              id: d.id,
              special_event_id: d.special_event_id,
              date: d.date,
              sort_order: d.sort_order,
              time_start: d.time_start,
              time_end: d.time_end,
              monitors_needed: d.monitors_needed,
              signups: (d.special_event_day_signups ?? []) as DaySignup[],
            }))
            .sort((a: SpecialEventDay, b: SpecialEventDay) => a.sort_order - b.sort_order),
        }));

        setAllEvents(mappedEvents);

        const allUserIds = new Set<string>();
        for (const ev of mappedEvents) {
          for (const day of ev.days) {
            for (const signup of day.signups) {
              allUserIds.add(signup.user_id);
            }
          }
        }

        const profileMap: Record<string, { display_name: string; nickname: string | null }> = {};
        if (allUserIds.size > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, display_name, nickname")
            .in("id", Array.from(allUserIds));
          (profilesData ?? []).forEach((p: Profile) => {
            profileMap[p.id] = { display_name: p.display_name ?? p.id, nickname: p.nickname ?? null };
          });
        }

        const juniorHierarchy = hierarchies.find((h) => h.slug === "junior");

        const monitorMap = new Map<string, MonitorRow>();
        for (const ev of mappedEvents) {
          for (const day of ev.days) {
            for (const signup of day.signups) {
              if (signup.status === "rejected") continue;
              let row = monitorMap.get(signup.user_id);
              if (!row) {
                row = {
                  user_id: signup.user_id,
                  display_name: profileMap[signup.user_id]?.display_name ?? signup.user_id,
                  nickname: profileMap[signup.user_id]?.nickname ?? null,
                  hierarchy_id: null,
                  role_id_1: null,
                  dayIds: new Set(),
                  signupMap: new Map(),
                };
                monitorMap.set(signup.user_id, row);
              }
              row.dayIds.add(day.id);
              row.signupMap.set(day.id, signup);
              if (!row.hierarchy_id && signup.hierarchy_id) {
                row.hierarchy_id = signup.hierarchy_id;
              }
              if (!row.role_id_1 && signup.role_id_1) {
                row.role_id_1 = signup.role_id_1;
              }
            }
          }
        }

        for (const row of monitorMap.values()) {
          if (!row.hierarchy_id && juniorHierarchy) {
            row.hierarchy_id = juniorHierarchy.id;
          }
        }

        const rows = Array.from(monitorMap.values());
        setMonitors(rows);

        const initHierarchy: Record<string, string> = {};
        const initRole: Record<string, string> = {};
        for (const row of rows) {
          if (row.hierarchy_id) initHierarchy[row.user_id] = row.hierarchy_id;
          if (row.role_id_1) initRole[row.user_id] = row.role_id_1;
        }
        setLocalHierarchy(initHierarchy);
        setLocalRole(initRole);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const visibleMonitors = useCallback(() => {
    if (selectedEventIds.size === 0) return [];
    const selectedDayIds = new Set<string>();
    for (const ev of allEvents) {
      if (selectedEventIds.has(ev.id)) {
        for (const day of ev.days) selectedDayIds.add(day.id);
      }
    }
    return monitors.filter((m) => {
      for (const dayId of m.dayIds) {
        if (selectedDayIds.has(dayId)) return true;
      }
      return false;
    });
  }, [monitors, allEvents, selectedEventIds]);

  const sortedMonitors = useCallback(() => {
    const rows = visibleMonitors();
    return [...rows].sort((a, b) => {
      if (sortBy === "name") {
        const aName = a.nickname ?? a.display_name;
        const bName = b.nickname ?? b.display_name;
        return aName.localeCompare(bName, "pt-BR");
      }
      if (sortBy === "days") {
        return b.dayIds.size - a.dayIds.size;
      }
      if (sortBy === "hierarchy") {
        const aHier = gdcHierarchies.find((h) => h.id === (localHierarchy[a.user_id] || a.hierarchy_id));
        const bHier = gdcHierarchies.find((h) => h.id === (localHierarchy[b.user_id] || b.hierarchy_id));
        const aOrder = aHier?.sort_order ?? 9999;
        const bOrder = bHier?.sort_order ?? 9999;
        return aOrder - bOrder;
      }
      return 0;
    });
  }, [visibleMonitors, sortBy, gdcHierarchies]);

  function toggleSelectedEvent(evId: string) {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(evId)) next.delete(evId);
      else next.add(evId);
      return next;
    });
  }

  async function toggleStatus(userId: string, dayId: string, signup: DaySignup) {
    const key = `${userId}-${dayId}`;
    const newStatus = signup.status === "confirmed" ? "volunteer" : "confirmed";

    setSaving((prev) => new Set(prev).add(key));
    try {
      const { error } = await supabase
        .from("special_event_day_signups")
        .update({ status: newStatus })
        .eq("id", signup.id);

      if (error) throw error;

      setMonitors((prev) =>
        prev.map((m) => {
          if (m.user_id !== userId) return m;
          const updatedSignupMap = new Map(m.signupMap);
          const existing = updatedSignupMap.get(dayId);
          if (existing) updatedSignupMap.set(dayId, { ...existing, status: newStatus });
          return { ...m, signupMap: updatedSignupMap };
        })
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function changeHierarchy(userId: string, hierarchyId: string) {
    setLocalHierarchy((prev) => ({ ...prev, [userId]: hierarchyId }));

    const monitor = monitors.find((m) => m.user_id === userId);
    if (!monitor) return;

    const dayIds = Array.from(monitor.dayIds).filter((dayId) => {
      for (const ev of allEvents) {
        if (selectedEventIds.has(ev.id)) {
          if (ev.days.some((d) => d.id === dayId)) return true;
        }
      }
      return false;
    });

    if (dayIds.length === 0) return;

    try {
      const { error } = await supabase
        .from("special_event_day_signups")
        .update({ hierarchy_id: hierarchyId || null })
        .eq("user_id", userId)
        .in("day_id", dayIds);

      if (error) throw error;
      toast.success("Cargo atualizado.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar cargo.");
    }
  }

  async function changeRole(userId: string, roleId: string) {
    setLocalRole((prev) => ({ ...prev, [userId]: roleId }));

    const monitor = monitors.find((m) => m.user_id === userId);
    if (!monitor) return;

    const dayIds = Array.from(monitor.dayIds).filter((dayId) => {
      for (const ev of allEvents) {
        if (selectedEventIds.has(ev.id)) {
          if (ev.days.some((d) => d.id === dayId)) return true;
        }
      }
      return false;
    });

    if (dayIds.length === 0) return;

    try {
      const { error } = await supabase
        .from("special_event_day_signups")
        .update({ role_id_1: roleId || null })
        .eq("user_id", userId)
        .in("day_id", dayIds);

      if (error) throw error;
      toast.success("Função atualizada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar função.");
    }
  }

  const sorted = sortedMonitors();

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="mx-auto max-w-[98vw] px-2 py-6">

        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            type="button"
            className="rounded-lg p-2 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Dashboard de Escalação</h1>
        </div>

        {/* Event selector */}
        <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
          <span className="mr-2 self-center text-sm font-semibold text-muted-foreground">
            Eventos:
          </span>
          {allEvents.map((ev) => (
            <button
              type="button"
              key={ev.id}
              onClick={() => toggleSelectedEvent(ev.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                selectedEventIds.has(ev.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {ev.title}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Ordenar:</span>
          {(["days", "name", "hierarchy"] as const).map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                sortBy === opt
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt === "days" ? "Mais dias" : opt === "name" ? "Nome" : "Hierarquia"}
            </button>
          ))}
        </div>

        {/* Table */}
        {selectedEventIds.size === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
            Selecione ao menos um evento para visualizar o dashboard.
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="border-collapse text-sm" style={{ minWidth: "max-content" }}>
              <thead>
                {/* Row 1: Event group headers */}
                <tr className="bg-muted/50">
                  <th className="sticky left-0 z-20 min-w-[160px] border-b border-r border-border bg-muted/50 px-3 py-2 text-left font-semibold">
                    Monitor
                  </th>
                  <th className="sticky left-[160px] z-20 min-w-[130px] border-b border-r border-border bg-muted/50 px-2 py-2 text-left font-semibold">
                    Cargo
                  </th>
                  <th className="sticky left-[290px] z-20 min-w-[130px] border-b border-r border-border bg-muted/50 px-2 py-2 text-left font-semibold">
                    Função
                  </th>
                  {Array.from(selectedEventIds).map((evId) => {
                    const ev = allEvents.find((e) => e.id === evId);
                    if (!ev) return null;
                    return (
                      <th
                        key={evId}
                        colSpan={ev.days.length}
                        className="border-b border-r border-border px-3 py-2 text-center font-display font-bold text-primary"
                      >
                        {ev.title}
                      </th>
                    );
                  })}
                </tr>
                {/* Row 2: Day headers */}
                <tr className="bg-muted/30">
                  <th className="sticky left-0 z-20 border-b border-r border-border bg-muted/30" />
                  <th className="sticky left-[160px] z-20 border-b border-r border-border bg-muted/30" />
                  <th className="sticky left-[290px] z-20 border-b border-r border-border bg-muted/30" />
                  {Array.from(selectedEventIds).map((evId) => {
                    const ev = allEvents.find((e) => e.id === evId);
                    if (!ev) return null;
                    return ev.days.map((day) => (
                      <th
                        key={day.id}
                        className="min-w-[44px] border-b border-r border-border px-2 py-1 text-center text-xs font-medium"
                      >
                        {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </th>
                    ));
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((monitor) => (
                  <tr
                    key={monitor.user_id}
                    className="border-b border-border hover:bg-muted/20"
                  >
                    {/* Name */}
                    <td className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-card px-3 py-1.5 font-medium">
                      {monitor.nickname ?? monitor.display_name}
                    </td>
                    {/* Hierarchy select */}
                    <td className="sticky left-[160px] z-10 border-r border-border bg-card px-2 py-1">
                      <select
                        value={localHierarchy[monitor.user_id] ?? ""}
                        onChange={(e) => changeHierarchy(monitor.user_id, e.target.value)}
                        className="w-full rounded border border-input bg-background px-1.5 py-1 text-xs outline-none"
                      >
                        <option value="">— Cargo —</option>
                        {gdcHierarchies.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.emoji} {h.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {/* Role select */}
                    <td className="sticky left-[290px] z-10 border-r border-border bg-card px-2 py-1">
                      <select
                        value={localRole[monitor.user_id] ?? ""}
                        onChange={(e) => changeRole(monitor.user_id, e.target.value)}
                        className="w-full rounded border border-input bg-background px-1.5 py-1 text-xs outline-none"
                      >
                        <option value="">— Função —</option>
                        {gdcRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.emoji} {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {/* Day cells */}
                    {Array.from(selectedEventIds).map((evId) => {
                      const ev = allEvents.find((e) => e.id === evId);
                      if (!ev) return null;
                      return ev.days.map((day) => {
                        const signup = monitor.signupMap.get(day.id);
                        const isSaving = saving.has(`${monitor.user_id}-${day.id}`);
                        const bgColor = !signup
                          ? "bg-muted/40 cursor-not-allowed"
                          : signup.status === "confirmed"
                          ? "bg-green-500/80 hover:bg-green-500 cursor-pointer"
                          : signup.status === "volunteer"
                          ? "bg-purple-500/80 hover:bg-purple-500 cursor-pointer"
                          : "bg-muted/40";
                        return (
                          <td
                            key={day.id}
                            className="border-r border-border p-1 text-center"
                          >
                            <div
                              onClick={() =>
                                signup && !isSaving && toggleStatus(monitor.user_id, day.id, signup)
                              }
                              className={`mx-auto h-7 w-8 rounded transition-colors ${bgColor} ${isSaving ? "opacity-50" : ""}`}
                            />
                          </td>
                        );
                      });
                    })}
                  </tr>
                ))}
                {/* Total row */}
                <tr className="border-t-2 border-border bg-muted/50 font-bold">
                  <td className="sticky left-0 z-10 border-r border-border bg-muted/50 px-3 py-1.5 text-xs">
                    Total Mon.
                  </td>
                  <td className="sticky left-[160px] z-10 border-r border-border bg-muted/50" />
                  <td className="sticky left-[290px] z-10 border-r border-border bg-muted/50" />
                  {Array.from(selectedEventIds).map((evId) => {
                    const ev = allEvents.find((e) => e.id === evId);
                    if (!ev) return null;
                    return ev.days.map((day) => {
                      const confirmedCount = monitors.filter(
                        (m) => m.signupMap.get(day.id)?.status === "confirmed"
                      ).length;
                      return (
                        <td
                          key={day.id}
                          className="border-r border-border px-1 py-1.5 text-center text-xs text-primary"
                        >
                          {confirmedCount || "—"}
                        </td>
                      );
                    });
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

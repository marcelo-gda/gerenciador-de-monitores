import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

interface MonitorReport {
  user_id: string;
  display_name: string;
  total: number;
  levels: Record<string, number>;
}

const ReportsPage = () => {
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState<MonitorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    const fetchReports = async () => {
      setLoading(true);

      let query = supabase
        .from("event_monitors")
        .select("user_id, is_confirmed, level, event_id")
        .eq("is_confirmed", true);

      // If period filter is set, we need to filter by event date
      let eventIds: string[] | null = null;
      if (periodFilter) {
        const [year, month] = periodFilter.split("-");
        const startDate = `${year}-${month}-01`;
        const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
        const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
        const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

        const { data: events } = await supabase
          .from("events")
          .select("id")
          .gte("event_date", startDate)
          .lt("event_date", endDate);

        eventIds = events?.map((e: any) => e.id) || [];
        if (eventIds.length === 0) { setReports([]); setLoading(false); return; }
      }

      const { data: monitors } = eventIds
        ? await supabase.from("event_monitors").select("user_id, is_confirmed, level, event_id").eq("is_confirmed", true).in("event_id", eventIds)
        : await query;

      if (!monitors) { setLoading(false); return; }

      const userIds = [...new Set(monitors.map((m: any) => m.user_id))];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
        if (profiles) profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.display_name]));
      }

      const reportMap: Record<string, MonitorReport> = {};
      monitors.forEach((m: any) => {
        if (!reportMap[m.user_id]) {
          reportMap[m.user_id] = {
            user_id: m.user_id,
            display_name: profilesMap[m.user_id] || "Monitor",
            total: 0,
            levels: {},
          };
        }
        reportMap[m.user_id].total++;
        if (m.level) {
          reportMap[m.user_id].levels[m.level] = (reportMap[m.user_id].levels[m.level] || 0) + 1;
        }
      });

      setReports(Object.values(reportMap).sort((a, b) => b.total - a.total));
      setLoading(false);
    };
    fetchReports();
  }, [isAdmin, periodFilter]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Acesso negado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex items-center gap-3 py-3">
          <Link to="/admin" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-primary">
            <BarChart3 className="mr-1 inline h-5 w-5" />
            Relatórios
          </h1>
        </div>
      </header>

      <main className="container max-w-3xl py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-semibold text-foreground">Período:</label>
          <input
            type="month"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {periodFilter && (
            <button onClick={() => setPeriodFilter("")} className="text-xs text-primary hover:underline">
              Todos
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : reports.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhum dado encontrado.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r, i) => (
              <div key={r.user_id} className="rounded-lg border-2 border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="font-display font-bold text-foreground">{r.display_name}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-0.5 text-sm font-bold text-primary">
                    {r.total} festa{r.total !== 1 ? "s" : ""}
                  </span>
                </div>
                {Object.keys(r.levels).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(r.levels).map(([level, count]) => (
                      <span key={level} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${levelColors[level] || ""}`}>
                        {count}x {levelLabels[level] || level}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ReportsPage;

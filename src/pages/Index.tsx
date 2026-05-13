import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Info, Plus, LayoutDashboard, LogOut, User, Mail, Trash2, Search, Banknote, History, ClipboardList, LayoutList, CalendarRange } from "lucide-react";
import gdaLogo from "@/assets/gda-logo.png";
import { Link } from "react-router-dom";
import EventCard from "@/components/EventCard";
import InfoSection from "@/components/InfoSection";
import FuncoesSection from "@/components/FuncoesSection";
import MonitoresSection from "@/components/MonitoresSection";
import CreateEventForm from "@/components/CreateEventForm";
import WeekCalendar from "@/components/WeekCalendar";
import MonthCalendar from "@/components/MonthCalendar";
import CalendarEventModal from "@/components/CalendarEventModal";

import MessageButton from "@/components/MessageButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Tab = "escala" | "info" | "especiais" | "funcoes" | "monitores";
type ScaleTab = "open" | "finalized" | "past" | "trash";
type TimeFilter = "all" | "this_week" | "next_week" | "this_month";
type ShiftFilter = "all" | "sun" | "moon" | "camp";

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
  is_deleted?: boolean;
  created_by: string | null;
  team?: number | null;
  monitors: Monitor[];
}

const Index = () => {
  const { user, profile, isAdmin, isSpecialUser, isApproved, signOut, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("escala");
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [scaleTab, setScaleTab] = useState<ScaleTab>("open");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>("all");
  const [myOpenFilter, setMyOpenFilter] = useState(false);
  const [myFinalizedFilter, setMyFinalizedFilter] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "week" | "month">("list");
  const [calendarEvent, setCalendarEvent] = useState<EventData | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });

    if (!eventsData) { setEventsLoading(false); return; }

    const { data: monitorsData } = await supabase
      .from("event_monitors")
      .select("id, event_id, user_id, is_confirmed, level, bonus_tags");

    const userIds = [...new Set((monitorsData || []).map((m: any) => m.user_id))];
    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      if (profiles) profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.display_name]));
    }

    const mapped: EventData[] = eventsData.map((e: any) => ({
      ...e,
      monitors: (monitorsData || [])
        .filter((m: any) => m.event_id === e.id)
        .map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          display_name: profilesMap[m.user_id] || "Monitor",
          is_confirmed: m.is_confirmed || false,
          level: m.level || null,
          bonus_tags: m.bonus_tags || [],
        })),
    }));

    setEvents(mapped);
    setEventsLoading(false);
  }, []);

  // Fetch unread message count for all users
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      if (isAdmin) {
        const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("is_read", false).is("recipient_id", null);
        setUnreadMessages(count || 0);
      } else {
        const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("is_read", false).eq("recipient_id", user.id);
        setUnreadMessages(count || 0);
      }
    };
    fetchUnread();
    const ch = supabase.channel("msg-count").on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchUnread()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, isAdmin]);

  useEffect(() => {
    if (isApproved || isAdmin) {
      fetchEvents();
      const channel = supabase
        .channel("events-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => fetchEvents())
        .on("postgres_changes", { event: "*", schema: "public", table: "event_monitors" }, () => fetchEvents())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isApproved, isAdmin, fetchEvents]);

  // Time filter logic
  const getFilteredByTime = useCallback((list: EventData[]) => {
    if (timeFilter === "all") return list;
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    if (timeFilter === "this_week") {
      const monday = new Date(now); monday.setDate(now.getDate() + mondayOffset); monday.setHours(0,0,0,0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
      return list.filter((e) => { const d = new Date(e.event_date + "T12:00:00"); return d >= monday && d <= sunday; });
    }
    if (timeFilter === "next_week") {
      const nextMonday = new Date(now); nextMonday.setDate(now.getDate() + mondayOffset + 7); nextMonday.setHours(0,0,0,0);
      const nextSunday = new Date(nextMonday); nextSunday.setDate(nextMonday.getDate() + 6); nextSunday.setHours(23,59,59,999);
      return list.filter((e) => { const d = new Date(e.event_date + "T12:00:00"); return d >= nextMonday && d <= nextSunday; });
    }
    if (timeFilter === "this_month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return list.filter((e) => { const d = new Date(e.event_date + "T12:00:00"); return d >= monthStart && d <= monthEnd; });
    }
    return list;
  }, [timeFilter]);

  // Group events by date
  const groupByDate = (list: EventData[]) => {
    const groups: Record<string, EventData[]> = {};
    list.forEach((e) => {
      if (!groups[e.event_date]) groups[e.event_date] = [];
      groups[e.event_date].push(e);
    });
    // Sort events within each date by start_time
    Object.values(groups).forEach((g) => g.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const weekday = d.toLocaleDateString("pt-BR", { weekday: "long" });
    const formatted = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} — ${formatted}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isApproved && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <h1 className="font-display text-2xl font-bold text-primary">🎉 GDA Escalas</h1>
        <div className="rounded-lg border-2 border-border bg-card p-6 text-center max-w-sm">
          <p className="text-lg font-display font-bold text-foreground mb-2">⏳ Conta Pendente</p>
          <p className="text-sm text-muted-foreground">
            Olá, <strong>{profile?.display_name}</strong>! Sua conta está aguardando aprovação de um administrador.
          </p>
        </div>
        <button onClick={signOut} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    );
  }

  const today = new Date(new Date().toDateString());
  const activeEvents = events.filter((e) => !e.is_deleted);
  const deletedEvents = events.filter((e) => e.is_deleted);

  // Apply search and shift filters
  const applyFilters = (list: EventData[]) => {
    let filtered = list;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q) ||
          e.monitors.some((m) => m.display_name.toLowerCase().includes(q))
      );
    }
    if (shiftFilter !== "all") {
      filtered = filtered.filter((e) => e.type === shiftFilter);
    }
    return filtered;
  };

  // Use end_date if available, otherwise event_date. Compare so event only becomes "past" the day AFTER.
  const getEffectiveDate = (e: EventData) => {
    const d = e.end_date || e.event_date;
    // Parse as local date (not UTC) to avoid timezone issues
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  };

  const pastEvents = applyFilters(getFilteredByTime(activeEvents.filter((e) => getEffectiveDate(e) < today)));

  const baseFutureOpen = activeEvents.filter((e) => getEffectiveDate(e) >= today && !(e.is_locked && e.monitors.some((m) => m.is_confirmed)));
  const baseFutureFinalized = activeEvents.filter((e) => getEffectiveDate(e) >= today && e.is_locked && e.monitors.some((m) => m.is_confirmed));

  const futureOpen = applyFilters(getFilteredByTime(
    myOpenFilter && user
      ? baseFutureOpen.filter((e) => e.monitors.some((m) => m.user_id === user.id && !m.is_confirmed))
      : baseFutureOpen
  ));
  const futureFinalized = applyFilters(getFilteredByTime(
    myFinalizedFilter && user
      ? baseFutureFinalized.filter((e) => e.monitors.some((m) => m.user_id === user.id && m.is_confirmed))
      : baseFutureFinalized
  ));

  const calendarEvents =
    scaleTab === "finalized" ? futureFinalized :
    scaleTab === "past" ? pastEvents :
    scaleTab === "trash" ? deletedEvents :
    futureOpen;

  const renderGrouped = (list: EventData[]) => {
    const grouped = groupByDate(list);
    if (grouped.length === 0) return <p className="text-center text-muted-foreground">Nenhuma escala encontrada.</p>;
    return (
      <div className="space-y-5">
        {grouped.map(([date, events]) => (
          <div key={date}>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{formatDateHeader(date)}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-3">
              {events.map((event, i) => (
                <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <EventCard event={event} onRefresh={fetchEvents} />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="px-3 sm:container flex items-center justify-between py-2 sm:py-3">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <img src={gdaLogo} alt="GDA" className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg shrink-0" />
            <h1 className="font-display text-base sm:text-xl font-extrabold text-primary truncate">GDA Escalas</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="hidden sm:inline text-xs text-muted-foreground">{profile?.display_name}</span>
            <Link to="/profile" className="rounded-lg p-1.5 sm:p-2 text-muted-foreground hover:bg-muted" title="Meu Perfil">
              <User className="h-4 w-4" />
            </Link>
            <Link to="/inbox" className="relative rounded-lg p-1.5 sm:p-2 text-muted-foreground hover:bg-muted" title={isAdmin ? "Inbox" : "Notificações"}>
              <Mail className="h-4 w-4" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
            {isAdmin && (
              <Link to="/admin" className="rounded-lg p-1.5 sm:p-2 text-muted-foreground hover:bg-muted" title="Painel de Controle">
                <LayoutDashboard className="h-4 w-4" />
              </Link>
            )}
            <button onClick={signOut} className="rounded-lg p-1.5 sm:p-2 text-muted-foreground hover:bg-muted" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="px-3 sm:container flex items-center gap-1.5 sm:gap-2 pb-2 overflow-x-auto">
          <button
            onClick={() => setTab("escala")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === "escala" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Escala
          </button>
          <button
            onClick={() => setTab("info")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === "info" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Informações
          </button>
          <button
            onClick={() => setTab("especiais")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === "especiais" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            ⭐ Eventos Especiais
          </button>
          <button
            onClick={() => setTab("funcoes")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === "funcoes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            🏅 Funções
          </button>
          <button
            onClick={() => setTab("monitores")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === "monitores" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            👥 Monitores
          </button>
          <Link
            to="/pagamentos"
            className="flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap text-muted-foreground hover:bg-muted"
          >
            <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Pagamentos
          </Link>
        </div>
      </header>

      <main className="px-3 sm:container py-4 sm:py-6">
        {tab === "escala" ? (
          <div className="mx-auto max-w-3xl">
            {/* Sub-tabs */}
            <div className="mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button onClick={() => setScaleTab("open")}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  scaleTab === "open" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}>
                📋 Em Aberto {futureOpen.length > 0 && <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-[10px] sm:text-xs">{futureOpen.length}</span>}
              </button>
              <button onClick={() => setScaleTab("finalized")}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  scaleTab === "finalized" ? "bg-camp text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}>
                <ClipboardList className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Escalados {futureFinalized.length > 0 && <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-[10px] sm:text-xs">{futureFinalized.length}</span>}
              </button>
              <button onClick={() => setScaleTab("past")}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  scaleTab === "past" ? "bg-muted-foreground text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}>
                <History className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Passadas {pastEvents.length > 0 && <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-[10px] sm:text-xs">{pastEvents.length}</span>}
              </button>
              {isAdmin && (
                <button onClick={() => setScaleTab("trash")}
                  className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    scaleTab === "trash" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}>
                  <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Lixeira {deletedEvents.length > 0 && <span className="ml-1 rounded-full bg-destructive-foreground/20 px-1.5 text-[10px] sm:text-xs">{deletedEvents.length}</span>}
                </button>
              )}
              {(isAdmin || isSpecialUser) && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="ml-auto flex items-center gap-1 rounded-full bg-primary px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Nova
                </button>
              )}
            </div>

            {/* Search and shift filter */}
            <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar"
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {([["all", "Todos"], ["sun", "☀️ Tarde"], ["moon", "🌙 Noite"], ["camp", "⛺ Camp"]] as [ShiftFilter, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => setShiftFilter(val)}
                    className={`rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      shiftFilter === val ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted border border-transparent"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Personal toggles + view mode */}
            <div className="mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {scaleTab === "open" && user && (
                <button
                  onClick={() => setMyOpenFilter((v) => !v)}
                  className={`rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                    myOpenFilter ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:bg-muted border-transparent"
                  }`}
                >
                  👤 Minhas Inscrições
                </button>
              )}
              {scaleTab === "finalized" && user && (
                <button
                  onClick={() => setMyFinalizedFilter((v) => !v)}
                  className={`rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                    myFinalizedFilter ? "bg-camp/20 text-camp border-camp/30" : "text-muted-foreground hover:bg-muted border-transparent"
                  }`}
                >
                  ✅ Meus Eventos
                </button>
              )}
              {/* View mode toggle — icons only */}
              <div className="ml-auto flex items-center gap-0.5 rounded-full border border-border bg-muted p-0.5 shrink-0">
                <button
                  onClick={() => setViewMode("list")}
                  title="Lista"
                  className={`rounded-full p-1.5 transition-colors ${
                    viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  title="Semana"
                  className={`rounded-full p-1.5 transition-colors ${
                    viewMode === "week" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("month")}
                  title="Mês"
                  className={`rounded-full p-1.5 transition-colors ${
                    viewMode === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {eventsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg border-2 border-border bg-card p-5">
                    <div className="mb-3 flex justify-between">
                      <div className="h-5 w-2/3 rounded bg-muted" />
                      <div className="h-5 w-16 rounded-full bg-muted" />
                    </div>
                    <div className="mb-3 flex gap-3">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-4 w-32 rounded bg-muted" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-7 w-20 rounded-full bg-muted" />
                      <div className="h-7 w-20 rounded-full bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === "week" ? (
              <WeekCalendar events={calendarEvents} onEventClick={setCalendarEvent} />
            ) : viewMode === "month" ? (
              <MonthCalendar events={calendarEvents} onEventClick={setCalendarEvent} />
            ) : (
              <>
                {scaleTab === "open" && renderGrouped(futureOpen)}
                {scaleTab === "finalized" && renderGrouped(futureFinalized)}
                {scaleTab === "past" && renderGrouped(pastEvents)}
                {scaleTab === "trash" && renderGrouped(deletedEvents)}
              </>
            )}
          </div>
        ) : tab === "info" ? (
          <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <InfoSection />
          </motion.div>
        ) : tab === "funcoes" ? (
          <motion.div key="funcoes" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <FuncoesSection />
          </motion.div>
        ) : tab === "monitores" ? (
          <motion.div key="monitores" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <MonitoresSection />
          </motion.div>
        ) : (
          <motion.div key="especiais" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mx-auto max-w-3xl text-center py-16">
              <span className="text-5xl mb-4 block">🚧</span>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">Eventos Especiais</h2>
              <p className="text-muted-foreground">Em construção</p>
            </div>
          </motion.div>
        )}
      </main>

      {calendarEvent && (
        <CalendarEventModal
          event={calendarEvent}
          onClose={() => setCalendarEvent(null)}
          onRefresh={() => { fetchEvents(); setCalendarEvent(null); }}
        />
      )}
      {showCreateForm && <CreateEventForm onClose={() => setShowCreateForm(false)} onCreated={fetchEvents} />}
      <MessageButton />
    </div>
  );
};

export default Index;

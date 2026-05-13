import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  is_paid?: boolean;
  created_by: string | null;
  team?: number | null;
  monitors: Monitor[];
}

interface DayEvent {
  event: EventData;
  isFirst: boolean;
  isLast: boolean;
}

interface WeekCalendarProps {
  events: EventData[];
  onEventClick: (event: EventData) => void;
}

const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getWeekDays(weekOffset: number): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + toMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toYMD(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

type EventStatus = "open" | "finalized" | "past";

function getEventStatus(event: EventData): EventStatus {
  const [y, m, d] = (event.end_date || event.event_date).split("-").map(Number);
  const today = new Date();
  if (new Date(y, m - 1, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    return "past";
  if (event.is_locked && event.monitors.some((mo) => mo.is_confirmed)) return "finalized";
  return "open";
}

function isGreenEvent(title: string): boolean {
  return /acampamento|gdc/i.test(title);
}

const statusCard: Record<EventStatus, string> = {
  open: "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20",
  finalized: "bg-camp/10 border-camp/40 text-camp hover:bg-camp/20",
  past: "bg-muted/60 border-border text-muted-foreground hover:bg-muted",
};

const greenCard = "bg-green-100 border-green-300 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300";

function getChipColor(event: EventData): string {
  if (isGreenEvent(event.title)) return greenCard;
  return statusCard[getEventStatus(event)];
}

function getRoundedClass(isFirst: boolean, isLast: boolean): string {
  if (isFirst && isLast) return "rounded";
  if (isFirst) return "rounded-l rounded-r-none";
  if (isLast) return "rounded-r rounded-l-none";
  return "rounded-none";
}

const WeekCalendar = ({ events, onEventClick }: WeekCalendarProps) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const todayYMD = useMemo(() => toYMD(new Date()), []);

  const eventsByDate = useMemo(() => {
    const map: Record<string, DayEvent[]> = {};
    for (const day of weekDays) map[toYMD(day)] = [];

    for (const event of events) {
      if (event.is_deleted) continue;
      const startYMD = event.event_date;
      const endYMD = event.end_date || event.event_date;
      const [sy, sm, sd] = startYMD.split("-").map(Number);
      const [ey, em, ed] = endYMD.split("-").map(Number);
      const startDate = new Date(sy, sm - 1, sd);
      const endDate = new Date(ey, em - 1, ed);

      for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const ymd = toYMD(d);
        if (map[ymd] !== undefined) {
          map[ymd].push({ event, isFirst: ymd === startYMD, isLast: ymd === endYMD });
        }
      }
    }

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.event.start_time.localeCompare(b.event.start_time));
    }
    return map;
  }, [events, weekDays]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const todayIdx = weekDays.findIndex((d) => toYMD(d) === todayYMD);
    const targetIdx = todayIdx >= 0 ? todayIdx : 0;
    const colWidth = el.scrollWidth / 7;
    el.scrollLeft = Math.max(0, colWidth * (targetIdx - 1));
  }, [weekOffset, weekDays, todayYMD]);

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const weekLabel =
    weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
    " – " +
    weekEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setWeekOffset((n) => n - 1)}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <span className="text-sm font-semibold text-foreground">{weekLabel}</span>
        <button
          onClick={() => setWeekOffset((n) => n + 1)}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-primary/30 border border-primary/40" />
          Em aberto
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-camp/30 border border-camp/40" />
          Escalado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-green-200 border border-green-300" />
          Acampamento
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-muted border border-border" />
          Passado
        </span>
      </div>

      <div ref={scrollRef} className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 min-w-[700px] sm:min-w-0">
          {weekDays.map((day, i) => {
            const isToday = toYMD(day) === todayYMD;
            return (
              <div key={i} className="flex flex-col items-center pb-1">
                <span className={`text-[11px] font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {DAYS_PT[i]}
                </span>
                <span
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}

          {weekDays.map((day, i) => {
            const ymd = toYMD(day);
            const dayEvents = eventsByDate[ymd] || [];
            const isToday = ymd === todayYMD;

            return (
              <div
                key={`cell-${i}`}
                className={`min-h-[80px] rounded-lg border p-0.5 space-y-0.5 ${
                  isToday ? "border-primary/30 bg-primary/5" : "border-border bg-card/40"
                }`}
              >
                {dayEvents.map(({ event, isFirst, isLast }) => {
                  const colorClass = getChipColor(event);
                  const roundedClass = getRoundedClass(isFirst, isLast);
                  return (
                    <button
                      key={`${event.id}-${ymd}`}
                      onClick={() => onEventClick(event)}
                      className={`block w-full text-left border px-1 py-0.5 text-[10px] leading-tight transition-colors ${colorClass} ${roundedClass}`}
                    >
                      {isFirst ? (
                        <>
                          <div className="font-semibold truncate">{event.emoji} {event.title}</div>
                          <div className="opacity-70">{event.start_time}</div>
                        </>
                      ) : (
                        <div className="truncate opacity-80">{event.emoji}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekCalendar;

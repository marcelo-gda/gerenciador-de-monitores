import { useState, useMemo } from "react";
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

interface MonthCalendarProps {
  events: EventData[];
  onEventClick: (event: EventData) => void;
}

const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const MAX_CHIPS = 3;

function toYMD(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function getMonthWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const dow = firstDay.getDay(); // 0=Sun
  const daysBack = dow === 0 ? 6 : dow - 1;

  const lastDay = new Date(year, month + 1, 0);
  const lastDow = lastDay.getDay();
  const daysForward = lastDow === 0 ? 0 : 7 - lastDow;

  const start = new Date(year, month, 1 - daysBack);
  const end = new Date(year, month + 1, daysForward);

  const weeks: Date[][] = [];
  const current = new Date(start);

  while (current <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function getEventStatus(event: EventData): "open" | "finalized" | "past" {
  const [y, m, d] = (event.end_date || event.event_date).split("-").map(Number);
  const today = new Date();
  if (new Date(y, m - 1, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    return "past";
  if (event.is_locked && event.monitors.some((mo) => mo.is_confirmed)) return "finalized";
  return "open";
}

const chipStyle: Record<"open" | "finalized" | "past", string> = {
  open: "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20",
  finalized: "bg-camp/10 border-camp/20 text-camp hover:bg-camp/20",
  past: "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted",
};

const MonthCalendar = ({ events, onEventClick }: MonthCalendarProps) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const todayYMD = useMemo(() => toYMD(today), []);
  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventData[]> = {};
    for (const event of events) {
      if (!event.is_deleted) {
        if (!map[event.event_date]) map[event.event_date] = [];
        map[event.event_date].push(event);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [events]);

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={prevMonth}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <span className="text-sm font-semibold text-foreground capitalize">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <span className="hidden sm:inline">Próximo</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[560px] sm:min-w-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_PT.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[11px] font-semibold text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Week rows */}
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day, di) => {
                  const ymd = toYMD(day);
                  const isCurrentMonth = day.getMonth() === month;
                  const isToday = ymd === todayYMD;
                  const dayEvents = eventsByDate[ymd] || [];
                  const shown = dayEvents.slice(0, MAX_CHIPS);
                  const extra = dayEvents.length - MAX_CHIPS;

                  return (
                    <div
                      key={di}
                      className={`min-h-[68px] sm:min-h-[80px] rounded-md border p-1 ${
                        isToday
                          ? "border-primary/40 bg-primary/5"
                          : isCurrentMonth
                          ? "border-border bg-card/40"
                          : "border-border/40 bg-muted/10"
                      }`}
                    >
                      {/* Day number */}
                      <div className="mb-0.5 flex">
                        {isToday ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {day.getDate()}
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-semibold ${
                              isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                        )}
                      </div>

                      {/* Event chips */}
                      <div className="space-y-0.5">
                        {shown.map((event) => {
                          const status = getEventStatus(event);
                          return (
                            <button
                              key={event.id}
                              onClick={() => onEventClick(event)}
                              className={`w-full truncate rounded border px-1 py-0.5 text-left text-[10px] leading-tight transition-colors ${chipStyle[status]}`}
                            >
                              {event.emoji} {event.title}
                            </button>
                          );
                        })}
                        {extra > 0 && (
                          <p className="pl-0.5 text-[10px] text-muted-foreground">
                            +{extra} mais
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthCalendar;

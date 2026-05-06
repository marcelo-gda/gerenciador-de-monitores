
const RATES: Record<number, Record<string, number>> = {
  1: { mestre: 45, pleno: 45, junior: 35, trainee: 20 },
  2: { mestre: 150, pleno: 90, junior: 35, trainee: 20 },
};

const LEVEL_EMOJI: Record<string, string> = {
  trainee: "☑️",
  junior: "✅",
  mestre: "👑",
};

const PLENO_EMOJI: Record<number, string> = {
  1: "🌟",
  2: "🔥",
};

const TEAM_EMOJI: Record<number, string> = {
  1: "1️⃣",
  2: "2️⃣",
};

const TYPE_LABEL: Record<string, string> = {
  sun: "Tarde",
  moon: "Noite",
  camp: "Camp",
};

const BONUS_EMOJI: Record<string, string> = {
  protagonista: "🅿️",
  midia: "🎥",
  cronista: "📜",
  sentinela: "🫡",
  transporte: "🚗",
};

interface ReportEvent {
  event_date: string;
  start_time: string;
  end_time: string;
  type: string;
  level: string | null;
  team: number | null;
  bonus_tags: string[];
}

function parseTime(t: string): [number, number] {
  // Handle formats: "14:00", "14h", "14h30", "14:30"
  const cleaned = t.trim().toLowerCase().replace("h", ":");
  const parts = cleaned.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return [h, m];
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = parseTime(start);
  const [eh, em] = parseTime(end);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round(diff / 60);
}

function calcBonusText(tag: string, basePayment: number): string {
  const emoji = BONUS_EMOJI[tag] || tag;
  switch (tag) {
    case "protagonista":
      return `${emoji}${(basePayment * 0.1).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).replace(".", ",")}`;
    case "cronista":
      return `${emoji}15`;
    case "sentinela":
      return `${emoji}`;
    case "midia":
      return `${emoji}`;
    default:
      return emoji;
  }
}

export function generateMonthlyReport(events: ReportEvent[], month: number, year: number): string {
  const filtered = events
    .filter((e) => {
      const d = new Date(e.event_date + "T12:00:00");
      return d.getMonth() === month && d.getFullYear() === year && e.level;
    })
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  if (filtered.length === 0) return "";

  const lines = filtered.map((e) => {
    const d = new Date(e.event_date + "T12:00:00");
    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.getMonth() + 1;
    const duration = calcDuration(e.start_time, e.end_time);
    const typeLabel = TYPE_LABEL[e.type] || e.type;
    const team = e.team || 1;
    const levelEmoji = e.level === "pleno" ? (PLENO_EMOJI[team] || "🌟") : (LEVEL_EMOJI[e.level || ""] || "");
    const teamEmoji = TEAM_EMOJI[team] || "";
    const rate = RATES[team]?.[e.level || ""] || 0;
    const basePayment = rate * duration;

    const bonuses = (e.bonus_tags || []).map((tag) => calcBonusText(tag, basePayment)).filter(Boolean);
    const bonusStr = bonuses.length > 0 ? "+" + bonuses.join("+") : "";

    return `- ${day}/${mon} ${duration}h ${typeLabel} - ${levelEmoji}${teamEmoji}${basePayment}${bonusStr}+🚗R$__`;
  });

  return `Fui Escalado para:\n${lines.join("\n")}`;
}

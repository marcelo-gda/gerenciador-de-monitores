import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, User, Trophy, Calendar, Clock, MapPin, Copy, Check, KeyRound, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateMonthlyReport } from "@/utils/monthlyReport";
import { toast } from "sonner";

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

interface HistoryEvent {
  id: string;
  emoji: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  address: string;
  type: string;
  is_confirmed: boolean;
  level: string | null;
  team: number | null;
  bonus_tags: string[];
}

const typeStyles: Record<string, string> = {
  sun: "border-sun/30 bg-sun-bg",
  moon: "border-moon/30 bg-moon-bg",
  camp: "border-camp/30 bg-camp-bg",
};

const ProfilePage = () => {
  const { profile, user } = useAuth();
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const { refreshProfile } = useAuth();

  const startEditingProfile = () => {
    setEditName(profile?.display_name || "");
    setEditPhone(profile?.phone || "");
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { toast.error("O nome não pode ficar vazio."); return; }
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: editName.trim(), phone: editPhone.trim() || null })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("✅ Perfil atualizado com sucesso!", { duration: 3000 });
      setEditingProfile(false);
      await refreshProfile();
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("A senha deve ter no mínimo 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem."); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else { toast.success("Senha alterada com sucesso!"); setShowChangePw(false); setNewPassword(""); setConfirmPassword(""); }
    setChangingPw(false);
  };

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setLoading(true);
      const { data: monitors } = await supabase
        .from("event_monitors")
        .select("event_id, is_confirmed, level, bonus_tags")
        .eq("user_id", user.id);

      if (!monitors || monitors.length === 0) { setHistory([]); setLoading(false); return; }

      const eventIds = monitors.map((m: any) => m.event_id);
      const dataMap: Record<string, { is_confirmed: boolean; level: string | null; bonus_tags: string[] }> = {};
      monitors.forEach((m: any) => { dataMap[m.event_id] = { is_confirmed: m.is_confirmed, level: m.level || null, bonus_tags: m.bonus_tags || [] }; });

      const { data: events } = await supabase
        .from("events")
        .select("id, emoji, title, event_date, start_time, end_time, address, type, team")
        .in("id", eventIds)
        .order("event_date", { ascending: false });

      if (events) {
        setHistory(events.map((e: any) => ({
          ...e,
          is_confirmed: dataMap[e.id]?.is_confirmed || false,
          level: dataMap[e.id]?.level || null,
          team: e.team || null,
          bonus_tags: dataMap[e.id]?.bonus_tags || [],
        })));
      }
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  const confirmedCount = history.filter((h) => h.is_confirmed).length;

  const levelCounts: Record<string, number> = {};
  history.forEach((h) => {
    if (h.is_confirmed && h.level) {
      levelCounts[h.level] = (levelCounts[h.level] || 0) + 1;
    }
  });

  const handleCopyReport = async () => {
    const now = new Date();
    const report = generateMonthlyReport(history, now.getMonth(), now.getFullYear());
    if (!report) {
      toast.error("Nenhuma festa escalada neste mês.");
      return;
    }
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      toast.success("Reporte copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex items-center gap-3 py-3">
          <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-primary">
            <User className="mr-1 inline h-5 w-5" /> Meu Perfil
          </h1>
        </div>
      </header>

      <main className="container max-w-2xl space-y-6 py-6">
        {/* Profile Card */}
        <div className="rounded-lg border-2 border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {profile?.display_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1">
              {editingProfile ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="tel"
                    placeholder="Telefone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {savingProfile ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      onClick={() => setEditingProfile(false)}
                      className="rounded-lg bg-muted px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted/80"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-card-foreground">{profile?.display_name}</h2>
                    <button onClick={startEditingProfile} className="rounded p-1 text-muted-foreground hover:text-primary" title="Editar perfil">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  {profile?.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    profile?.status === "approved" ? "bg-camp/20 text-camp" : "bg-secondary/20 text-secondary-foreground"
                  }`}>
                    {profile?.status === "approved" ? "✅ Aprovado" : profile?.status === "pending" ? "⏳ Pendente" : "❌ Rejeitado"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border-2 border-border bg-card p-4 text-center">
            <Trophy className="mx-auto mb-1 h-6 w-6 text-secondary" />
            <p className="font-display text-2xl font-bold text-foreground">{confirmedCount}</p>
            <p className="text-xs text-muted-foreground">Festas Confirmadas</p>
          </div>
          <div className="rounded-lg border-2 border-border bg-card p-4 text-center">
            <Calendar className="mx-auto mb-1 h-6 w-6 text-primary" />
            <p className="font-display text-2xl font-bold text-foreground">{history.length}</p>
            <p className="text-xs text-muted-foreground">Total de Inscrições</p>
          </div>
        </div>

        {/* Copy Report Button */}
        <button
          onClick={handleCopyReport}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-primary/30 bg-primary/10 p-3 font-display font-bold text-primary transition-colors hover:bg-primary/20"
        >
          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          {copied ? "Copiado!" : "📋 Copiar Reporte do Mês"}
        </button>

        {/* Change Password */}
        <div className="rounded-lg border-2 border-border bg-card p-4">
          <button
            onClick={() => setShowChangePw(!showChangePw)}
            className="flex w-full items-center gap-2 font-display font-bold text-foreground"
          >
            <KeyRound className="h-5 w-5 text-primary" /> 🔑 Alterar Senha
          </button>
          <AnimatePresence>
            {showChangePw && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 space-y-3">
                  <input
                    type="password"
                    placeholder="Nova senha (mín. 6 caracteres)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="password"
                    placeholder="Confirmar nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPw}
                    className="w-full rounded-lg bg-primary py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {changingPw ? "Salvando..." : "Salvar nova senha"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Level breakdown */}
        {Object.keys(levelCounts).length > 0 && (
          <div className="rounded-lg border-2 border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground mb-2">📊 Cargos Desempenhados</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(levelCounts).map(([level, count]) => (
                <span key={level} className={`rounded-full px-3 py-1 text-sm font-semibold ${levelColors[level] || ""}`}>
                  {count}x {levelLabels[level] || level}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-foreground">📜 Meu Histórico de Festas</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-lg border-2 border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded bg-muted" />
                      <div className="h-4 w-32 rounded bg-muted" />
                    </div>
                    <div className="h-4 w-16 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma inscrição encontrada.</p>
          ) : (
            <div className="space-y-2">
              {history.map((ev) => (
                <div key={ev.id}>
                  <button
                    onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}
                    className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${typeStyles[ev.type] || "border-border bg-card"} hover:shadow-sm`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{ev.emoji}</span>
                        <span className="font-display font-bold text-foreground">{ev.title}</span>
                        {ev.is_confirmed && (
                          <span className="rounded-full bg-camp/20 px-2 py-0.5 text-xs font-semibold text-camp">✅ Escalado</span>
                        )}
                        {ev.is_confirmed && ev.level && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${levelColors[ev.level] || ""}`}>
                            {levelLabels[ev.level] || ev.level}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(ev.event_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedEvent === ev.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="rounded-b-lg border-2 border-t-0 border-border bg-card p-3 text-sm text-muted-foreground">
                          <p className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {ev.start_time} — {ev.end_time}</p>
                          <p className="flex items-center gap-1 mt-1"><MapPin className="h-3.5 w-3.5" /> {ev.address}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ProfilePage;

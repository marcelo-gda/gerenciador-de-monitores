import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, Users, MessageSquare, Send, Trash2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

interface Comment {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
}

const EventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [monitors, setMonitors] = useState<any[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    const [evRes, monRes, comRes] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).single(),
      supabase.from("event_monitors").select("*").eq("event_id", id),
      supabase.from("event_comments").select("*").eq("event_id", id).order("created_at", { ascending: true }),
    ]);

    setEvent(evRes.data);

    const userIds = [...new Set([
      ...(monRes.data || []).map((m: any) => m.user_id),
      ...(comRes.data || []).map((c: any) => c.user_id),
    ])];

    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      if (profiles) profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.display_name]));
    }

    setMonitors((monRes.data || []).map((m: any) => ({ ...m, display_name: profilesMap[m.user_id] || "Monitor" })));
    setComments((comRes.data || []).map((c: any) => ({ ...c, display_name: profilesMap[c.user_id] || "Monitor" })));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleComment = async () => {
    if (!newComment.trim() || !user || !id) return;
    setSending(true);
    const { error } = await supabase.from("event_comments").insert({
      event_id: id,
      user_id: user.id,
      content: newComment.trim(),
    });
    if (error) toast.error("Erro ao enviar comentário");
    else { setNewComment(""); fetchData(); }
    setSending(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from("event_comments").delete().eq("id", commentId);
    fetchData();
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!event) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Evento não encontrado.</p></div>;

  const confirmed = monitors.filter((m) => m.is_confirmed);
  const notConfirmed = monitors.filter((m) => !m.is_confirmed);
  const isUserScaled = monitors.some((m) => m.user_id === user?.id && m.is_confirmed);
  const isUserInEvent = monitors.some((m) => m.user_id === user?.id);
  const canComment = isUserInEvent || isAdmin;

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex items-center gap-3 py-3">
          <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-primary truncate">
            {event.emoji} {event.title}
          </h1>
        </div>
      </header>

      <main className="container max-w-2xl py-6 space-y-6">
        {/* Event Info */}
        <div className="rounded-lg border-2 border-border bg-card p-5 space-y-3">
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {new Date(event.event_date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              {" • "}{event.start_time} — {event.end_time}
            </span>
          </div>
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
            <MapPin className="h-4 w-4" /> {event.address}
          </a>
          {event.description && <p className="text-sm text-foreground">{event.description}</p>}
        </div>

        {/* Monitors */}
        <div className="rounded-lg border-2 border-border bg-card p-5">
          <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> Monitores ({monitors.length})
          </h2>

          {confirmed.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs font-semibold text-camp">✅ Escalados ({confirmed.length})</p>
              {confirmed.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-camp/30 bg-camp/5 p-2">
                  <CheckCircle2 className="h-4 w-4 text-camp shrink-0" />
                  <span className="text-sm font-medium text-foreground">{m.display_name}</span>
                  {m.level && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${levelColors[m.level] || ""}`}>
                      {levelLabels[m.level] || m.level}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {notConfirmed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Inscritos ({notConfirmed.length})</p>
              {notConfirmed.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border p-2 opacity-40">
                  <span className="text-sm text-foreground">{m.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="rounded-lg border-2 border-border bg-card p-5">
          <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Comentários ({comments.length})
          </h2>

          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-3">Nenhum comentário ainda.</p>
          ) : (
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {comments.map((c) => (
                <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">{c.display_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")} {new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {(c.user_id === user?.id || isAdmin) && (
                        <button onClick={() => handleDeleteComment(c.id)} className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
                </motion.div>
              ))}
            </div>
          )}

          {canComment ? (
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva um comentário..."
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
              />
              <button
                onClick={handleComment}
                disabled={sending || !newComment.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Apenas monitores inscritos podem comentar.</p>
          )}
        </div>
      </main>
    </div>
  );
};

export default EventDetailPage;

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Inbox, Mail, MailOpen, CheckCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const InboxPage = () => {
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);

    // Admin sees messages sent TO admin (recipient_id is null = general inbox)
    // Monitor sees messages sent TO them (recipient_id = their id)
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!msgs) { setLoading(false); return; }

    const senderIds = [...new Set(msgs.map((m: any) => m.sender_id))];
    let profilesMap: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", senderIds);
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.display_name]));
      }
    }

    setMessages(msgs.map((m: any) => ({
      ...m,
      sender_name: profilesMap[m.sender_id] || "Admin",
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchMessages();
    const channel = supabase
      .channel("inbox-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("messages").update({ is_read: true }).eq("id", id);
    toast.success("Marcada como lida");
    fetchMessages();
  };

  const markAllRead = async () => {
    if (isAdmin) {
      await supabase.from("messages").update({ is_read: true }).eq("is_read", false).is("recipient_id", null);
    } else {
      await supabase.from("messages").update({ is_read: true }).eq("is_read", false).eq("recipient_id", user!.id);
    }
    toast.success("Todas marcadas como lidas");
    fetchMessages();
  };

  // Filter: admin sees general messages (recipient_id is null), monitors see their messages
  const relevantMessages = isAdmin
    ? messages.filter((m) => m.recipient_id === null)
    : messages.filter((m) => m.recipient_id === user?.id);

  const displayed = filter === "unread" ? relevantMessages.filter((m) => !m.is_read) : relevantMessages;
  const unreadCount = relevantMessages.filter((m) => !m.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex items-center gap-3 py-3">
          <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-primary">
            <Inbox className="mr-1 inline h-5 w-5" />
            {isAdmin ? "Inbox" : "Notificações"}
          </h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </div>
      </header>

      <main className="container max-w-2xl py-6 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Todas ({relevantMessages.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${filter === "unread" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Não lidas ({unreadCount})
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : displayed.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhuma mensagem.</p>
        ) : (
          <div className="space-y-3">
            {displayed.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`rounded-lg border-2 p-4 ${msg.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {!msg.is_read && <span className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />}
                      <span className="font-display font-bold text-foreground">{msg.sender_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleDateString("pt-BR")} {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {!msg.is_read && (
                    <button
                      onClick={() => markAsRead(msg.id)}
                      className="shrink-0 rounded-lg p-2 text-primary hover:bg-primary/10"
                      title="Marcar como lida"
                    >
                      <MailOpen className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default InboxPage;

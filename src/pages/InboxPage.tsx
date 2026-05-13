import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Inbox, MailOpen, CheckCheck } from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  message_type: string;
  related_user_id: string | null;
  // derived from profile joins
  sender_name: string;
  related_user_name: string | null;
  related_user_status: string | null;
}

const InboxPage = () => {
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);

    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!msgs) { setLoading(false); return; }

    // Collect all profile IDs we need (senders + related users)
    const profileIds = [...new Set([
      ...msgs.map((m: any) => m.sender_id),
      ...msgs.filter((m: any) => m.related_user_id).map((m: any) => m.related_user_id as string),
    ])];

    let profilesMap: Record<string, { display_name: string; status: string }> = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, status")
        .in("id", profileIds);
      if (profiles) {
        profiles.forEach((p: any) => {
          profilesMap[p.id] = { display_name: p.display_name, status: p.status };
        });
      }
    }

    setMessages(msgs.map((m: any) => ({
      ...m,
      sender_name: profilesMap[m.sender_id]?.display_name ?? "Admin",
      related_user_name: m.related_user_id
        ? (profilesMap[m.related_user_id]?.display_name ?? null)
        : null,
      related_user_status: m.related_user_id
        ? (profilesMap[m.related_user_id]?.status ?? null)
        : null,
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

  // ── Handlers ─────────────────────────────────────────────────────────────

  const markAsRead = async (id: string) => {
    await supabase.from("messages").update({ is_read: true }).eq("id", id);
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

  const approveUser = async (userId: string, messageId: string) => {
    setProcessing(messageId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "approved" })
      .eq("id", userId);
    if (error) {
      toast.error("Erro ao aprovar usuário");
      setProcessing(null);
      return;
    }
    await supabase.from("messages").update({ is_read: true }).eq("id", messageId);
    toast.success("Usuário aprovado!");
    setProcessing(null);
    fetchMessages();
  };

  const rejectUser = async (userId: string, messageId: string) => {
    setProcessing(messageId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "rejected" })
      .eq("id", userId);
    if (error) {
      toast.error("Erro ao rejeitar usuário");
      setProcessing(null);
      return;
    }
    await supabase.from("messages").update({ is_read: true }).eq("id", messageId);
    toast.warning("Usuário rejeitado");
    setProcessing(null);
    fetchMessages();
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const relevantMessages = isAdmin
    ? messages.filter((m) => m.recipient_id === null)
    : messages.filter((m) => m.recipient_id === user?.id);

  const displayed = filter === "unread"
    ? relevantMessages.filter((m) => !m.is_read)
    : relevantMessages;

  const unreadCount = relevantMessages.filter((m) => !m.is_read).length;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR") + " " +
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <main className="container max-w-2xl py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-primary flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            {isAdmin ? "Inbox" : "Notificações"}
          </h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Todas ({relevantMessages.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === "unread" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Não lidas ({unreadCount})
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>

        {/* Messages */}
        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : displayed.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhuma mensagem.</p>
        ) : (
          <div className="space-y-3">
            {displayed.map((msg, i) => {
              const isApprovalCard = msg.message_type === "pending_approval" && isAdmin;
              const isProcessing = processing === msg.id;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`rounded-lg border-2 p-4 ${
                    msg.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">

                      {isApprovalCard ? (
                        /* ── Approval card ───────────────────────────── */
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            {!msg.is_read && (
                              <span className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />
                            )}
                            <Badge variant="outline" className="text-xs font-semibold border-primary/40 text-primary">
                              🆕 Solicitação de Cadastro
                            </Badge>
                            <span className="text-xs text-muted-foreground">{fmtDate(msg.created_at)}</span>
                          </div>

                          <p className="text-sm font-semibold text-foreground">
                            {msg.related_user_name ?? msg.sender_name}
                          </p>

                          {msg.related_user_status === "approved" ? (
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">
                              ✅ Já aprovado
                            </p>
                          ) : msg.related_user_status === "rejected" ? (
                            <p className="text-sm font-medium text-destructive">
                              ❌ Rejeitado
                            </p>
                          ) : (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => approveUser(msg.related_user_id!, msg.id)}
                                className="h-8 text-xs"
                              >
                                ✅ Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isProcessing}
                                onClick={() => rejectUser(msg.related_user_id!, msg.id)}
                                className="h-8 text-xs"
                              >
                                ❌ Rejeitar
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        /* ── Normal message ──────────────────────────── */
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            {!msg.is_read && (
                              <span className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />
                            )}
                            <span className="font-display font-bold text-foreground">
                              {msg.sender_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fmtDate(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                        </>
                      )}

                    </div>

                    {/* Mark as read — always available if unread */}
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
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default InboxPage;

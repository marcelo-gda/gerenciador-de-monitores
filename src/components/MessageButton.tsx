import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const MessageButton = () => {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (isAdmin) return null;

  const handleSend = async () => {
    if (!message.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      content: message.trim(),
    });
    if (error) {
      toast.error("Erro ao enviar mensagem");
    } else {
      toast.success("Mensagem enviada!");
      setMessage("");
      setOpen(false);
    }
    setSending(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden md:inline">Envie uma mensagem ao Marcelo</span>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-3 sm:p-4">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-md rounded-lg border-2 border-border bg-card p-4 sm:p-5 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">
                  <MessageCircle className="mr-1.5 inline h-5 w-5 text-primary" />
                  Mensagem para o Marcelo
                </h2>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva sua dúvida, aviso ou sugestão..."
                rows={4}
                className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Enviando..." : "Enviar Mensagem"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MessageButton;

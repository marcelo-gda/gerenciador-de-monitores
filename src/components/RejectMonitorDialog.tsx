import { useState } from "react";
import { motion } from "framer-motion";
import { X, AlertTriangle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  eventId: string;
  eventTitle: string;
  monitorUserId: string;
  monitorName: string;
  onClose: () => void;
  onRejected: () => void;
}

const RejectMonitorDialog = ({ eventId, eventTitle, monitorUserId, monitorName, onClose, onRejected }: Props) => {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    if (!user) return;

    setSaving(true);

    // Remove monitor from event
    const { error: delError } = await supabase
      .from("event_monitors")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", monitorUserId);

    if (delError) {
      toast.error("Erro ao remover monitor");
      setSaving(false);
      return;
    }

    // Send rejection message to monitor's inbox
    const { error: msgError } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: monitorUserId,
      content: `⚠️ Sua inscrição em "${eventTitle}" foi recusada.\n\nMotivo: ${reason.trim()}`,
    });

    if (msgError) {
      toast.error("Monitor removido, mas erro ao enviar notificação");
    } else {
      toast.success(`${monitorName} removido e notificado`);
    }

    setSaving(false);
    onRejected();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-lg border-2 border-destructive/30 bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-destructive">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            Rejeitar Inscrição
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          Remover <strong>{monitorName}</strong> de <strong>{eventTitle}</strong>? O motivo será enviado como notificação.
        </p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: Ajuste o bônus selecionado ou entre em contato..."
          rows={3}
          className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-ring"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleReject}
            disabled={saving || !reason.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {saving ? "Enviando..." : "Rejeitar e Notificar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default RejectMonitorDialog;

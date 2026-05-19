import { useState, useEffect } from "react";
import { X, Mail, Phone, CreditCard, User, FileText, Shield, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MonitorProfile {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  nickname: string | null;
  identity: string | null;
  pix_key: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  onClose: () => void;
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  approved: { label: "✅ Aprovado", cls: "bg-camp/20 text-camp" },
  pending:  { label: "⏳ Pendente", cls: "bg-secondary/20 text-secondary-foreground" },
  rejected: { label: "❌ Rejeitado", cls: "bg-destructive/10 text-destructive" },
};

const MonitorProfileModal = ({ userId, onClose }: Props) => {
  const [profile, setProfile] = useState<MonitorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email, phone, nickname, identity, pix_key, status, admin_notes, created_at")
        .eq("id", userId)
        .single();

      if (data) {
        setProfile(data as MonitorProfile);
        setNotes(data.admin_notes || "");
      }

      const { count: total } = await supabase
        .from("event_monitors")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { count: confirmed } = await supabase
        .from("event_monitors")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_confirmed", true);

      setEventCount(total ?? 0);
      setConfirmedCount(confirmed ?? 0);
      setLoading(false);
    };

    fetchData();
  }, [userId]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const { error } = await supabase
      .from("profiles")
      .update({ admin_notes: notes.trim() || null })
      .eq("id", userId);
    if (error) {
      toast.error("Erro ao salvar anotações");
    } else {
      toast.success("Anotações salvas");
      setProfile((prev) => prev ? { ...prev, admin_notes: notes.trim() || null } : prev);
      setEditingNotes(false);
    }
    setSavingNotes(false);
  };

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
        <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-sm text-foreground break-all">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 px-3 pb-3 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border-2 border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">👤 Perfil do Monitor</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : profile ? (
          <div className="p-5 space-y-4">
            {/* Avatar + nome */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {profile.display_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold text-foreground leading-tight">
                  {profile.display_name}
                </h3>
                {profile.nickname && (
                  <p className="text-sm text-muted-foreground">"{profile.nickname}"</p>
                )}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusLabel[profile.status]?.cls ?? ""}`}>
                  {statusLabel[profile.status]?.label ?? profile.status}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="font-display text-xl font-bold text-foreground">{confirmedCount ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Escalados</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="font-display text-xl font-bold text-foreground">{eventCount ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Inscrições</p>
              </div>
            </div>

            {/* Dados de contato */}
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-2">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={profile.phone} />
              <InfoRow icon={<CreditCard className="h-4 w-4" />} label="PIX" value={profile.pix_key} />
              <InfoRow icon={<FileText className="h-4 w-4" />} label="CPF / Identidade" value={profile.identity} />
              <InfoRow icon={<User className="h-4 w-4" />} label="Apelido" value={profile.nickname} />
              <InfoRow
                icon={<Shield className="h-4 w-4" />}
                label="Membro desde"
                value={new Date(profile.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              />
            </div>

            {/* Anotações do admin */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📝 Anotações (admin)</p>
                {!editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="rounded p-1 text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
                    placeholder="Anotações internas sobre este monitor..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> Salvar
                    </button>
                    <button
                      onClick={() => { setEditingNotes(false); setNotes(profile.admin_notes || ""); }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {profile.admin_notes || <span className="text-muted-foreground italic">Nenhuma anotação</span>}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Perfil não encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default MonitorProfileModal;

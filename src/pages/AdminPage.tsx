import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldX, UserCheck, UserX, Users, ArrowLeft, Save, StickyNote, BarChart3, ChevronDown, ChevronRight, RefreshCw, CalendarSync, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface UserWithRole {
  id: string;
  display_name: string;
  phone: string | null;
  status: string;
  roles: string[];
  admin_notes: string | null;
}

const roleLabel: Record<string, string> = {
  admin: "👑 Admin",
  special_user: "⭐ Coordenador",
  normal_user: "👤 Monitor",
};

const roleBadgeClass: Record<string, string> = {
  admin: "bg-primary/20 text-primary",
  special_user: "bg-secondary/40 text-secondary-foreground",
  normal_user: "bg-muted text-muted-foreground",
};

interface UserCardProps {
  u: UserWithRole;
  isAdmin: boolean;
  isSpecialUser: boolean;
  editingProfile: string | null;
  editName: string;
  editPhone: string;
  notesValue: string;
  onSetEditName: (v: string) => void;
  onSetEditPhone: (v: string) => void;
  onStartEdit: (u: UserWithRole) => void;
  onCancelEdit: () => void;
  onSaveProfile: (id: string) => void;
  onUpdateStatus: (id: string, status: "approved" | "rejected") => void;
  onUpdateRole: (id: string, role: string) => void;
  onNotesChange: (id: string, value: string) => void;
  onSaveNotes: (id: string) => void;
  notesChanged: boolean;
}

const UserCard = ({
  u, isAdmin, isSpecialUser, editingProfile, editName, editPhone, notesValue,
  onSetEditName, onSetEditPhone, onStartEdit, onCancelEdit, onSaveProfile,
  onUpdateStatus, onUpdateRole, onNotesChange, onSaveNotes, notesChanged,
}: UserCardProps) => {
  const isEditing = editingProfile === u.id;

  return (
    <div className="rounded-lg border-2 border-border bg-card p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={editName}
                onChange={(e) => onSetEditName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-2 py-1 text-sm outline-none"
                placeholder="Nome"
              />
              <input
                value={editPhone}
                onChange={(e) => onSetEditPhone(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-2 py-1 text-sm outline-none"
                placeholder="WhatsApp"
              />
              <div className="flex gap-2">
                <button onClick={() => onSaveProfile(u.id)} className="rounded-lg bg-camp px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90">
                  <Save className="inline h-3 w-3 mr-1" /> Salvar
                </button>
                <button onClick={onCancelEdit} className="text-xs text-muted-foreground hover:underline">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-display text-base font-bold text-card-foreground">{u.display_name}</p>
              {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <span key={r} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${roleBadgeClass[r] || ""}`}>
                    {roleLabel[r] || r}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {u.status === "pending" && (
            <>
              <button
                onClick={() => onUpdateStatus(u.id, "approved")}
                className="flex items-center gap-1 rounded-lg bg-camp px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <UserCheck className="h-3.5 w-3.5" /> Aprovar
              </button>
              <button
                onClick={() => onUpdateStatus(u.id, "rejected")}
                className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:opacity-90"
              >
                <UserX className="h-3.5 w-3.5" /> Rejeitar
              </button>
            </>
          )}
          {u.status === "rejected" && (
            <button
              onClick={() => onUpdateStatus(u.id, "approved")}
              className="flex items-center gap-1 rounded-lg bg-camp px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <UserCheck className="h-3.5 w-3.5" /> Aprovar
            </button>
          )}
          {isAdmin && !isEditing && (
            <button
              onClick={() => onStartEdit(u)}
              className="rounded-lg border border-input px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              ✏️ Editar
            </button>
          )}
          {isAdmin && (
            <select
              value={u.roles[0] || "normal_user"}
              onChange={(e) => onUpdateRole(u.id, e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none"
            >
              <option value="normal_user">👤 Monitor</option>
              <option value="special_user">⭐ Coordenador</option>
              <option value="admin">👑 Admin</option>
            </select>
          )}
        </div>
      </div>

      {/* Admin Notes */}
      {(isAdmin || isSpecialUser) && (
        <div className="border-t border-border pt-3">
          <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <StickyNote className="h-3 w-3" /> Notas do Admin
          </label>
          <textarea
            value={notesValue}
            onChange={(e) => onNotesChange(u.id, e.target.value)}
            placeholder="Observações internas..."
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none resize-none"
          />
          {notesChanged && (
            <button
              onClick={() => onSaveNotes(u.id)}
              className="mt-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Salvar Notas
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const GoogleCalendarSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ synced_at: string; events_created: number; events_updated: number; status: string; error_message?: string } | null>(null);

  const fetchLastSync = async () => {
    const { data } = await supabase
      .from("google_calendar_sync_log")
      .select("*")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setLastSync(data as any);
  };

  useEffect(() => { fetchLastSync(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-calendar");
      if (error) throw error;
      if (data?.success) {
        toast.success(`Sincronizado! ${data.events_created} criados, ${data.events_updated} atualizados`);
      } else {
        toast.error(data?.error || "Erro na sincronização");
      }
      fetchLastSync();
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + (err.message || "desconhecido"));
    }
    setSyncing(false);
  };

  return (
    <section className="rounded-lg border-2 border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarSync className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold text-foreground">Google Agenda</h2>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {syncing ? "Sincronizando..." : "Sincronizar Agora"}
        </button>
      </div>
      {lastSync && (
        <div className="text-xs text-muted-foreground">
          <p>
            Última sincronização: {new Date(lastSync.synced_at).toLocaleString("pt-BR")}
            {" — "}
            <span className={lastSync.status === "success" ? "text-camp" : "text-destructive"}>
              {lastSync.status === "success" ? "✅ Sucesso" : "❌ Erro"}
            </span>
          </p>
          {lastSync.status === "success" && (
            <p>{lastSync.events_created} criados, {lastSync.events_updated} atualizados</p>
          )}
          {lastSync.error_message && (
            <p className="text-destructive">{lastSync.error_message}</p>
          )}
        </div>
      )}
    </section>
  );
};

const AdminPage = () => {
  const { isAdmin, isSpecialUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [showApproved, setShowApproved] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const canView = isAdmin || isSpecialUser;

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: allRoles } = await supabase.from("user_roles").select("*");

    if (profiles && allRoles) {
      const mapped = profiles.map((p: any) => ({
        id: p.id,
        display_name: p.display_name,
        phone: p.phone,
        status: p.status,
        roles: allRoles.filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
        admin_notes: p.admin_notes || null,
      }));
      setUsers(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (canView) fetchUsers();
  }, [canView]);

  const updateStatus = async (userId: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success(`Usuário ${status === "approved" ? "aprovado" : "rejeitado"}!`);
    fetchUsers();
  };

  const updateRole = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role: newRole as "admin" | "special_user" | "normal_user" }]);
    if (error) { toast.error("Erro ao atualizar cargo"); return; }
    toast.success("Cargo atualizado!");
    fetchUsers();
  };

  const saveNotes = async (userId: string) => {
    const notes = editingNotes[userId] ?? "";
    const { error } = await supabase.from("profiles").update({ admin_notes: notes }).eq("id", userId);
    if (error) { toast.error("Erro ao salvar notas"); } else { toast.success("Notas salvas!"); fetchUsers(); }
  };

  const saveProfile = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({ display_name: editName, phone: editPhone || null }).eq("id", userId);
    if (error) { toast.error("Erro ao salvar perfil"); } else { toast.success("Perfil atualizado!"); setEditingProfile(null); fetchUsers(); }
  };

  const handleNotesChange = (userId: string, value: string) => {
    setEditingNotes(prev => ({ ...prev, [userId]: value }));
  };

  const handleStartEdit = (u: UserWithRole) => {
    setEditingProfile(u.id);
    setEditName(u.display_name);
    setEditPhone(u.phone || "");
  };

  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Acesso negado.</p>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => u.status === "pending");
  const approvedUsers = users.filter((u) => u.status === "approved");
  const rejectedUsers = users.filter((u) => u.status === "rejected");

  const renderUserCard = (u: UserWithRole) => (
    <UserCard
      key={u.id}
      u={u}
      isAdmin={isAdmin}
      isSpecialUser={isSpecialUser}
      editingProfile={editingProfile}
      editName={editName}
      editPhone={editPhone}
      notesValue={editingNotes[u.id] ?? u.admin_notes ?? ""}
      notesChanged={editingNotes[u.id] !== undefined && editingNotes[u.id] !== (u.admin_notes ?? "")}
      onSetEditName={setEditName}
      onSetEditPhone={setEditPhone}
      onStartEdit={handleStartEdit}
      onCancelEdit={() => setEditingProfile(null)}
      onSaveProfile={saveProfile}
      onUpdateStatus={updateStatus}
      onUpdateRole={updateRole}
      onNotesChange={handleNotesChange}
      onSaveNotes={saveNotes}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex items-center gap-3 py-3">
          <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-primary">
            <Shield className="mr-1 inline h-5 w-5" />
            Painel de Controle
          </h1>
          {isAdmin && (
            <Link to="/reports" className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20">
              <BarChart3 className="h-4 w-4" /> Relatórios
            </Link>
          )}
        </div>
      </header>

      <main className="container max-w-3xl space-y-8 py-6">
        {/* Google Calendar Sync Section */}
        {isAdmin && <GoogleCalendarSync />}

        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <ShieldX className="h-5 w-5 text-secondary" />
                Solicitações Pendentes ({pendingUsers.length})
              </h2>
              {pendingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sem novas solicitações de usuários.</p>
              ) : (
                <div className="space-y-3">{pendingUsers.map(renderUserCard)}</div>
              )}
            </section>

            <section>
              <button
                onClick={() => setShowApproved(!showApproved)}
                className="mb-3 flex w-full items-center gap-2 font-display text-lg font-bold text-foreground hover:opacity-80 transition-opacity"
              >
                {showApproved ? <ChevronDown className="h-5 w-5 text-camp" /> : <ChevronRight className="h-5 w-5 text-camp" />}
                <ShieldCheck className="h-5 w-5 text-camp" />
                Aprovados ({approvedUsers.length})
              </button>
              {showApproved && (
                <div className="space-y-3">
                  {approvedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum usuário aprovado ainda.</p>
                  ) : (
                    approvedUsers.map(renderUserCard)
                  )}
                </div>
              )}
            </section>

            {rejectedUsers.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
                  <Users className="h-5 w-5 text-destructive" />
                  Rejeitados ({rejectedUsers.length})
                </h2>
                <div className="space-y-3">{rejectedUsers.map(renderUserCard)}</div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdminPage;

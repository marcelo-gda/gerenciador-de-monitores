import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldX, UserCheck, UserX, Users, Save, StickyNote, BarChart3, ChevronDown, ChevronRight, RefreshCw, CalendarSync, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";

interface Hierarchy { id: string; emoji: string; name: string; }
interface SpecialRole { id: string; emoji: string; name: string; }

interface UserWithRole {
  id: string;
  display_name: string;
  phone: string | null;
  status: string;
  roles: string[];
  admin_notes: string | null;
  hierarchy_ids: string[];
  role_ids: string[];
}

const roleLabel: Record<string, string> = {
  master_admin: "👑 Master Admin",
  admin: "🛡️ Admin",
  special_user: "⭐ Coordenador",
  normal_user: "👤 Monitor",
};

const roleBadgeClass: Record<string, string> = {
  master_admin: "bg-yellow-500/20 text-yellow-700",
  admin: "bg-blue-500/20 text-blue-700",
  special_user: "bg-secondary/40 text-secondary-foreground",
  normal_user: "bg-muted text-muted-foreground",
};

const getTopRole = (roles: string[]): string => {
  if (roles.includes("master_admin")) return "master_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("special_user")) return "special_user";
  return "normal_user";
};

const isAdminRole = (roles: string[]) =>
  roles.includes("admin") || roles.includes("master_admin");

interface UserCardProps {
  u: UserWithRole;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isSpecialUser: boolean;
  editingProfile: string | null;
  editName: string;
  editPhone: string;
  editHierarchyIds: string[];
  editRoleIds: string[];
  notesValue: string;
  hierarchies: Hierarchy[];
  specialRoles: SpecialRole[];
  onSetEditName: (v: string) => void;
  onSetEditPhone: (v: string) => void;
  onToggleHierarchyId: (id: string) => void;
  onToggleRoleId: (id: string) => void;
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
  u, isAdmin, isMasterAdmin, isSpecialUser, editingProfile, editName, editPhone,
  editHierarchyIds, editRoleIds, notesValue, hierarchies, specialRoles,
  onSetEditName, onSetEditPhone, onToggleHierarchyId, onToggleRoleId,
  onStartEdit, onCancelEdit, onSaveProfile,
  onUpdateStatus, onUpdateRole, onNotesChange, onSaveNotes, notesChanged,
}: UserCardProps) => {
  const isEditing = editingProfile === u.id;
  const userIsAdmin = isAdminRole(u.roles);

  return (
    <div className="rounded-lg border-2 border-border bg-card p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
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

              {/* Hierarquia e funções: somente para normal_user / special_user */}
              {!userIsAdmin && hierarchies.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold text-muted-foreground">Hierarquias</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {hierarchies.map((h) => (
                      <label key={h.id} className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
                        <input
                          type="checkbox"
                          checked={editHierarchyIds.includes(h.id)}
                          onChange={() => onToggleHierarchyId(h.id)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {h.emoji} {h.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!userIsAdmin && specialRoles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Funções Especiais</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {specialRoles.map((r) => (
                      <label key={r.id} className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
                        <input
                          type="checkbox"
                          checked={editRoleIds.includes(r.id)}
                          onChange={() => onToggleRoleId(r.id)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {r.emoji} {r.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
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
        <div className="flex flex-wrap gap-2 shrink-0">
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
          {isMasterAdmin && (
            <select
              value={getTopRole(u.roles)}
              onChange={(e) => onUpdateRole(u.id, e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none"
            >
              <option value="normal_user">👤 Monitor</option>
              <option value="special_user">⭐ Coordenador</option>
              <option value="admin">🛡️ Admin</option>
              <option value="master_admin">👑 Master Admin</option>
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
  const { isAdmin, isMasterAdmin, isSpecialUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [showApproved, setShowApproved] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editHierarchyIds, setEditHierarchyIds] = useState<string[]>([]);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [specialRoles, setSpecialRoles] = useState<SpecialRole[]>([]);

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
        hierarchy_ids: (p.hierarchy_ids ?? []) as string[],
        role_ids: (p.role_ids ?? []) as string[],
      }));
      setUsers(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!canView) return;
    fetchUsers();
    supabase.from("hierarchies").select("id, emoji, name").order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setHierarchies(data as Hierarchy[]); });
    supabase.from("roles").select("id, emoji, name").order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setSpecialRoles(data as SpecialRole[]); });
  }, [canView]);

  const updateStatus = async (userId: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success(`Usuário ${status === "approved" ? "aprovado" : "rejeitado"}!`);
    fetchUsers();
  };

  const updateRole = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role: newRole as "admin" | "master_admin" | "special_user" | "normal_user" }]);
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
    const targetUser = users.find((u) => u.id === userId);
    const updateData: Record<string, unknown> = {
      display_name: editName,
      phone: editPhone || null,
    };
    // Only save hierarchy/role fields for non-admin users
    if (targetUser && !isAdminRole(targetUser.roles)) {
      updateData.hierarchy_ids = editHierarchyIds;
      updateData.role_ids = editRoleIds;
    }
    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId);
    if (error) { toast.error("Erro ao salvar perfil"); } else { toast.success("Perfil atualizado!"); setEditingProfile(null); fetchUsers(); }
  };

  const handleNotesChange = (userId: string, value: string) => {
    setEditingNotes(prev => ({ ...prev, [userId]: value }));
  };

  const handleStartEdit = (u: UserWithRole) => {
    setEditingProfile(u.id);
    setEditName(u.display_name);
    setEditPhone(u.phone || "");
    setEditHierarchyIds(u.hierarchy_ids);
    setEditRoleIds(u.role_ids);
  };

  const handleToggleHierarchyId = (id: string) => {
    setEditHierarchyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToggleRoleId = (id: string) => {
    setEditRoleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
      isMasterAdmin={isMasterAdmin}
      isSpecialUser={isSpecialUser}
      editingProfile={editingProfile}
      editName={editName}
      editPhone={editPhone}
      editHierarchyIds={editHierarchyIds}
      editRoleIds={editRoleIds}
      notesValue={editingNotes[u.id] ?? u.admin_notes ?? ""}
      hierarchies={hierarchies}
      specialRoles={specialRoles}
      notesChanged={editingNotes[u.id] !== undefined && editingNotes[u.id] !== (u.admin_notes ?? "")}
      onSetEditName={setEditName}
      onSetEditPhone={setEditPhone}
      onToggleHierarchyId={handleToggleHierarchyId}
      onToggleRoleId={handleToggleRoleId}
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
      <AppNavbar />

      <main className="container max-w-3xl space-y-8 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-extrabold text-primary flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Painel de Controle
          </h1>
          {isAdmin && (
            <Link to="/reports" className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20">
              <BarChart3 className="h-4 w-4" /> Relatórios
            </Link>
          )}
        </div>

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

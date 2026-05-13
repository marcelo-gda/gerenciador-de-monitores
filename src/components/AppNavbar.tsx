import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { User, Mail, LayoutDashboard, LogOut } from "lucide-react";
import gdaLogo from "@/assets/gda-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const AppNavbar = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { pathname } = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      if (isAdmin) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false)
          .is("recipient_id", null);
        setUnreadMessages(count || 0);
      } else {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false)
          .eq("recipient_id", user.id);
        setUnreadMessages(count || 0);
      }
    };
    fetchUnread();
    const ch = supabase
      .channel("appnavbar-msg-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, isAdmin]);

  const navLink = (path: string) =>
    pathname === path
      ? "rounded-lg bg-primary/10 p-1.5 sm:p-2 text-primary hover:bg-primary/20"
      : "rounded-lg p-1.5 sm:p-2 text-muted-foreground hover:bg-muted";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
      <div className="px-3 sm:container flex items-center justify-between py-2 sm:py-3">
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2 min-w-0 hover:opacity-80 transition-opacity">
          <img src={gdaLogo} alt="GDA" className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg shrink-0" />
          <span className="font-display text-base sm:text-xl font-extrabold text-primary truncate">GDA Escalas</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span className="hidden sm:inline text-xs text-muted-foreground">{profile?.display_name}</span>
          <Link to="/profile" className={navLink("/profile")} title="Meu Perfil">
            <User className="h-4 w-4" />
          </Link>
          <Link to="/inbox" className={`relative ${navLink("/inbox")}`} title={isAdmin ? "Inbox" : "Notificações"}>
            <Mail className="h-4 w-4" />
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>
          {isAdmin && (
            <Link to="/admin" className={navLink("/admin")} title="Painel de Controle">
              <LayoutDashboard className="h-4 w-4" />
            </Link>
          )}
          <button onClick={signOut} className="rounded-lg p-1.5 sm:p-2 text-muted-foreground hover:bg-muted" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppNavbar;

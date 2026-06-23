import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SENDER = { name: "GDA Escalas", email: "marceloparreiras@gmail.com" };

serve(async (req) => {
  try {
    const { user_ids, subject, html } = await req.json();

    const admin = createClient(SUPA_URL, SUPA_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Busca email de cada monitor via auth.admin
    const emails: string[] = [];
    for (const uid of user_ids as string[]) {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (data.user?.email) emails.push(data.user.email);
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum email encontrado" }), { status: 400 });
    }

    // Envia um email por monitor (privacidade)
    const results = await Promise.all(
      emails.map((email) =>
        fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO_KEY,
          },
          body: JSON.stringify({
            sender: SENDER,
            to: [{ email }],
            subject,
            htmlContent: html,
          }),
        }).then((r) => r.json())
      )
    );

    return new Response(JSON.stringify({ sent: emails.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

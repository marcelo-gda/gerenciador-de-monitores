import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SENDER = { name: "GDA Escalas", email: "marceloparreiras@gmail.com" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildCalendarUrl(title: string, date: string, endDate: string, startTime: string, endTime: string) {
  const [sy, sm, sd] = date.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const [sh, smin] = startTime.split(":").map(Number);
  const [eh, emin] = endTime.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${sy}${pad(sm)}${pad(sd)}T${pad(sh)}${pad(smin)}00`;
  const end = `${ey}${pad(em)}${pad(ed)}T${pad(eh)}${pad(emin)}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_ids, subject, eventTitle, eventDate, eventEndDate, eventStartTime, eventEndTime, siteUrl } = await req.json();

    const admin = createClient(SUPA_URL, SUPA_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emails: string[] = [];
    for (const uid of user_ids as string[]) {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (data.user?.email) emails.push(data.user.email);
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum email encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateLabel = eventDate === eventEndDate
      ? formatDate(eventDate)
      : `${formatDate(eventDate)} — ${formatDate(eventEndDate)}`;

    const calendarUrl = buildCalendarUrl(eventTitle, eventDate, eventEndDate, eventStartTime, eventEndTime);

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
        <div style="background:#7c3aed;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <h1 style="color:#ffffff;margin:0;font-size:22px">✅ Você foi escalado(a)!</h1>
        </div>
        <p style="font-size:15px">Olá! Você foi confirmado(a) na escala do seguinte evento:</p>
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;margin:16px 0">
          <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#7c3aed">${eventTitle}</p>
          <p style="margin:0 0 4px;font-size:14px">📅 ${dateLabel}</p>
          <p style="margin:0;font-size:14px">🕐 ${eventStartTime} — ${eventEndTime}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin:24px 0">
          <a href="${calendarUrl}" target="_blank"
            style="display:block;text-align:center;background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;border-radius:8px;padding:12px 16px;font-size:14px;font-weight:600;text-decoration:none">
            📆 Adicionar ao Google Calendar
          </a>
          <a href="${siteUrl}" target="_blank"
            style="display:block;text-align:center;background:#7c3aed;color:#ffffff;border-radius:8px;padding:12px 16px;font-size:14px;font-weight:600;text-decoration:none">
            🔗 Acessar GDA Escalas
          </a>
        </div>
        <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:24px">
          GDA Escalas — Gerenciador de monitores
        </p>
      </div>
    `;

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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

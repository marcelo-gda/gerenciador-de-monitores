// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_CALENDAR_ID = "marceloparreiras@gmail.com";

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
}

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );

  const signInput = `${header}.${payload}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signInput}.${sig}`;

  const tokenRes = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get access token: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function shouldImportEvent(title: string): boolean {
  const t = title.trim().toLowerCase();

  // Whitelist — importar se contiver qualquer uma dessas palavras
  const whitelist = [
    "gda", "festa", "gdc", "emo", "obscuria", "obs",
    "acampamento", "vaquinha"
  ];
  if (whitelist.some((word) => t.includes(word))) return true;

  // Padrão: Nome + separador + Número (ex: "Raul - 10", "Mateus - 12")
  if (/[a-záéíóúâêîôûãõçà-ú]+\s*[-–]?\s*\d+/i.test(title)) return true;

  // Padrão: Nome + separador + Sigla (ex: "Rafa Quintão - STH", "Cacá - EMO")
  if (/[A-Za-zÀ-ú]+\s*[-–]\s*[A-Z]{2,5}(\s|$)/.test(title)) return true;

  return false;
}

function parseEventDateTime(gcalEvent: GoogleCalendarEvent) {
  const startStr = gcalEvent.start?.dateTime || gcalEvent.start?.date || "";
  const endStr = gcalEvent.end?.dateTime || gcalEvent.end?.date || "";

  let eventDate = "";
  let endDate: string | null = null;
  let startTime = "";
  let endTime = "";

  if (gcalEvent.start?.dateTime) {
    const startDt = new Date(startStr);
    const endDt = new Date(endStr);
    eventDate = startDt.toISOString().split("T")[0];
    endDate = endDt.toISOString().split("T")[0];
    if (endDate === eventDate) endDate = null;

    startTime = startDt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    endTime = endDt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } else {
    // All-day event
    eventDate = startStr;
    if (endStr && endStr !== startStr) {
      // Google uses exclusive end date for all-day, subtract 1
      const d = new Date(endStr);
      d.setDate(d.getDate() - 1);
      const adjusted = d.toISOString().split("T")[0];
      if (adjusted !== eventDate) endDate = adjusted;
    }
    startTime = "00:00";
    endTime = "23:59";
  }

  return { eventDate, endDate, startTime, endTime };
}

// @ts-ignore Deno is available at runtime
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore Deno is available at runtime
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // @ts-ignore Deno is available at runtime
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // @ts-ignore Deno is available at runtime
    const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    // @ts-ignore Deno is available at runtime
    const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") || DEFAULT_CALENDAR_ID;

    if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    }

    const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const accessToken = await getAccessToken(serviceAccount);

    const timeMin = new Date().toISOString();
    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      GOOGLE_CALENDAR_ID
    )}/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=100`;

    const calRes = await fetch(calendarUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!calRes.ok) {
      const errText = await calRes.text();
      throw new Error(`Google Calendar API error [${calRes.status}]: ${errText}`);
    }

    const calData = await calRes.json();
    const gcalEvents: GoogleCalendarEvent[] = calData.items || [];

    const activeEvents = gcalEvents.filter(
      (e) => e.summary && e.status !== "cancelled"
    );
    const cancelledEvents = gcalEvents.filter((e) => e.status === "cancelled");

    // ── Remoção: eventos que sumiram do Google devem ser marcados como deletados ──
    // Considera apenas eventos futuros com google_event_id (nunca toca manuais)
    const gcalActiveIds = new Set(activeEvents.map((e) => e.id));
    const today = new Date().toISOString().split("T")[0];
    const { data: dbGcalEvents } = await supabase
      .from("events")
      .select("id, google_event_id")
      .not("google_event_id", "is", null)
      .eq("is_deleted", false)
      .gte("event_date", today);

    let eventsDeleted = 0;
    for (const dbEvent of dbGcalEvents ?? []) {
      if (!gcalActiveIds.has(dbEvent.google_event_id)) {
        await supabase
          .from("events")
          .update({ is_deleted: true })
          .eq("id", dbEvent.id);
        eventsDeleted++;
      }
    }

    // ── Filtro de palavras-chave: importar só eventos relevantes ──
    const eventsToImport = activeEvents.filter((e) => {
      const passes = shouldImportEvent(e.summary ?? "");
      console.log(`[filter] "${e.summary}" → ${passes ? "✅ importado" : "❌ rejeitado"}`);
      return passes;
    });

    let eventsCreated = 0;
    let eventsUpdated = 0;

    for (const gcalEvent of eventsToImport) {
      const title = gcalEvent.summary!;
      const { eventDate, endDate, startTime, endTime } = parseEventDateTime(gcalEvent);
      const address = gcalEvent.location || "A definir";

      const { data: existing } = await supabase
        .from("events")
        .select("id, title, event_date, end_date, start_time, end_time, address")
        .eq("google_event_id", gcalEvent.id)
        .maybeSingle();

      if (existing) {
        const changed =
          existing.title !== title ||
          existing.event_date !== eventDate ||
          (existing.end_date ?? null) !== (endDate ?? null) ||
          existing.start_time !== startTime ||
          existing.end_time !== endTime ||
          existing.address !== address;

        if (changed) {
          await supabase
            .from("events")
            .update({ title, event_date: eventDate, end_date: endDate, start_time: startTime, end_time: endTime, address })
            .eq("google_event_id", gcalEvent.id);
          eventsUpdated++;
        }
      } else {
        await supabase.from("events").insert({
          google_event_id: gcalEvent.id,
          title,
          event_date: eventDate,
          end_date: endDate,
          start_time: startTime,
          end_time: endTime,
          address,
          emoji: "📅",
          type: "sun",
          total_slots: null,
          is_locked: false,
          is_deleted: false,
        });
        eventsCreated++;
      }
    }

    for (const cancelled of cancelledEvents) {
      await supabase
        .from("events")
        .update({ is_deleted: true })
        .eq("google_event_id", cancelled.id);
    }

    await supabase.from("google_calendar_sync_log").insert({
      events_created: eventsCreated,
      events_updated: eventsUpdated,
      status: "success",
    });

    return new Response(
      JSON.stringify({
        success: true,
        events_created: eventsCreated,
        events_updated: eventsUpdated,
        events_deleted: eventsDeleted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    try {
      // @ts-ignore Deno is available at runtime
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      // @ts-ignore Deno is available at runtime
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from("google_calendar_sync_log").insert({
        status: "error",
        error_message: errorMessage,
      });
    } catch (_) {
      // ignore logging error
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

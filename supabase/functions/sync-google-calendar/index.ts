import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== CONFIGURAÇÃO DE PREFIXOS ==========
// Adicione novos prefixos aqui para importar outros tipos de eventos
const EVENT_PREFIXES = ["FESTA"];
// Exemplos futuros: ["FESTA", "EVENTO", "TREINAMENTO"]
// ===============================================

const VISIBILITY_WINDOW_DAYS = 30;

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

  // Import RSA private key
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

function matchesPrefix(summary: string): { matches: boolean; cleanTitle: string } {
  const upper = summary.trim().toUpperCase();
  for (const prefix of EVENT_PREFIXES) {
    if (upper.startsWith(prefix)) {
      // Remove prefix and optional separators (space, dash, colon)
      let clean = summary.trim().substring(prefix.length).replace(/^[\s\-:]+/, "").trim();
      if (!clean) clean = summary.trim(); // fallback to full title
      return { matches: true, cleanTitle: clean };
    }
  }
  return { matches: false, cleanTitle: summary };
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
    const endD = endStr;
    if (endD && endD !== startStr) {
      // Google uses exclusive end date for all-day, subtract 1
      const d = new Date(endD);
      d.setDate(d.getDate() - 1);
      const adjusted = d.toISOString().split("T")[0];
      if (adjusted !== eventDate) endDate = adjusted;
    }
    startTime = "00:00";
    endTime = "23:59";
  }

  return { eventDate, endDate, startTime, endTime };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID");

    if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    }
    if (!GOOGLE_CALENDAR_ID) {
      throw new Error("GOOGLE_CALENDAR_ID not configured");
    }

    const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate with Google
    const accessToken = await getAccessToken(serviceAccount);

    // Fetch events from now onwards
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

    // Filter by prefix
    const relevantEvents = gcalEvents.filter(
      (e) => e.summary && matchesPrefix(e.summary).matches && e.status !== "cancelled"
    );

    // Also check for cancelled events to handle deletions
    const cancelledEvents = gcalEvents.filter(
      (e) => e.status === "cancelled"
    );

    let eventsCreated = 0;
    let eventsUpdated = 0;

    for (const gcalEvent of relevantEvents) {
      const { cleanTitle } = matchesPrefix(gcalEvent.summary!);
      const { eventDate, endDate, startTime, endTime } = parseEventDateTime(gcalEvent);
      const address = gcalEvent.location || "Local não informado";

      // Check if event already exists
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("google_event_id", gcalEvent.id)
        .maybeSingle();

      if (existing) {
        // Update existing event
        await supabase
          .from("events")
          .update({
            title: cleanTitle,
            event_date: eventDate,
            end_date: endDate,
            start_time: startTime,
            end_time: endTime,
            address: address,
          })
          .eq("google_event_id", gcalEvent.id);
        eventsUpdated++;
      } else {
        // Create new event
        await supabase.from("events").insert({
          google_event_id: gcalEvent.id,
          title: cleanTitle,
          event_date: eventDate,
          end_date: endDate,
          start_time: startTime,
          end_time: endTime,
          address: address,
          emoji: "🎉",
          type: "sun",
          total_slots: null, // Aberto/Ilimitado
          is_locked: false,
          is_deleted: false,
        });
        eventsCreated++;
      }
    }

    // Soft-delete cancelled events
    for (const cancelled of cancelledEvents) {
      await supabase
        .from("events")
        .update({ is_deleted: true })
        .eq("google_event_id", cancelled.id);
    }

    // Log sync
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Try to log the error
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
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

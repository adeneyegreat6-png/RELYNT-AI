import { env } from "@/lib/env";
import { decrypt, encrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionPayload } from "@/lib/actions";

// Minimum scopes for the MVP. Note: gmail.compose lets us create drafts.
// This app never calls the "send" endpoint; sending stays with the user.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/gmail.compose",
];

const redirectUri = () => `${env.appUrl}/api/integrations/google/callback`;

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  return res.json();
}

export async function connectGoogle(userId: string, code: string) {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token.");

  let accountEmail: string | null = null;
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (info.ok) accountEmail = (await info.json()).email ?? null;

  const { error } = await createAdminClient()
    .from("connections")
    .upsert({
      user_id: userId,
      provider: "google",
      account_email: accountEmail,
      scopes: tokens.scope,
      refresh_token_enc: encrypt(tokens.refresh_token),
    });
  if (error) throw error;
}

export type GoogleConnection = { accountEmail: string | null; scopes: string[] };

export async function getGoogleConnection(userId: string): Promise<GoogleConnection | null> {
  const { data, error } = await createAdminClient()
    .from("connections")
    .select("account_email, scopes")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { accountEmail: data.account_email, scopes: data.scopes.split(" ") };
}

export async function disconnectGoogle(userId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("connections")
    .select("refresh_token_enc")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (data) {
    // Best effort: revoke at Google too, so the token is dead everywhere.
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: decrypt(data.refresh_token_enc) }),
    }).catch(() => {});
  }
  const { error } = await db.from("connections").delete().eq("user_id", userId).eq("provider", "google");
  if (error) throw error;
}

async function accessToken(userId: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("connections")
    .select("refresh_token_enc")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Google account is not connected.");
  const tokens = await tokenRequest({ refresh_token: decrypt(data.refresh_token_enc), grant_type: "refresh_token" });
  return tokens.access_token;
}

async function googleFetch(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export type BusySlot = { title: string; start: string; end: string };

// Upcoming events, given to the planner so it can avoid conflicts.
export async function listUpcomingEvents(userId: string, days = 14): Promise<BusySlot[]> {
  const token = await accessToken(userId);
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + days * 86400_000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const data = await googleFetch(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
  type GEvent = { summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };
  return (data.items as GEvent[])
    .filter((e) => e.start && e.end)
    .map((e) => ({
      title: e.summary ?? "(busy)",
      start: e.start!.dateTime ?? e.start!.date!,
      end: e.end!.dateTime ?? e.end!.date!,
    }));
}

export async function createCalendarEvent(userId: string, p: ActionPayload["create_calendar_event"]) {
  const token = await accessToken(userId);
  const event = await googleFetch(token, "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify({
      summary: p.title,
      description: p.description,
      start: { dateTime: p.start },
      end: { dateTime: p.end },
    }),
  });
  return { id: event.id as string, link: event.htmlLink as string };
}

export async function createTask(userId: string, p: ActionPayload["create_task"]) {
  const token = await accessToken(userId);
  const task = await googleFetch(token, "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: p.title,
      notes: p.notes || undefined,
      due: p.due ? `${p.due}T00:00:00.000Z` : undefined,
    }),
  });
  return { id: task.id as string, link: (task.webViewLink as string | undefined) ?? "https://tasks.google.com" };
}

// RFC 2047 encoding so non-ASCII subjects survive, and no header injection.
function encodeHeader(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ");
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

export async function createEmailDraft(userId: string, p: ActionPayload["create_email_draft"]) {
  const token = await accessToken(userId);
  const mime = [
    `To: ${p.to.join(", ")}`,
    `Subject: ${encodeHeader(p.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(p.body, "utf8").toString("base64"),
  ].join("\r\n");
  const draft = await googleFetch(token, "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw: Buffer.from(mime, "utf8").toString("base64url") } }),
  });
  return { id: draft.id as string, link: "https://mail.google.com/mail/#drafts" };
}

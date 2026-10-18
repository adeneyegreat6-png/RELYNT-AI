# Relynt AI

**From intention to action.** Tell the AI what you want done. It works out a plan. You approve it. It gets the job done.

This is the MVP. It covers one complete loop, end to end:

```
request → AI plan → you review/edit/approve → real action in Google → logged result
```

## What it does

| Action | Where it happens | Notes |
|---|---|---|
| Calendar event | Google Calendar | The planner reads your next 14 days of events to avoid conflicts |
| Task | Google Tasks | Default task list |
| Email draft | Gmail | **Drafts only.** The app has no send code path. You send it. |
| Research | Web search (Claude) | Runs only after approval. Returns a summary with sources. |

## How safety works

The AI never touches your accounts directly.

1. **Claude proposes** a plan as structured JSON (`src/lib/planner.ts`).
2. **The server validates** every action against strict schemas (`src/lib/actions.ts`). It checks things like end after start, no past events, real email addresses and at most 5 recipients. It does this again after the user edits anything.
3. **Nothing runs without approval.** Execution is all-or-nothing on validation. Actions you didn't decide on are cancelled.
4. **No double runs.** Each action is claimed with a conditional `proposed → executing` update before it runs, so a double-click or a retry can't run it twice.
5. **Narrow integrations.** `src/lib/execute.ts` is the only code that acts on accounts, and it can do exactly four things.
6. **Secrets stay on the server.** Google refresh tokens are AES-256-GCM encrypted. The `connections` table has no browser access at all (RLS, no policies). The OAuth `state` is HMAC-signed, expires, and is tied to the user.
7. **Usage limits** are enforced on the server before any AI call (`src/lib/usage.ts`).
8. **Users can leave.** One button disconnects Google, revokes the token at Google, and deletes the account and all data.

## Stack

Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (auth + Postgres) · Claude API (`claude-opus-5-5`) · Google APIs · Render.

## Setup

You need four accounts: Supabase, Anthropic, Google Cloud, and Render. All have free tiers, except the Anthropic API, which is pay-as-you-go.

### 1. Supabase
1. Create a project at supabase.com.
2. **SQL Editor** → paste and run `supabase/migrations/0001_init.sql`.
3. **Authentication → URL Configuration**: set *Site URL* to your app URL. Add `<APP_URL>/auth/callback` to *Redirect URLs*. Also add `http://localhost:3000/auth/callback` for local dev.
4. **Project Settings → API**: copy the URL, the `anon` key, and the `service_role` key.

### 2. Anthropic
Create an API key at console.anthropic.com and add some credit.

### 3. Google Cloud
1. Create a project. Enable the **Google Calendar API**, **Google Tasks API** and **Gmail API**.
2. **OAuth consent screen**: External, Testing mode. Add yourself and your testers as *test users*. Up to 100 test users are allowed.
3. **Credentials → Create OAuth client ID → Web application**. Authorised redirect URI: `<APP_URL>/api/integrations/google/callback`. Add the localhost version too.
4. Copy the client ID and secret.

> `gmail.compose` is a Google *restricted* scope. Testing mode works fine for pilots. Before a public launch, Google requires app verification and a security assessment for that scope. That takes weeks and can cost money. If it becomes a blocker, remove Gmail drafts from `GOOGLE_SCOPES` and the action list.

### 4. Run locally
```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000
```

### 5. Deploy to Render
1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, then pick the repo. It reads `render.yaml`.
3. Fill in the environment variables. `APP_URL` is your `https://<name>.onrender.com` URL.
4. Update the Supabase redirect URLs and the Google redirect URI to use that URL.

The free Render plan sleeps after inactivity, so the first request after a while takes ~30–60s. Fine for pilots. Move to a paid instance before charging customers.

## Project layout

```
src/
  app/
    page.tsx                         landing page
    login/                           email magic-link sign-in
    app/                             signed-in area: command, activity, settings
    api/plans/                       POST: create a plan (Claude)
    api/plans/[id]/execute/          POST: validate + run approved actions
    api/integrations/google/         OAuth connect / callback / disconnect
    api/account/delete/              delete account and data
  lib/
    actions.ts                       action schemas + validation (the safety core)
    planner.ts                       Claude → structured plan
    research.ts                      Claude + web search, after approval
    execute.ts                       the only code that acts on accounts
    integrations/google.ts           Calendar, Tasks, Gmail drafts
    crypto.ts                        token encryption + signed OAuth state
    usage.ts                         monthly limits
supabase/migrations/0001_init.sql    schema + row-level security
render.yaml                          Render deployment
```

## Not built yet (on purpose)

Payments (Stripe), reusable workflows, teams, more integrations, mobile apps, and sending email. Add them when pilot users ask for them, not before.

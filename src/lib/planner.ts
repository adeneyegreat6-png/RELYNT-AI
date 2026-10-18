import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, MODEL, FALLBACK } from "@/lib/claude";
import { ACTION_TYPES, type ActionType } from "@/lib/actions";
import type { BusySlot } from "@/lib/integrations/google";
import { localNow } from "@/lib/time";

// Flat shape for the model: every field present, unused ones null. The server
// converts each item into a strict per-type payload and validates it.
const PlannedAction = z.object({
  type: z.enum(ACTION_TYPES),
  reason: z.string().describe("One short sentence: why this step helps the user's goal."),
  title: z.string().nullable(),
  start: z.string().nullable().describe("ISO 8601 with UTC offset, e.g. 2026-10-20T09:00:00+01:00"),
  end: z.string().nullable(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  due: z.string().nullable().describe("YYYY-MM-DD"),
  to: z.array(z.string()).nullable(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  question: z.string().nullable(),
});

const PlanOutput = z.object({
  summary: z.string().describe("Two or three sentences explaining the plan in plain language."),
  questions: z.array(z.string()).describe("Things you need the user to clarify. Empty if none."),
  actions: z.array(PlannedAction),
});

export type ProposedAction = { type: ActionType; reason: string; payload: Record<string, unknown> };
export type Plan = { summary: string; questions: string[]; actions: ProposedAction[] };

const SYSTEM = `You are the planner inside Relynt AI, an assistant that turns a person's goal into a short, concrete plan of actions. The user reviews and approves every action before anything happens, so propose; never claim you have done anything.

You can propose only these actions:
- create_calendar_event: title, start, end, description. Use the user's UTC offset in every timestamp.
- create_task: title, notes, due (YYYY-MM-DD or null). Added to the user's Google Tasks.
- create_email_draft: to, subject, body. Saved as a Gmail DRAFT; the user sends it themselves.
- research: question. Runs a web search after approval and returns a sourced summary.

Rules:
- Propose at most 8 actions. Fewer, well-chosen actions beat many.
- Never invent email addresses. If you don't know a recipient's address, set "to" to [] and add a question asking for it.
- When scheduling, avoid the user's existing events, keep to 09:00-18:00 local time on weekdays unless the user says otherwise, and leave at least 15 minutes between blocks.
- If the request is too vague to act on safely, return no actions and ask questions instead.
- If the user asks for something outside these four actions (payments, deleting data, sending messages, posting publicly), don't approximate it; say in the summary that it isn't supported yet.
- Write emails in a natural, professional tone matching the user's request. Sign off without a name unless the user gave one.
- Fill only the fields that belong to each action's type; set every other field to null.`;

function toPayload(a: z.infer<typeof PlannedAction>): Record<string, unknown> {
  switch (a.type) {
    case "create_calendar_event":
      return { title: a.title ?? "", start: a.start ?? "", end: a.end ?? "", description: a.description ?? "" };
    case "create_task":
      return { title: a.title ?? "", notes: a.notes ?? "", due: a.due || null };
    case "create_email_draft":
      return { to: a.to ?? [], subject: a.subject ?? "", body: a.body ?? "" };
    case "research":
      return { question: a.question ?? "" };
  }
}

export class PlannerRefusal extends Error {}

export async function planRequest(input: {
  request: string;
  timeZone: string;
  calendar: BusySlot[] | null;
}): Promise<Plan> {
  const calendarContext =
    input.calendar === null
      ? "Google is not connected, so you can't see their calendar. You may still propose events; mention in the summary that connecting Google is needed to create them."
      : input.calendar.length === 0
        ? "Their calendar has no events in the next 14 days."
        : `Their existing events in the next 14 days:\n${input.calendar.map((e) => `- ${e.start} to ${e.end}: ${e.title}`).join("\n")}`;

  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(PlanOutput) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Current time for the user: ${localNow(input.timeZone)}\n\n${calendarContext}\n\n<request>\n${input.request}\n</request>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new PlannerRefusal("This request can't be planned. Try rephrasing it.");
  }
  const out = response.parsed_output;
  if (!out) throw new Error(`Planner returned no parsable plan (stop_reason: ${response.stop_reason})`);

  return {
    summary: out.summary,
    questions: out.questions.slice(0, 5),
    actions: out.actions.slice(0, 8).map((a) => ({ type: a.type, reason: a.reason, payload: toPayload(a) })),
  };
}

import type { BetaContentBlock, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { anthropic, MODEL, FALLBACK } from "@/lib/claude";

export type ResearchResult = { summary: string; sources: { title: string; url: string }[] };

// Runs only after the user approves a research action.
export async function runResearch(question: string): Promise<ResearchResult> {
  const messages: BetaMessageParam[] = [
    {
      role: "user",
      content: `Research this for a busy professional and give a practical answer: what you found, the main options or trade-offs, and a recommended next step. Keep it under 300 words. Plain text, short paragraphs or simple dashes for lists.\n\n<question>\n${question}\n</question>`,
    },
  ];

  const content: BetaContentBlock[] = [];
  // Long searches can pause; continue a few times at most.
  for (let i = 0; i < 4; i++) {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages,
    });
    content.push(...response.content);
    if (response.stop_reason === "refusal") throw new Error("This research question was declined.");
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }

  const sources = new Map<string, string>();
  let summary = "";
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) sources.set(r.url, r.title);
    }
    if (block.type === "text") {
      summary += block.text;
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location") sources.set(c.url, c.title ?? c.url);
      }
    }
  }
  return {
    summary: summary.trim() || "No summary was produced.",
    sources: [...sources].slice(0, 8).map(([url, title]) => ({ url, title })),
  };
}

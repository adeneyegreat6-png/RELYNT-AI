import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment.
export const anthropic = new Anthropic();

export const MODEL = "claude-opus-5-5";

// If the model declines for policy reasons, the API retries on its default
// fallback model inside the same call.
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

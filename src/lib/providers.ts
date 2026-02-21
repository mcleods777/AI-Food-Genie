// Multi-provider AI configuration
// Consolidated Gemini-only architecture: Gemini handles all tasks (scan, OCR, recipe, suggest)
// Claude and GPT-4o retained as fallbacks only

export interface AIProviderConfig {
  geminiApiKey: string | null;
  claudeApiKey: string | null;
  openaiApiKey: string | null;
}

export function getProviderConfig(): AIProviderConfig {
  return {
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    claudeApiKey: process.env.CLAUDE_API_KEY || null,
    openaiApiKey: process.env.OPENAI_API_KEY || null,
  };
}

function isConfigured(key: string | null): boolean {
  return !!key && !key.includes("your-") && !key.includes("-here");
}

export type ScanProvider = "gemini" | "claude" | "openai";

/**
 * Determines which provider to use for a given task.
 * Consolidated architecture: Gemini Flash handles ALL tasks (detection, OCR, recipe, suggestions).
 * - Lowest OCR edit distance (0.115 on OmniDocBench)
 * - Single API = simpler architecture, lower cost, less latency
 * - response_mime_type="application/json" for reliable structured parsing
 * - GPT-4o and Claude retained as fallbacks if Gemini is unavailable
 */
export function getProviderForTask(task: "scan" | "ocr" | "recipe" | "suggest"): {
  provider: ScanProvider;
  model: string;
  available: boolean;
} {
  const config = getProviderConfig();

  // Gemini Flash: primary for ALL tasks
  if (isConfigured(config.geminiApiKey)) {
    return { provider: "gemini", model: "gemini-2.5-flash", available: true };
  }

  // Fallback chain: GPT-4o → Claude
  if (isConfigured(config.openaiApiKey)) {
    return { provider: "openai", model: "gpt-4o", available: true };
  }
  if (isConfigured(config.claudeApiKey)) {
    return { provider: "claude", model: "claude-sonnet-4-20250514", available: true };
  }

  return { provider: "gemini", model: "gemini-2.5-flash", available: false };
}

/**
 * Returns a summary of which providers are configured.
 */
export function getProviderStatus(): Record<ScanProvider, boolean> {
  const config = getProviderConfig();
  return {
    gemini: isConfigured(config.geminiApiKey),
    claude: isConfigured(config.claudeApiKey),
    openai: isConfigured(config.openaiApiKey),
  };
}

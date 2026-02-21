// Multi-provider AI configuration
// Supports Gemini (primary scanner), Claude (OCR/dates), GPT-4o (fallback)

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
 * Priority per the research:
 * - Item detection/scanning: Gemini Flash (bounding boxes, speed, cost)
 * - Expiration date OCR: Claude (lowest hallucination rate for dates)
 * - Recipe extraction / meal suggestions: best available
 * - Fallback: whatever is configured
 */
export function getProviderForTask(task: "scan" | "ocr" | "recipe" | "suggest"): {
  provider: ScanProvider;
  model: string;
  available: boolean;
} {
  const config = getProviderConfig();

  if (task === "scan") {
    // Gemini Flash: best for item detection ($0.0003/scan, bounding boxes, 0.41s TTFT)
    if (isConfigured(config.geminiApiKey)) {
      return { provider: "gemini", model: "gemini-2.5-flash", available: true };
    }
    if (isConfigured(config.openaiApiKey)) {
      return { provider: "openai", model: "gpt-4o", available: true };
    }
    if (isConfigured(config.claudeApiKey)) {
      return { provider: "claude", model: "claude-sonnet-4-20250514", available: true };
    }
    return { provider: "gemini", model: "gemini-2.5-flash", available: false };
  }

  if (task === "ocr") {
    // Claude: lowest hallucination rate (0.09%) for reading dates off labels
    if (isConfigured(config.claudeApiKey)) {
      return { provider: "claude", model: "claude-sonnet-4-20250514", available: true };
    }
    if (isConfigured(config.geminiApiKey)) {
      return { provider: "gemini", model: "gemini-2.5-flash", available: true };
    }
    if (isConfigured(config.openaiApiKey)) {
      return { provider: "openai", model: "gpt-4o", available: true };
    }
    return { provider: "claude", model: "claude-sonnet-4-20250514", available: false };
  }

  // recipe / suggest: use whatever's available, prefer cheaper options
  if (isConfigured(config.geminiApiKey)) {
    return { provider: "gemini", model: "gemini-2.5-flash", available: true };
  }
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

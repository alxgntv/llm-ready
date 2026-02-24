const DEFAULT_LLM_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'Google-Extended',
  'GoogleOther',
  'CCBot',
  'PerplexityBot',
  'Applebot-Extended',
  'cohere-ai',
  'Meta-ExternalAgent',
  'Amazonbot',
  'AI2Bot',
  'OAI-SearchBot',
  'YouBot',
  'Bytespider',
  'Diffbot',
  'ImagesiftBot',
  'Omgilibot',
];

export interface BotDetectOptions {
  additionalUserAgents?: string[];
  blockUserAgents?: string[];
}

export interface BotDetectResult {
  isBot: boolean;
  isBlocked: boolean;
  botName: string | null;
  /** true when client explicitly requested markdown via Accept header */
  acceptsMarkdown: boolean;
}

/**
 * Detects whether a request comes from an LLM bot.
 * Two signals: Accept header (most reliable) and User-Agent string.
 */
export function detectBot(
  userAgent: string | null,
  acceptHeader: string | null,
  options: BotDetectOptions = {}
): BotDetectResult {
  const ua = userAgent || '';
  const accept = acceptHeader || '';

  const acceptsMarkdown =
    accept.includes('text/markdown') ||
    accept.includes('text/x-markdown');

  const allBots = [...DEFAULT_LLM_USER_AGENTS, ...(options.additionalUserAgents || [])];
  const blockList = options.blockUserAgents || [];

  let matchedBot: string | null = null;

  for (const bot of allBots) {
    if (ua.includes(bot)) {
      matchedBot = bot;
      break;
    }
  }

  let isBlocked = false;
  if (matchedBot) {
    for (const blocked of blockList) {
      if (ua.includes(blocked)) {
        isBlocked = true;
        break;
      }
    }
  }

  const isBot = acceptsMarkdown || matchedBot !== null;

  console.log(
    `[llm-ready] Bot detection: isBot=${isBot}, botName=${matchedBot}, acceptsMarkdown=${acceptsMarkdown}, isBlocked=${isBlocked}, ua="${ua.substring(0, 80)}"`
  );

  return {
    isBot,
    isBlocked,
    botName: matchedBot,
    acceptsMarkdown,
  };
}

/** Quick check — returns true if request is from an LLM bot */
export function isLlmBot(
  userAgent: string | null,
  acceptHeader: string | null,
  options: BotDetectOptions = {}
): boolean {
  return detectBot(userAgent, acceptHeader, options).isBot;
}

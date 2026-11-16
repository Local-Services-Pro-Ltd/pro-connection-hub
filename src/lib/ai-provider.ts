const LOVABLE_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
type Env = Record<string, string | undefined>;
function env(): Env { return (globalThis as { process?: { env?: Env } }).process?.env ?? {}; }
export type AiProvider = "gemini" | "lovable";
export function aiProvider(e: Env = env()): AiProvider | null { if (e["GEMINI_API_KEY"]) return "gemini"; if (e["LOVABLE_API_KEY"]) return "lovable"; return null; }
export function aiApiKey(e: Env = env()): string | undefined { return e["GEMINI_API_KEY"] || e["LOVABLE_API_KEY"] || undefined; }
export function aiChatUrl(e: Env = env()): string { return aiProvider(e) === "gemini" ? GEMINI_CHAT_URL : LOVABLE_CHAT_URL; }
export function aiAuthHeaders(key: string, e: Env = env()): Record<string, string> { return aiProvider(e) === "gemini" ? { Authorization: `Bearer ${key}` } : { "Lovable-API-Key": key }; }
const GEMINI_ALIASES: Record<string, string> = { "gemini-2.5-flash": "gemini-flash-latest", "gemini-2.5-flash-lite": "gemini-flash-lite-latest", "gemini-2.5-pro": "gemini-pro-latest" };
export function aiModel(model: string, e: Env = env()): string { if (aiProvider(e) !== "gemini") return model; const bare = model.replace(/^google\//, ""); return GEMINI_ALIASES[bare] ?? bare; }

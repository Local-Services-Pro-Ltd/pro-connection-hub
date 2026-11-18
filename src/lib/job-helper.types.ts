export type JobHelperTrade = { slug: string; name: string };

export type JobSuggestion = {
  trade_slug: string | null;
  title: string;
  description: string;
  questions_to_add: string[];
  safety_note: string | null;
};

export function parseJobHelperText(value: string): string {
  const text = (value ?? "").trim();
  if (text.length < 20 || text.length > 1000) {
    throw new Error("Describe the problem in 20 to 1000 characters.");
  }
  return text;
}

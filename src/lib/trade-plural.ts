/**
 * Plural of a trade's display name, e.g. "Carpenter / Joiner" → "Carpenters / Joiners",
 * "Handyperson" → "Handypeople". Names that are already plural or not a person
 * ("Removal Services", "Pest Control", "Traditional Craftspeople") stay as they are.
 */
const UNCHANGED_ENDINGS = ["control", "people", "assembly"];

function pluralWord(word: string): string {
  const lower = word.toLowerCase();
  if (word.length > 1 && word === word.toUpperCase()) return word; // acronyms such as CCTV
  if (lower.endsWith("s") || UNCHANGED_ENDINGS.some((e) => lower.endsWith(e))) return word;
  if (lower.endsWith("person")) return `${word.slice(0, -"person".length)}people`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

export function tradePlural(name: string): string {
  return name
    .split(" / ")
    .map((part) => {
      const words = part.trim().split(" ");
      const last = words.pop() ?? "";
      return [...words, pluralWord(last)].join(" ");
    })
    .join(" / ");
}

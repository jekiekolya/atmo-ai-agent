const MAX_TITLE_LENGTH = 80;

/** A conversation's title is its first message, on one line and at most 80 characters (FR-008). */
export function deriveTitle(text: string): string {
  const characters = [...text.replace(/\s+/g, " ").trim()];
  if (characters.length <= MAX_TITLE_LENGTH) return characters.join("");
  return `${characters.slice(0, MAX_TITLE_LENGTH).join("")}…`;
}

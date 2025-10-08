// utils/parseMentions.js
// Provides helpers for extracting @mentions from free-form text.

const MENTION_PATTERN = /@([a-zA-Z0-9_]+)/g;

/**
 * Parse all @mentions from a block of text.
 * @param {string} text
 * @returns {string[]} unique usernames as they were typed (first occurrence wins)
 */
export const parseMentions = (text) => {
  if (!text || typeof text !== "string") {
    return [];
  }
  const matches = new Map();
  let match;
  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!matches.has(key)) {
      matches.set(key, raw);
    }
  }
  return Array.from(matches.values());
};

/**
 * Convenience helper that normalises @mentions to lowercase without duplicates.
 * @param {string[]|string} mentionsOrText
 * @returns {string[]} lower-cased usernames
 */
export const normaliseMentions = (mentionsOrText) => {
  if (!mentionsOrText) return [];
  if (typeof mentionsOrText === "string") {
    return parseMentions(mentionsOrText).map((m) => m.toLowerCase());
  }
  const seen = new Set();
  for (const value of mentionsOrText) {
    if (!value) continue;
    const key = String(value).replace(/^@/, "").trim().toLowerCase();
    if (key) seen.add(key);
  }
  return Array.from(seen.values());
};

export default parseMentions;

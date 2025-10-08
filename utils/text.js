// utils/text.js
import { normaliseMentions } from "./parseMentions";

export const stripYoutubeLinks = (text) =>
  text.replace(/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/gi, "").trim();

export const parseMentions = (text) => normaliseMentions(text);

// For RN, don't spit out HTML — return regex matches and let <ParsedText> render
export const extractUrls = (text) => {
  const urlRegex = /(\bhttps?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

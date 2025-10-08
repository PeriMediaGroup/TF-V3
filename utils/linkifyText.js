// src/utils/linkifyText.js

// Detect if a string contains a YouTube link
export const hasYoutubeLink = (text) => {
  if (!text) return false;
  const youtubeRegex =
    /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+/;
  return youtubeRegex.test(text);
};

// Extract the YouTube video ID from a URL string
export const extractYoutubeId = (text) => {
  if (!text) return null;
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = text.match(regex);
  return match ? match[1] : null;
};

// Turn URLs into clickable links (for web only)
// On native, you'd probably want to just render them as Text with Linking
export const linkifyText = (text) => {
  if (!text) return "";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => url);
};

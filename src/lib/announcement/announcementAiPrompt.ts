/**
 * The prompt the "ask AI" button hands to ChatGPT.
 *
 * A pure builder so the wording is one string in one place rather than a
 * template assembled inside a click handler.
 */
export function buildAnnouncementAiPrompt(plainText: string): string {
  return [
    'Write 2-3 short, catchy website announcement banners.',
    'Keep it concise, friendly, and promotional.',
    'Include 1-2 relevant emojis.',
    `Base text: ${plainText || 'your announcement'}`,
  ].join('\n');
}

/** Where that prompt is opened. */
export function chatGptUrl(prompt: string): string {
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
}

  const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B-\x1F]/g;
  const PROMPT_FENCE_REGEX = /<\/?system>|\[\/?INST\]/gi;
  const MAX_LENGTH = 4000;

  export function sanitizeUserMessage(raw: string): string {
    const noControl = raw.replace(CONTROL_CHARS_REGEX, "");
    const noFences = noControl.replace(PROMPT_FENCE_REGEX, "");
    const trimmed = noFences.trimEnd();
    return trimmed.slice(0, MAX_LENGTH);
  }
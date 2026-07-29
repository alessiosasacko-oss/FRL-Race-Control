export type MentionCandidate = {
  id: number;
  displayName: string;
};

export function discussionMentionToken(displayName: string): string {
  return `@${displayName}`;
}

export function mentionsAreValid(
  message: string,
  requestedUserIds: readonly number[],
  candidates: readonly MentionCandidate[],
): boolean {
  if (new Set(requestedUserIds).size !== requestedUserIds.length) {
    return false;
  }
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  return requestedUserIds.every((userId) => {
    const candidate = candidateById.get(userId);
    return (
      candidate !== undefined &&
      message.includes(discussionMentionToken(candidate.displayName))
    );
  });
}

export function extractMentionQuery(message: string): string | null {
  return message.match(/(?:^|\s)@([\p{L}\p{N}._-]*)$/u)?.[1] ?? null;
}

export function isChatNearBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 80,
): boolean {
  return scrollHeight - scrollTop - clientHeight < threshold;
}

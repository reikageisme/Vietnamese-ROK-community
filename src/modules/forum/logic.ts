export function normalizeReplyParent(parent: { id: string; parentId: string | null } | null) {
  if (!parent) return null;
  return parent.parentId ?? parent.id;
}

export function extractMentions(markdown: string) {
  const found = markdown.matchAll(/(?:^|\s)@([\p{L}\p{N}_-]{2,100})/gu);
  return [...new Set(Array.from(found, (match) => match[1].toLowerCase()))];
}

export function mentionRecipientIds(userIds: string[], actorId: string) {
  return [...new Set(userIds)].filter((id) => id !== actorId);
}

export function voteTransition(previous: number | null, next: number | null) {
  const upDelta = (next === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
  const downDelta = (next === -1 ? 1 : 0) - (previous === -1 ? 1 : 0);
  const reputationDelta = (next === 1 ? 2 : next === -1 ? -1 : 0) - (previous === 1 ? 2 : previous === -1 ? -1 : 0);
  return { upDelta, downDelta, reputationDelta };
}

export function reportReputationTransition(previous: string, next: string) {
  return (next === "ACTION_TAKEN" ? -5 : 0) - (previous === "ACTION_TAKEN" ? -5 : 0);
}

export function reportReputationLog(previous: string, next: string, userId: string, reportId: string) {
  const points = reportReputationTransition(previous, next);
  return points ? { userId, reason: points < 0 ? "REPORT_ACTION_TAKEN" as const : "REPORT_ACTION_REVERSED" as const, points, sourceRef: `report:${reportId}` } : null;
}

export function replyDeletionTopicData(isAccepted: boolean) {
  return { replyCount: { decrement: 1 }, ...(isAccepted ? { acceptedReplyId: null } : {}) };
}

export function pageWindow(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function searchTerms(query: string) {
  return [...new Set(query.toLowerCase().split(/\s+/).filter((term) => term.length >= 2))].slice(0, 8);
}

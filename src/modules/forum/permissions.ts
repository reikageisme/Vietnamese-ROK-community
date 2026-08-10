export function isForumModerator(role: string) {
  return role === "MODERATOR" || role === "ADMIN";
}

export function canEditForumContent(user: { id: string; role: string }, authorId: string, createdAt?: Date, now = new Date()) {
  if (isForumModerator(user.role)) return true;
  if (user.id !== authorId) return false;
  return !createdAt || now.getTime() - createdAt.getTime() <= 30 * 60 * 1000;
}

export function topicRateLimited(role: string, recentCount: number) {
  return role === "MEMBER" && recentCount >= 5;
}

export function replyRateLimited(role: string, recentCount: number) {
  if (isForumModerator(role)) return false;
  return recentCount >= (role === "CONTRIBUTOR" ? 60 : 20);
}

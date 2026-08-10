import { describe, expect, it } from "vitest";
import { canEditForumContent, replyRateLimited } from "./permissions";
import { extractMentions, mentionRecipientIds, normalizeReplyParent, pageWindow, replyDeletionTopicData, reportReputationLog, searchTerms } from "./logic";
import { renderForumMarkdown } from "./markdown";

describe("full forum business rules", () => {
  it("flattens a third-level reply back to the root reply", () => {
    expect(normalizeReplyParent({ id: "child", parentId: "root" })).toBe("root");
    expect(normalizeReplyParent({ id: "root", parentId: null })).toBe("root");
  });

  it("extracts unique mentions and excludes a self mention", () => {
    expect(extractMentions("Chào @Byron và @nix, lại @Byron")).toEqual(["byron", "nix"]);
    expect(mentionRecipientIds(["byron-id", "self-id", "byron-id"], "self-id")).toEqual(["byron-id"]);
  });

  it("clears acceptedReplyId when the accepted reply is soft-deleted", () => {
    expect(replyDeletionTopicData(true)).toEqual({ replyCount: { decrement: 1 }, acceptedReplyId: null });
  });

  it("creates a traceable -5 reputation log when moderation takes action", () => {
    expect(reportReputationLog("PENDING", "ACTION_TAKEN", "author-1", "report-1")).toEqual({ userId: "author-1", reason: "REPORT_ACTION_TAKEN", points: -5, sourceRef: "report:report-1" });
  });

  it("blocks an author after 31 minutes but always allows a moderator", () => {
    const createdAt = new Date("2026-08-10T00:00:00Z"); const now = new Date("2026-08-10T00:31:00Z");
    expect(canEditForumContent({ id: "author", role: "MEMBER" }, "author", createdAt, now)).toBe(false);
    expect(canEditForumContent({ id: "mod", role: "MODERATOR" }, "author", createdAt, now)).toBe(true);
  });

  it("tokenizes byron nix and calculates stable pagination", () => {
    expect(searchTerms("  Byron   nix ")).toEqual(["byron", "nix"]);
    expect(pageWindow(2, 20)).toEqual({ skip: 20, take: 20 });
  });

  it("blocks a MEMBER's 21st reply with the role-specific limiter", () => {
    expect(replyRateLimited("MEMBER", 19)).toBe(false);
    expect(replyRateLimited("MEMBER", 20)).toBe(true);
  });

  it("sanitizes scripts and removes external hotlinked images", async () => {
    const html = await renderForumMarkdown("hello <script>alert(1)</script>\n\n![x](https://evil.example/x.png)");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("evil.example");
  });
});

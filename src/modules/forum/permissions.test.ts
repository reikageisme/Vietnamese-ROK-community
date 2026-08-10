import { describe, expect, it } from "vitest";
import { canEditForumContent, topicRateLimited } from "./permissions";

describe("forum authorization and rate limits", () => {
  it("blocks a member editing another user's content", () => {
    expect(canEditForumContent({ id: "member-a", role: "MEMBER" }, "member-b")).toBe(false);
  });
  it("allows moderators and owners inside the edit window", () => {
    expect(canEditForumContent({ id: "member-a", role: "MEMBER" }, "member-a")).toBe(true);
    expect(canEditForumContent({ id: "mod", role: "MODERATOR" }, "member-b")).toBe(true);
  });
  it("blocks a member's sixth topic within an hour", () => {
    expect(topicRateLimited("MEMBER", 4)).toBe(false);
    expect(topicRateLimited("MEMBER", 5)).toBe(true);
    expect(topicRateLimited("CONTRIBUTOR", 99)).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { toggleVote } from "./vote-toggle";

describe("forum vote toggle", () => {
  it("removes an identical second vote instead of creating a duplicate", async () => {
    const remove = vi.fn(async () => undefined); const save = vi.fn(async () => undefined);
    const result = await toggleVote({ find: async () => ({ value: 1 }), remove, save }, 1);
    expect(result).toEqual({ active: false, delta: -1 }); expect(remove).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled();
  });
  it("updates a changed vote exactly once", async () => {
    const save = vi.fn(async () => undefined);
    const result = await toggleVote({ find: async () => ({ value: -1 }), remove: async () => undefined, save }, 1);
    expect(result).toEqual({ active: true, value: 1, delta: 2 }); expect(save).toHaveBeenCalledOnce();
  });
});


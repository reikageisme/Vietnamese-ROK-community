import { describe, expect, it } from "vitest";
import { addLoginMethod, removeLoginMethod } from "./login-methods";

describe("login method linking", () => {
  it("links Google onto the same credentials identity", () => {
    expect(addLoginMethod(["credentials"], "google")).toEqual(["credentials", "google"]);
  });

  it("blocks removing the final method", () => {
    expect(removeLoginMethod(["google"], "google")).toMatchObject({ ok: false, code: "LAST_LOGIN_METHOD" });
  });
});


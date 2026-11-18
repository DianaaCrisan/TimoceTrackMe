import { describe, expect, it } from "vitest";
import { RequestError } from "../core/errors/RequestError";
import { parseManualZips } from "./parseManualZips";

const A = "gid://shopify/Order/1";
const B = "gid://shopify/Order/2";

function form(value?: string): FormData {
  const formData = new FormData();
  if (value !== undefined) formData.append("manualZips", value);
  return formData;
}

describe("parseManualZips", () => {
  it("is unset when the form has no ZIPs", () => {
    expect(parseManualZips(form(), [A])).toBeUndefined();
    expect(parseManualZips(form("{}"), [A])).toBeUndefined();
  });

  it("reads the ZIPs, without spaces", () => {
    expect(
      parseManualZips(form(JSON.stringify({ [A]: "400 123", [B]: "500001" })), [
        A,
        B,
      ]),
    ).toEqual({ [A]: "400123", [B]: "500001" });
  });

  it("refuses a ZIP that is not six digits", () => {
    expect(() =>
      parseManualZips(form(JSON.stringify({ [A]: "40012" })), [A]),
    ).toThrow(RequestError);
  });

  it("drops a ZIP for an order outside the job instead of writing it", () => {
    expect(
      parseManualZips(form(JSON.stringify({ [A]: "400123", [B]: "500001" })), [
        A,
      ]),
    ).toEqual({ [A]: "400123" });
    expect(
      parseManualZips(form(JSON.stringify({ [B]: "500001" })), [A]),
    ).toBeUndefined();
  });

  it("refuses unreadable JSON", () => {
    expect(() =>
      parseManualZips(form(JSON.stringify({ [A]: 400123 })), [A]),
    ).toThrow(RequestError);
    expect(() => parseManualZips(form("not json"), [A])).toThrow(RequestError);
    expect(() => parseManualZips(form("[]"), [A])).toThrow(RequestError);
  });
});

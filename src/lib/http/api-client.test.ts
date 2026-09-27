import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/http/api-client";

const assign = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("window", {
    location: { assign, pathname: "/uk/dashboard/users", search: "?x=1" },
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockReset();
  fetchMock.mockReset();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("apiRequest", () => {
  it("sends JSON and resolves the data on success", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "u-1" }));

    const result = await apiRequest("POST", "/api/users", { email: "a@b.co" });

    expect(result).toEqual({ ok: true, data: { id: "u-1" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.co" }),
    });
  });

  it("resolves undefined data for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await apiRequest("DELETE", "/api/users/u-1/invite")).toEqual({
      ok: true,
      data: undefined,
    });
  });

  it("resolves the error envelope for a 4xx", async () => {
    fetchMock.mockResolvedValue(
      json(409, { error: { code: "email_in_use", detail: "deactivated" } }),
    );

    expect(await apiRequest("POST", "/api/users", {})).toEqual({
      ok: false,
      code: "email_in_use",
      detail: "deactivated",
      fields: undefined,
    });
  });

  it("carries field errors", async () => {
    fetchMock.mockResolvedValue(
      json(400, {
        error: {
          code: "validation_failed",
          fields: { email: ["validation.email.invalid"] },
        },
      }),
    );

    const result = await apiRequest("POST", "/api/users", {});

    expect(result).toMatchObject({
      ok: false,
      fields: { email: ["validation.email.invalid"] },
    });
  });

  it("sends a 401 to sign-in with the current address and never resolves (FR-071)", async () => {
    fetchMock.mockResolvedValue(
      json(401, { error: { code: "unauthenticated" } }),
    );

    const settled = vi.fn();
    void apiRequest("POST", "/api/users", {}).then(settled);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(assign).toHaveBeenCalledWith(
      "/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fusers%3Fx%3D1",
    );
    expect(settled).not.toHaveBeenCalled();
  });

  it("resolves a network failure as the network code", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await apiRequest("POST", "/api/users", {})).toEqual({
      ok: false,
      code: "network",
    });
  });

  it("resolves a 5xx as the unexpected code", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    expect(await apiRequest("POST", "/api/users", {})).toEqual({
      ok: false,
      code: "unexpected",
    });
  });
});

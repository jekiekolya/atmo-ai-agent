import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatFetch } from "@/lib/http/client/chat-fetch";

const assign = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("window", {
    location: {
      assign,
      pathname: "/uk/dashboard/chat/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      search: "",
    },
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockReset();
  fetchMock.mockReset();
});

const renewals = () =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/auth/session");

const init = { method: "POST", body: "{}" };

describe("chatFetch", () => {
  it("passes the request through to fetch", async () => {
    fetchMock.mockResolvedValue(new Response("stream", { status: 200 }));

    await chatFetch("/api/chat", init);

    expect(fetchMock).toHaveBeenCalledWith("/api/chat", init);
  });

  it.each([
    ["a stream", () => new Response("stream", { status: 200 })],
    [
      "a refusal",
      () =>
        Response.json(
          { error: { code: "rate_limited", retryAfterSeconds: 3 } },
          { status: 429 },
        ),
    ],
    ["a server failure", () => new Response(null, { status: 500 })],
  ])("returns %s unchanged and renews the session", async (_, make) => {
    const response = make();
    fetchMock.mockResolvedValue(response);

    expect(await chatFetch("/api/chat", init)).toBe(response);
    expect(renewals()).toEqual([["/api/auth/session", { cache: "no-store" }]]);
  });

  it("sends a 401 to sign-in with the current address and never resolves", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: "unauthenticated" } }, { status: 401 }),
    );

    const settled = vi.fn();
    void chatFetch("/api/chat", init).then(settled, settled);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(assign).toHaveBeenCalledWith(
      "/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fchat%2F0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    );
    expect(settled).not.toHaveBeenCalled();
    expect(renewals()).toHaveLength(0);
  });
});

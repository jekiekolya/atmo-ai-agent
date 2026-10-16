import { describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ failures: 0 }));

vi.mock("@/server/chat/fake-model", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/chat/fake-model")>();
  return {
    createFakeModel: () => {
      if (fake.failures > 0) {
        fake.failures -= 1;
        throw new Error("cannot build the model");
      }
      return original.createFakeModel();
    },
  };
});

const { getChatAgent } = await import("@/server/chat/agent");

describe("getChatAgent (review finding 1)", () => {
  it("builds the agent again after a failed build instead of keeping the failure", async () => {
    fake.failures = 1;

    await expect(getChatAgent()).rejects.toThrow("cannot build the model");
    await expect(getChatAgent()).resolves.toMatchObject({
      modelId: "fake-model",
    });
  });
});

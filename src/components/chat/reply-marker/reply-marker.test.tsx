import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { markedOutcome, ReplyMarker } from "./reply-marker";

describe("ReplyMarker", () => {
  it.each([
    ["stopped", "chat.markers.stopped"],
    ["cut", "chat.markers.cut"],
    ["failed", "chat.markers.failed"],
    ["in_progress", "chat.markers.inProgress"],
  ] as const)("marks a %s reply", (outcome, text) => {
    render(<ReplyMarker outcome={outcome} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("marks nothing for a completed reply", () => {
    const { container } = render(<ReplyMarker outcome={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("markedOutcome", () => {
  it("marks nothing while the reply runs, whatever was stored", () => {
    expect(markedOutcome({ type: "running" }, "failed")).toBeNull();
  });

  it("reads a cancelled run as stopped", () => {
    expect(
      markedOutcome({ type: "incomplete", reason: "cancelled" }, undefined),
    ).toBe("stopped");
  });

  it("reads a run that ended in an error as failed", () => {
    expect(
      markedOutcome({ type: "incomplete", reason: "error" }, "completed"),
    ).toBe("failed");
  });

  it.each(["stopped", "cut", "failed", "in_progress"] as const)(
    "reads the stored outcome %s of a complete message",
    (stored) => {
      expect(markedOutcome({ type: "complete", reason: "stop" }, stored)).toBe(
        stored,
      );
    },
  );

  it.each(["completed", undefined, 42, "toString"])(
    "marks nothing for the stored value %j",
    (stored) => {
      expect(
        markedOutcome({ type: "complete", reason: "stop" }, stored),
      ).toBeNull();
    },
  );
});

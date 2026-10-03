import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { PageLoader } from "./page-loader";

describe("PageLoader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds an empty status region until 300ms have passed (FR-031)", () => {
    render(<PageLoader />);
    const status = screen.getByRole("status");

    expect(status).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(299));
    expect(status).toBeEmptyDOMElement();
  });

  it("then shows the mark and announces the localized label (FR-030, FR-032)", () => {
    render(<PageLoader />);

    act(() => vi.advanceTimersByTime(300));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("loader.label");
    const mark = status.querySelector('svg[aria-hidden="true"]');
    expect(mark?.querySelectorAll("path")).toHaveLength(2);
  });

  it("leaves no timer behind when the page arrives first", () => {
    const { unmount } = render(<PageLoader />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

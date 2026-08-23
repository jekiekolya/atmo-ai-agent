import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

// A harness test, not coverage of shadcn: it proves the parts every future test
// depends on work together — jsdom, React 19, the Base UI primitive, the @/*
// alias and the cva variant classes. Replace it with a real test rather than
// deleting it: with no test files at all, `vitest run` exits 1 by design.
describe("Button", () => {
  it("renders as a button carrying its accessible name", () => {
    render(<Button>Click me</Button>);

    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("is disabled when asked", () => {
    render(<Button disabled>Click me</Button>);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies the class of the requested variant", () => {
    render(<Button variant="outline">Click me</Button>);

    expect(screen.getByRole("button")).toHaveClass("border-border");
  });
});

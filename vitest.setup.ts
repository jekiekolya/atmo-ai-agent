import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jest-dom matchers let UI tests assert accessibility semantics (roles, names,
// disabled state) instead of markup details.
import "@testing-library/jest-dom/vitest";

// Testing Library only registers its own cleanup when Vitest globals are on;
// they are off here, so without this the DOM accumulates across test cases.
afterEach(cleanup);

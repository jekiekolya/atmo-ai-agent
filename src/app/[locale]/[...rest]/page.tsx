import { notFound } from "next/navigation";

// Without this, an unmatched path inside a locale escapes the [locale]
// segment and renders Next's own untranslated 404 (FR-010).
export default function CatchAllNotFound() {
  notFound();
}

import { notFound } from "next/navigation";

// Without this, an unmatched path inside a locale (/uk/demo, /uk/whatever)
// escapes the [locale] segment and renders Next's own untranslated 404 — no
// `lang`, no switcher, English only. Routing it back through notFound() keeps
// the localized not-found page in charge (FR-010).
export default function CatchAllNotFound() {
  notFound();
}

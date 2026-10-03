/** A full document load, never router.push, so Back cannot restore a protected page (R8). */
export function hardNavigate(path: string): void {
  window.location.assign(path);
}

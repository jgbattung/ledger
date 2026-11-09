/**
 * The last tabbed (AppShell) location, so Minimize on the session can return
 * to it. In-memory only: on a cold start there is none and `/` is right.
 */
let lastTab = '/'

export function setLastTab(path: string): void {
  lastTab = path
}

export function getLastTab(): string {
  return lastTab
}

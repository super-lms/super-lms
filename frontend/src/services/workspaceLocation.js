export const WORKSPACE_LOCATION_EVENT = "super-lms:workspace-location"

// Keep sidebar destinations in sync with workspaces that update the URL in place.
export function updateWorkspaceUrl(url, replace = false, browser = window) {
  browser.history[replace ? "replaceState" : "pushState"](null, "", url)
  browser.dispatchEvent(new Event(WORKSPACE_LOCATION_EVENT))
}

export function readWorkspaceLocation(browser = window) {
  return { pathname: browser.location.pathname, search: browser.location.search }
}

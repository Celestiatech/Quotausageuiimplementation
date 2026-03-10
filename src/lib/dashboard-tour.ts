export const DASHBOARD_TOUR_EVENT_NAME = "cp:dashboardTourRequest";
export const DASHBOARD_TOUR_STORAGE_KEY = "cp_dashboard_requested_tour";

export const DASHBOARD_TOUR_JOBS_EXTENSION = "jobs-extension-install";
export const DASHBOARD_TOUR_ONBOARDING_EXTENSION = "onboarding-extension-install";

export type DashboardTourId =
  | typeof DASHBOARD_TOUR_JOBS_EXTENSION
  | typeof DASHBOARD_TOUR_ONBOARDING_EXTENSION;

export function queueDashboardTourRequest(tourId: DashboardTourId) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DASHBOARD_TOUR_STORAGE_KEY, tourId);
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(new CustomEvent(DASHBOARD_TOUR_EVENT_NAME, { detail: { tourId } }));
}

export function peekDashboardTourRequest(): DashboardTourId | "" {
  if (typeof window === "undefined") return "";
  try {
    const value = window.sessionStorage.getItem(DASHBOARD_TOUR_STORAGE_KEY);
    if (
      value === DASHBOARD_TOUR_JOBS_EXTENSION ||
      value === DASHBOARD_TOUR_ONBOARDING_EXTENSION
    ) {
      return value;
    }
  } catch {
    // ignore storage failures
  }
  return "";
}

export function clearDashboardTourRequest() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DASHBOARD_TOUR_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function consumeDashboardTourRequest(tourId: DashboardTourId) {
  const queued = peekDashboardTourRequest();
  if (queued !== tourId) return false;
  clearDashboardTourRequest();
  return true;
}

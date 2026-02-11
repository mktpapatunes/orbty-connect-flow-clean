import { isLovablePreview } from "./env";

const STABILIZER_KEY = "orbty_preview_stabilized";

/**
 * In Lovable preview environments, cached state can cause auth inconsistencies.
 * This performs a single controlled reload per tab to clear stale state.
 */
export const runPreviewStabilizer = (): void => {
  if (!isLovablePreview()) return;

  if (!sessionStorage.getItem(STABILIZER_KEY)) {
    sessionStorage.setItem(STABILIZER_KEY, "1");
    window.location.reload();
  }
};

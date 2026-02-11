/**
 * Environment detection utilities for Lovable preview stabilization.
 */

export const isLovablePreview = (): boolean => {
  if (typeof window === "undefined") return false;
  const { hostname, pathname } = window.location;
  return (
    hostname.includes("lovable") ||
    hostname.includes("preview") ||
    pathname.includes("/preview")
  );
};

export const isDevLike = (): boolean => {
  return isLovablePreview() || import.meta.env.DEV;
};

/** Canonicalize before checking: encoded slashes and dot segments cannot reach auth plumbing. */
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\u0000-\u0020\u007f\\]/.test(value)
  )
    return "/";
  try {
    const url = new URL(value, "https://ims.invalid");
    const path = decodeURIComponent(url.pathname);
    if (
      url.origin !== "https://ims.invalid" ||
      path.startsWith("//") ||
      /[\u0000-\u0020\u007f\\]/.test(path) ||
      /^\/(?:api|signin|signing-in|sign-in-error|no-access|unavailable)(?:\/|$)/.test(
        path,
      )
    )
      return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

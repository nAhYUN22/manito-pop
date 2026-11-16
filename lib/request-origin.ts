/** Coolify terminates HTTPS before forwarding HTTP to this Node.js server. */
export function hasAllowedOrigin(
  request: Request,
  configuredOrigin = process.env.APP_ORIGIN,
): boolean {
  const origin = request.headers.get("origin");
  // Non-browser clients are still subject to admin token / participant PIN checks.
  if (!origin) return true;
  try {
    const supplied = new URL(origin);
    if (
      !["http:", "https:"].includes(supplied.protocol) ||
      supplied.origin !== origin
    )
      return false;
    if (configuredOrigin) {
      const configured = new URL(configuredOrigin);
      if (
        !["http:", "https:"].includes(configured.protocol) ||
        configured.username ||
        configured.password ||
        configured.pathname !== "/" ||
        configured.search ||
        configured.hash
      )
        return false;
      return supplied.origin === configured.origin;
    }
    const url = new URL(request.url);
    // Use Host, not arbitrary X-Forwarded-Host. Coolify preserves the public Host.
    const host = request.headers.get("host") || url.host;
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    const protocol =
      forwardedProtocol === "https" || forwardedProtocol === "http"
        ? `${forwardedProtocol}:`
        : url.protocol;
    return supplied.host === host && supplied.protocol === protocol;
  } catch {
    return false;
  }
}

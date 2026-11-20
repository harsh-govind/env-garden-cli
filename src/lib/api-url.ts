export function normalizeApiUrl(rawApiUrl: string): string {
  const url = new URL(rawApiUrl);
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
    throw new Error("The API URL must use HTTPS unless it points to localhost.");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

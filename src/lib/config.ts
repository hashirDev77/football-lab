const DEFAULT_PROVIDER = "https://sports-api.sportsdata365.com/msdata/v1/football";

export const config = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL || "/msdata/v1/football").replace(/\/$/, ""),
  apiKey: import.meta.env.VITE_MSDATA_API_KEY || "",
  liveKey: import.meta.env.VITE_MSDATA_LIVE_KEY || "",
};

export function footballUrl(path: string): string {
  const base = config.baseUrl || DEFAULT_PROVIDER;
  return `${base}/${path.replace(/^\//, "")}`;
}

export function providerHeaders(opts?: { apim?: boolean; live?: boolean }): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  const useApim = opts?.apim !== false;
  const useLive = opts?.live !== false;
  if (useApim && config.apiKey) headers["x-apim-key"] = config.apiKey;
  if (useLive && config.liveKey) headers["X-Live-Key"] = config.liveKey;
  return headers;
}

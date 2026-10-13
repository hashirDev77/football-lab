import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

export const config = {
  port: Number(process.env.API_PORT || 8788),
  baseUrl: (process.env.MSDATA_BASE_URL || "https://sports-api.sportsdata365.com/msdata").replace(/\/$/, ""),
  apiKey: process.env.MSDATA_API_KEY || "",
  liveKey: process.env.MSDATA_LIVE_KEY || "",
  dataDir: resolve(process.cwd(), "../../data"),
};

export function footballUrl(path: string): string {
  return `${config.baseUrl}/v1/football/${path.replace(/^\//, "")}`;
}

export function providerHeaders(opts?: { apim?: boolean; live?: boolean }): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  const useApim = opts?.apim !== false;
  const useLive = opts?.live !== false;
  if (useApim && config.apiKey) headers["x-apim-key"] = config.apiKey;
  if (useLive && config.liveKey) headers["X-Live-Key"] = config.liveKey;
  return headers;
}

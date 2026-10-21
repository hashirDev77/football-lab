import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PROVIDER = "https://sports-api.sportsdata365.com";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/msdata": {
        target: PROVIDER,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5174,
    proxy: {
      "/msdata": {
        target: PROVIDER,
        changeOrigin: true,
      },
    },
  },
});

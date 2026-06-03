import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    // Proxy /api and socket.io to the Express backend during development so
    // cookies (refresh token) are same-origin and CORS is a non-issue.
    proxy: {
      "/api": { target: "http://localhost:5050", changeOrigin: true },
      "/socket.io": { target: "http://localhost:5050", ws: true, changeOrigin: true },
    },
  },
});

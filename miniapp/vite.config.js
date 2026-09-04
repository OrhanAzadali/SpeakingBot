// miniapp/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: "all",
  },
  build: {
    outDir: "dist", // ✅ Vite will now generate miniapp/dist
    emptyOutDir: true,
  },
});
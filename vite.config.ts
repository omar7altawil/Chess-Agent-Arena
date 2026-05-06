import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: ".",
  server: {
    port: 3000
  },
  build: {
    outDir: "dist-web",
    emptyOutDir: true
  }
});

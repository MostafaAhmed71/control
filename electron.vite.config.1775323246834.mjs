// electron.vite.config.js
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    entry: "src/main/index.js"
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    entry: "src/preload/index.js"
  },
  renderer: {
    root: ".",
    build: {
      rollupOptions: {
        input: {
          index: "index.html"
        }
      }
    },
    plugins: [react()],
    server: {
      proxy: {
        "/api-omr": {
          target: "http://localhost:8000",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api-omr/, "")
        },
        "/api-whatsapp": {
          target: "http://localhost:3001",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api-whatsapp/, "")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};

import { defineConfig, loadEnv } from "vite";

import process from "node:process";

import path from "path";

import react from "@vitejs/plugin-react";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiBaseURL = env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    server: {
      port: 5173,
      host: true,
      open: true,
      proxy: Object.fromEntries(
        [
          "/auth",
          "/user",
          "/tracker",
          "/dropdown",
          "/project",
          "/project_category",
          "/task",
          "/permission",
          "/password_reset",
          "/user_monthly_tracker",
          "/project_monthly_tracker",
          "/qc",
          "/qc_afd",
          "/qc_audit",
          "/qc_rework",
          "/qc_history_user",
          "/roster",
          "/report_email",
          "/qa_tracker",
          "/kra",
          "/holiday",
          "/api_log_list",
          "/user_monthly_report",
          "/health",
        ].map((pathPrefix) => [
          pathPrefix,
          { target: apiBaseURL, changeOrigin: true, secure: false },
        ]).concat([
          [
            "^/dashboard/(filter|api)",
            { target: apiBaseURL, changeOrigin: true, secure: false },
          ],
          [
            "/api/v1",
            {
              target: "http://127.0.0.1:8000",
              changeOrigin: true,
              secure: false,
            },
          ],
        ])
      ),
      middlewareMode: false,
      historyApiFallback: true,
    },
  };
});

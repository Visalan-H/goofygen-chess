import { defineConfig, globalIgnores } from "eslint/config";
import convexPlugin from "@convex-dev/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig([
  globalIgnores(["dist", "convex/_generated", ".vercel"]),

  {
    files: ["src/**/*.{ts,tsx}", "convex/**/*.ts"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  },

  // The Convex rules apply to convex/ only
  ...convexPlugin.configs.recommended,
  {
    files: ["convex/**/*.ts"],
    plugins: { "@convex-dev": convexPlugin },
    rules: {
      "@convex-dev/no-collect-in-query": "error",
      "@convex-dev/require-access-control": "off",
    },
  },
]);

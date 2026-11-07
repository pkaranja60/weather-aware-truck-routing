import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import shadcn from "ultracite/oxlint/shadcn";
import antiSlop from "ultracite/oxlint/anti-slop";

export default defineConfig({
  env: core.env,
  extends: [core, react, tanstack, shadcn, antiSlop],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: shadcn.jsPlugins,
  plugins: [
    "react",
    "typescript",
    "oxc"
  ],
  rules: {
    "react/rules-of-hooks": "error",
    "react/only-export-components": [
      "warn",
      {
        "allowConstantExport": true
      }
    ]
  },
});

// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://akosah285.github.io",
  base: "/engineering-portfolio",
  trailingSlash: "always",
  integrations: [mdx()],
  output: "static",
  build: {
    format: "directory",
  },
  vite: {
    // Vitest looks at vitest.config.ts; nothing extra here.
  },
});

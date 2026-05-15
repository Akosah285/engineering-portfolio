// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// https://astro.build/config
export default defineConfig({
  site: "https://akosah285.github.io",
  base: "/engineering-portfolio",
  trailingSlash: "always",
  integrations: [mdx(), react()],
  output: "static",
  build: {
    format: "directory",
  },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [[rehypeKatex, { strict: "ignore", output: "html" }]],
    shikiConfig: {
      themes: {
        light: "catppuccin-latte",
        dark: "catppuccin-mocha",
      },
    },
  },
  vite: {
    // Vitest looks at vitest.config.ts; nothing extra here.
  },
});


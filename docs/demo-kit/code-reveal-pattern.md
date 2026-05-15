# `<CodeReveal>` + `algorithm.ts` extraction pattern

## Why

Every interactive demo on this site has a **core algorithm** (gradient descent
step, K-means update, FFT butterfly, etc.) and a **wrapper component** (sliders,
canvas, narration). Without discipline, those two drift — the displayed code
in the writeup says one thing, the running code says another. This pattern
keeps them in sync.

## The convention

Each opt-in demo lives in its own directory:

```
src/components/demos/{course}/{demo-name}/
├─ ComponentName.tsx     ← React/Astro wrapper (UI + lifecycle)
├─ algorithm.ts          ← Pure function (single source of truth)
└─ presets.ts            ← Named starting states
```

The component imports `algorithm.ts` **twice**:

```tsx
import { gradientDescentStep } from "./algorithm";
import algorithmSource from "./algorithm.ts?raw";

// ... run the algorithm with `gradientDescentStep(...)` ...
// ... and display the source with <CodeReveal code={algorithmSource} lang="typescript" /> ...
```

The `?raw` Vite import resolves to the file's text at build time, so the
displayed code is *exactly* the code that runs. No copy-paste, no drift.

## What `<CodeReveal>` does

```astro
---
import CodeReveal from "src/components/demo-kit/CodeReveal.astro";
import code from "./algorithm.ts?raw";
---
<CodeReveal code={code} lang="typescript" />
```

- Renders the code inside a `<details>` block (collapsed by default).
- Uses Astro's built-in `<Code>` component, which runs Shiki **at build**.
- **Zero highlighting JS reaches the client** (verified by inspecting `dist/`).
- Themes follow plan §6.10: Catppuccin Latte (light) / Mocha (dark), with the
  dark variant swapped in via the site's `[data-theme="dark"]` selector.

## Props

| Prop      | Type     | Default                | What it does                       |
| --------- | -------- | ---------------------- | ---------------------------------- |
| `code`    | `string` | required               | The source to render.              |
| `lang`    | `string` | required               | Shiki language id.                 |
| `summary` | `string` | `"Show algorithm code"` | The `<summary>` text of `<details>`. |

## Verification

`/_dev/demo-kit/` is the build-time shakedown page. It imports a sample
`algorithm.ts` and renders it through `<CodeReveal>`. If the build succeeds and
the output HTML contains the highlighted code inside a `<details>` block, the
pattern is wired correctly.

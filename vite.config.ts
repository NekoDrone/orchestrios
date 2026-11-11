import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

import yaml from "@rollup/plugin-yaml";

import { globSync } from "node:fs";
import { slugFromPath } from "./src/lib/utils/data";

// Nothing links to a track page yet, so link crawling alone would not find them.
// Enumerate every track from the data directory instead — build-time only.
// Mirrors the globs in `src/lib/load.ts`, including stray (release-less) tracks.
const trackPages = globSync(["data/tracks/*/*.yaml", "data/tracks/*.yaml"]).map(
    (path) => ({ path: `/track/${slugFromPath(path)}` }),
);

const config = defineConfig({
    resolve: { tsconfigPaths: true },
    plugins: [
        devtools(),
        nitro({
            preset: "cloudflare-module",
            compatibilityDate: "2026-07-25",
            // Selecting a Cloudflare preset makes Nitro run the dev server's SSR
            // inside workerd via miniflare, which breaks on CJS in the module graph
            // ("module is not defined"). Dev renders under Node instead; the
            // prerender step of `vite build` still runs against real workerd.
            devServer: { runner: "self" },
            rollupConfig: { external: [/^@sentry\//] },
        }),
        tailwindcss(),
        tanstackStart({
            // The whole site is static: all content is bundled from /data at build
            // time, so every page can be prerendered and served from the edge.
            prerender: {
                enabled: true,
                // Off until the nav's targets (/about, /tracks, /motifs, ...)
                // actually exist — crawling them today only 404s the build.
                crawlLinks: false,
                // `load.ts` throws on malformed YAML or an unresolvable slug —
                // let that break the build rather than ship a broken page.
                failOnError: true,
                autoStaticPathsDiscovery: true,
            },
            pages: trackPages,
            sitemap: { host: "https://orchestrios.elpis.garden" },
        }),
        viteReact(),
        babel({ presets: [reactCompilerPreset()] }),
        yaml(),
    ],
});

export default config;

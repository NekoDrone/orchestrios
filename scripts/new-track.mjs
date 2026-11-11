#!/usr/bin/env node
/**
 * Interactive helper for adding a track while listening to it.
 *
 * Asks the bare minimum, then writes `/data/tracks/<release>/<slug>.yaml`.
 * Every optional prompt can be skipped with Enter; the resulting file is
 * meant to be hand-tidied afterwards. The source of truth for the schema
 * lives in `/src/lib/types/data/track.ts` — if the two disagree, that wins.
 *
 * Usage: pnpm new-track
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { kebab } from "./lib/slug.mjs";
import { trackToYaml } from "./lib/yaml.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");

const TIMESTAMP = /^\d+:\d{2}(-\d+:\d{2})?$/;

const rl = createInterface({ input: process.stdin, output: process.stdout });

/** Read the `name`/`title` field out of a data file, for nicer pick lists. */
const labelOf = (path) => {
    const match = readFileSync(path, "utf8").match(/^(?:name|title):\s*(.+)$/m);
    return match ? match[1].trim() : undefined;
};

/** Slugs of every yaml file directly inside `/data/<dir>`. */
const entriesIn = (dir) => {
    const abs = join(dataDir, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { withFileTypes: true })
        .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name))
        .map((e) => ({
            slug: e.name.replace(/\.ya?ml$/, ""),
            label: labelOf(join(abs, e.name)),
        }));
};

/** Same, but one level deeper — activities are filed by type. */
const nestedEntriesIn = (dir) => {
    const abs = join(dataDir, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .flatMap((e) => entriesIn(join(dir, e.name)));
};

const releases = () => {
    const file = join(dataDir, "releases.yaml");
    if (!existsSync(file)) return [];
    const res = [];
    for (const line of readFileSync(file, "utf8").split("\n")) {
        const slug = line.match(/^-\s*slug:\s*(.+)$/);
        if (slug) res.push({ slug: slug[1].trim(), label: undefined });
        const name = line.match(/^\s+name:\s*(.+)$/);
        if (name && res.length) res[res.length - 1].label = name[1].trim();
    }
    return res;
};

const ask = async (question, fallback) => {
    const suffix = fallback === undefined ? "" : ` (${fallback})`;
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer || fallback || "";
};

const askRequired = async (question, fallback) => {
    for (;;) {
        const answer = await ask(question, fallback);
        if (answer) return answer;
        console.log("  ↳ required.");
    }
};

const askYesNo = async (question, fallback = false) => {
    const answer = await ask(question, fallback ? "y" : "n");
    return /^y/i.test(answer);
};

const askList = async (question, items, { optional = true } = {}) => {
    if (!items.length) {
        console.log(`  ↳ no candidates on disk, skipping ${question}.`);
        return undefined;
    }
    items.forEach((item, i) => {
        console.log(`    ${i + 1}) ${item.slug}${item.label ? ` — ${item.label}` : ""}`);
    });
    for (;;) {
        const answer = await ask(
            optional ? `${question} [number or slug, Enter to skip]` : `${question} [number or slug]`,
        );
        if (!answer) {
            if (optional) return undefined;
            console.log("  ↳ required.");
            continue;
        }
        const index = Number(answer);
        if (Number.isInteger(index) && index >= 1 && index <= items.length) {
            return items[index - 1].slug;
        }
        if (items.some((item) => item.slug === answer)) return answer;
        console.log("  ↳ not one of the above; pick a number or type a slug exactly.");
    }
};

const askTimestamps = async () => {
    for (;;) {
        const raw = await ask('timestamps, comma separated ["0:05-0:12, 1:20"]');
        const parts = raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        if (!parts.length) {
            console.log("  ↳ a motif needs at least one timestamp.");
            continue;
        }
        const bad = parts.filter((t) => !TIMESTAMP.test(t));
        if (bad.length) {
            console.log(`  ↳ expected "m:ss" or "m:ss-m:ss", got: ${bad.join(", ")}`);
            continue;
        }
        return parts;
    }
};

const sourceFromUrl = (url) => {
    const host = URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : "";
    if (/youtube\.com$|youtu\.be$/.test(host)) return "youtube";
    if (/spotify\.com$/.test(host)) return "spotify";
    if (/square-enix(-games)?\.com$/.test(host)) return "square-enix-store";
    if (/soundcloud\.com$/.test(host)) return "soundcloud";
    if (/archive\.org$/.test(host)) return "archive";
    return host.split(".")[0] || "other";
};

// --- prompts ---------------------------------------------------------------

const main = async () => {
    console.log("\nnew track — Enter skips anything optional.\n");

    const title = await askRequired("title");
    const slug = await ask("slug", kebab(title));

    console.log("\nrelease:");
    const release = await askList("release", releases(), { optional: false });

    const composers = (await askRequired("composers, comma separated", "Masayoshi Soken"))
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

    const description = await ask("description [optional]");

    const links = [];
    console.log("\nlinks — paste a url, Enter to move on.");
    for (;;) {
        const url = await ask("  url");
        if (!url) break;
        if (!URL.canParse(url)) {
            console.log("  ↳ that isn't a url (the schema requires a valid one).");
            continue;
        }
        const source = await ask("  source", sourceFromUrl(url));
        links.push({ source, url });
    }

    const albums = [];
    console.log("\nalbum:");
    const albumSlug = await askList("album", entriesIn("albums"));
    if (albumSlug) {
        let track;
        for (;;) {
            track = Number(await askRequired("  track number"));
            if (Number.isInteger(track) && track > 0) break;
            console.log("  ↳ expected a positive whole number.");
        }
        albums.push({ albumSlug, track });
    }

    const playsIn = [];
    console.log("\nplays in:");
    const activities = nestedEntriesIn("activities");
    for (;;) {
        const activitySlug = await askList("activity", activities);
        if (!activitySlug) break;
        playsIn.push({ activitySlug });
        if (!(await askYesNo("  another activity?"))) break;
    }

    const motifs = [];
    const allMotifs = entriesIn("motifs");
    console.log("\nmotifs:");
    for (;;) {
        const motifSlug = await askList("motif", allMotifs);
        if (!motifSlug) break;
        const at = await askTimestamps();
        const origin = await askYesNo("  is this the motif's origin?");
        const note = await ask("  note [optional]");
        motifs.push({ motifSlug, at, origin, note: note || undefined });
        if (!(await askYesNo("  another motif?"))) break;
    }

    const yaml = trackToYaml({
        title,
        composers,
        description: description || undefined,
        links,
        albums,
        playsIn,
        motifs,
    });

    const target = join(dataDir, "tracks", release, `${slug}.yaml`);
    console.log(`\n--- ${target.replace(`${root}/`, "")} ---\n${yaml}`);

    if (existsSync(target) && !(await askYesNo("file exists — overwrite?"))) {
        console.log("nothing written.");
        return;
    }
    if (!(await askYesNo("write it?", true))) {
        console.log("nothing written.");
        return;
    }

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, yaml);
    console.log(`wrote ${target.replace(`${root}/`, "")} — run \`pnpm dev\` to validate.`);
};

try {
    await main();
} finally {
    rl.close();
}

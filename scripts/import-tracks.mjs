#!/usr/bin/env node
/**
 * Import tracks from a Songbook-style tracks CSV (e.g. `data/arr_tracks.csv`)
 * into `/data/tracks/<release>/<slug>.yaml`.
 *
 * Only metadata is imported: title, order, duration and credits. Everything
 * else the sheet says (type, usage, notes, album appearances and its motif
 * tags) is copied into a comment header on each file as a reference — the
 * motif tags are known to be unreliable, so they are never written as data.
 *
 * Existing files are left alone unless `--force` is passed, so re-running the
 * import never clobbers motifs you've tagged by hand.
 *
 * The schema this emits against lives in `/src/lib/types/data/track.ts` — if
 * the two disagree, that wins.
 *
 * Usage: pnpm data:tracks:import <csv> [--dry-run] [--force]
 */

import {
    existsSync,
    globSync,
    mkdirSync,
    readFileSync,
    writeFileSync
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv.mjs";
import { kebab } from "./lib/slug.mjs";
import { trackToYaml } from "./lib/yaml.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const rel = (path) => relative(root, path);

// --- arguments ---------------------------------------------------------------

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [csvPath] = args.filter((a) => !a.startsWith("--"));
const dryRun = flags.has("--dry-run");
const force = flags.has("--force");

if (!csvPath) {
    console.error("usage: pnpm data:tracks:import <csv> [--dry-run] [--force]");
    process.exit(1);
}

// --- lookups -----------------------------------------------------------------

/** Release slugs from `/data/releases.yaml`, e.g. `2.10_a-realm-awoken`. */
const releaseSlugs = readFileSync(join(dataDir, "releases.yaml"), "utf8")
    .split("\n")
    .map((line) => line.match(/^-\s*slug:\s*(\S+)/)?.[1])
    .filter(Boolean);

/** Sheet patch prefix (`2.1`) → release slug (`2.10_a-realm-awoken`). */
const releaseFor = (major, minor) => {
    const prefix = `${major}.${minor.padEnd(2, "0")}_`;
    return releaseSlugs.find((slug) => slug.startsWith(prefix));
};

/** Every track already on disk, by slug — slugs are global, not per release. */
const existingBySlug = new Map(
    globSync(["data/tracks/*/*.yaml", "data/tracks/*.yaml"], { cwd: root }).map(
        (path) => [
            path
                .split("/")
                .at(-1)
                .replace(/\.ya?ml$/, ""),
            join(root, path)
        ]
    )
);

// --- field parsing -----------------------------------------------------------

/** Collapse whitespace; a cell of only spaces counts as empty. */
const clean = (s) => s.replace(/\s+/g, " ").trim();

const list = (s) => clean(s).split(",").map(clean).filter(Boolean);

/** `2.0 - 01` → { major, minor, number }; tolerates stray spaces. */
const TRACK_NUMBER = /^(\d+)\.(\d+)\s*-\s*(\d+)$/;

/** `05:11` → `5:11`, matching how timestamps are written elsewhere. */
const DURATION = /^(\d+):(\d{2})$/;

// --- import ------------------------------------------------------------------

const records = parseCsvRecords(readFileSync(csvPath, "utf8"));
const source = rel(join(process.cwd(), csvPath));

const warnings = [];
const warn = (line, title, message) =>
    warnings.push(`  line ${line}${title ? ` (${title})` : ""}: ${message}`);

const claimed = new Map(); // slug → line, for collisions within this CSV
const counts = { written: 0, kept: 0, skipped: 0 };

for (const { line, fields: f } of records) {
    const number = clean(f["Track Number"]);
    const title = clean(f["Track Name"]).replace(/^"(.*)"$/, "$1");

    // Section dividers like `2.1 - 000 A Realm Awoken` have no title.
    if (!title) continue;

    const skip = (message) => {
        warn(line, title, `${message} — skipped.`);
        counts.skipped++;
    };

    const numberMatch = number.match(TRACK_NUMBER);
    if (!numberMatch) {
        skip(`no usable track number ("${number}")`);
        continue;
    }
    const [, major, minor, order] = numberMatch;

    const release = releaseFor(major, minor);
    if (!release) {
        skip(`no release in releases.yaml for patch ${major}.${minor}`);
        continue;
    }

    const composers = list(f["Composer"]);
    if (!composers.length) {
        skip("no composer (the schema requires at least one)");
        continue;
    }

    const durationMatch = clean(f["Duration"]).match(DURATION);
    if (!durationMatch) {
        skip(`unreadable duration ("${f["Duration"]}")`);
        continue;
    }
    const duration = `${Number(durationMatch[1])}:${durationMatch[2]}`;

    const slug = kebab(title);
    const target = join(dataDir, "tracks", release, `${slug}.yaml`);

    if (claimed.has(slug)) {
        skip(
            `slug "${slug}" already used by line ${claimed.get(slug)} of this CSV`
        );
        continue;
    }
    claimed.set(slug, line);

    const existing = existingBySlug.get(slug);
    if (existing && existing !== target) {
        skip(`slug "${slug}" already exists at ${rel(existing)}`);
        continue;
    }
    if (existing && !force) {
        counts.kept++;
        continue;
    }

    // Everything we don't import as data, kept as a reference for tidying.
    const sheet = [
        ["type", clean(f["Type"])],
        ["usage", clean(f["Usage"])],
        ["notes", clean(f["Notes"])],
        ["motifs originating here", clean(f["Motifs from this piece"])],
        ["motifs used", clean(f["Motifs/themes used"])],
        ["orchestral", clean(f["Orchestral"])],
        ["concert", clean(f["Concert"])],
        ["remix", clean(f["Remix?"])],
        ["the primals", clean(f["The Primals"])],
        ["the primals live", clean(f["The Primals Live"])]
    ].filter(([, value]) => value);

    const banner = [
        `Imported from ${source} line ${line} (${number}).`,
        ...(sheet.length
            ? [
                  "Sheet notes below are unverified (motifs especially) — tidy, then",
                  "delete this header.",
                  ...sheet.map(([key, value]) => `  ${key}: ${value}`)
              ]
            : [])
    ];

    const yaml = trackToYaml(
        {
            title,
            composers,
            arrangers: list(f["Arranger"]),
            lyricists: list(f["Lyricist"]),
            performers: list(f["Performer"]),
            order: Number(order),
            duration
        },
        { banner }
    );

    if (dryRun) {
        console.log(`--- ${rel(target)} ---\n${yaml}`);
    } else {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, yaml);
    }
    counts.written++;
}

// --- report ------------------------------------------------------------------

const verb = dryRun ? "would write" : "wrote";
console.log(
    `${verb} ${counts.written}, kept ${counts.kept} existing` +
        `${force ? "" : " (--force to overwrite)"}, skipped ${counts.skipped}.`
);
if (warnings.length) console.log(`\nwarnings:\n${warnings.join("\n")}`);
if (!dryRun && counts.written) console.log("\nrun `pnpm dev` to validate.");

/**
 * YAML emission for the scripts in this directory.
 *
 * Hand-rolled and small on purpose. `@rollup/plugin-yaml` is a bundler plugin
 * rather than something callable from the command line, and pulling a parser in
 * for a handful of dev scripts isn't worth the dependency.
 *
 * The schemas these emit against live in `/src/lib/types/data/` — if the two
 * ever disagree, those win.
 */

const needsQuotes = (s, { flow = false } = {}) =>
    s === "" ||
    s !== s.trim() ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(s) ||
    /:\s|\s#/.test(s) ||
    /[\n\r]/.test(s) ||
    /^(?:true|false|null|~|-?\d+(?:\.\d+)?|\d+:\d+)$/i.test(s) ||
    (flow && /[,[\]{}]/.test(s));

export const scalar = (value, options) => {
    const s = String(value);
    return needsQuotes(s, options) ? JSON.stringify(s) : s;
};

export const flowSeq = (values) =>
    `[${values.map((v) => scalar(v, { flow: true })).join(", ")}]`;

/** Timestamps are always quoted — bare `1:20` is sexagesimal in YAML 1.1. */
export const quotedFlowSeq = (values) =>
    `[${values.map((v) => JSON.stringify(String(v))).join(", ")}]`;

/** Emit `key: value` pairs at `indent`, skipping undefined/empty entries. */
export const block = (pairs, indent = "") =>
    pairs
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => `${indent}${key}: ${value}`);

const banner = (text) => (text ? [`# ${text}`] : []);

const links = (lines, sources) => {
    if (!sources?.length) return;
    lines.push("links:");
    for (const link of sources) {
        lines.push(`    - source: ${scalar(link.source)}`);
        lines.push(`      url: ${scalar(link.url)}`);
        lines.push(
            ...block([["note", link.note && scalar(link.note)]], "      "),
        );
    }
};

/** `/data/tracks/<release>/<slug>.yaml` — see `/src/lib/types/data/track.ts`. */
export const trackToYaml = (track, options = {}) => {
    const lines = [
        ...banner(options.banner),
        `title: ${scalar(track.title)}`,
        `composers: ${flowSeq(track.composers)}`,
        ...block([
            ["description", track.description && scalar(track.description)],
        ]),
        ...block([["order", track.order]]),
    ];

    links(lines, track.links);

    if (track.albums?.length) {
        lines.push("albums:");
        for (const album of track.albums) {
            lines.push(`    - albumSlug: ${scalar(album.albumSlug)}`);
            lines.push(`      track: ${album.track}`);
        }
    }

    if (track.playsIn?.length) {
        lines.push("playsIn:");
        for (const activity of track.playsIn) {
            lines.push(`    - activitySlug: ${scalar(activity.activitySlug)}`);
        }
    }

    if (track.motifs?.length) {
        lines.push("motifs:");
        for (const motif of track.motifs) {
            lines.push(`    - motifSlug: ${scalar(motif.motifSlug)}`);
            if (motif.origin) lines.push("      origin: true");
            lines.push(`      at: ${quotedFlowSeq(motif.at)}`);
            lines.push(
                ...block(
                    [["note", motif.note && scalar(motif.note)]],
                    "      ",
                ),
            );
        }
    }

    return `${lines.join("\n")}\n`;
};

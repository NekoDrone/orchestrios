import { excerpt } from "#/lib/search/engine";
import type { Range } from "#/lib/search/engine";
import type { SongbookDocument, SongbookHit } from "#/lib/search/songbook";
import { linkOptions } from "@tanstack/react-router";

export const hitLinkOptions = (doc: SongbookDocument) => {
    switch (doc.kind) {
        case "track":
            return linkOptions({
                to: "/track/$trackSlug",
                params: { trackSlug: doc.slug },
            });
        case "motif":
            return linkOptions({
                to: "/motif/$motifSlug",
                params: { motifSlug: doc.slug },
            });
        case "activity":
            return linkOptions({
                to: "/activity/$activitySlug",
                params: { activitySlug: doc.slug },
            });
    }
};

export const rangesFor = (
    hit: SongbookHit,
    key: string,
    text: string,
): Array<Range> =>
    hit.matches.find((m) => m.key === key && m.text === text)?.ranges ?? [];

export type HitContext = { label: string; text: string; ranges: Array<Range> };

export const hitContext = (
    hit: SongbookHit,
    shown: ReadonlySet<string>,
    radius = 60,
): HitContext | null => {
    const match = hit.matches.find((m) => !shown.has(m.key));
    if (!match) return null;
    return { label: match.label, ...excerpt(match.text, match.ranges, radius) };
};

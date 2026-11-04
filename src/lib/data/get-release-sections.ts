import { tracksParsed } from "#/lib/load";
import { searchTrackSlugs } from "#/lib/search/songbook";
import type { Release } from "#/lib/types/data/releases";
import { sortTracksByRelease } from "#/lib/utils/track";

export type ReleaseSection = {
    release: Release;
    tracks: typeof tracksParsed;
};

/**
 * The release-grouped sections of the tracks page, in release order. Groups left empty by
 * filtering are dropped, so this is exactly what gets rendered — the track list and the
 * spine that indexes it both read from here, and so cannot disagree on what exists.
 *
 * A non-blank `query` keeps only the tracks the songbook search finds for it. Tracks stay
 * in catalogue order; the search narrows the list rather than ranking it.
 */
export const getReleaseSections = ({
    originsOnly,
    query = "",
}: {
    originsOnly: boolean;
    query?: string;
}): Array<ReleaseSection> => {
    const matching = query.trim() === "" ? null : searchTrackSlugs(query);

    return sortTracksByRelease(tracksParsed)
        .map(([, tracks]) => ({
            // Grouping is keyed on `track.release.slug`, so every track in a group carries
            // the same release. Groups are never empty, so [0] is always there.
            release: tracks[0].release,
            tracks: tracks.filter(
                (t) =>
                    (!originsOnly || t.motifs.some((m) => m.origin)) &&
                    (!matching || matching.has(t.slug)),
            ),
        }))
        .filter(({ tracks }) => tracks.length !== 0);
};

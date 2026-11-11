import { unwrap, unwrapOr } from "#/lib/result";
import { Activity } from "#/lib/types/data/activity";
import { Album } from "#/lib/types/data/album";
import { Motif } from "#/lib/types/data/motif";
import { Releases } from "#/lib/types/data/releases";
import { Track } from "#/lib/types/data/track";
import { activityReleaseFromSlug } from "#/lib/utils/activity";
import { slugFromPath } from "#/lib/utils/data";
import { trackReleaseFromPath } from "#/lib/utils/track";
import { z } from "zod";

const releasesFile = import.meta.glob("/data/releases.yaml", {
    eager: true,
});
const motifFiles = import.meta.glob("/data/motifs/*.yaml", { eager: true });
const albumFiles = import.meta.glob("/data/albums/*.yaml", { eager: true });
const activityFiles = import.meta.glob("/data/activities/*/*.yaml", {
    eager: true,
});

const trackFiles = import.meta.glob("/data/tracks/*/*.yaml", {
    eager: true,
});

// Files at the wrong nesting level would silently not match — catch them.
const strayTracks = import.meta.glob("/data/tracks/*.yaml", { eager: true });
const strayActivities = import.meta.glob("/data/activities/*.yaml", {
    eager: true,
});

export const releasesParsed = (() => {
    const releasesParseResult = z
        .object({ default: Releases })
        .safeParse(Object.values(releasesFile)[0]);
    if (!releasesParseResult.success) {
        console.error(z.prettifyError(releasesParseResult.error));
        throw new Error(
            "`/data/releases.yaml` was not successfully parsed. Please check that the format of the yaml file follows that of the Releases schema.",
        );
    }

    return releasesParseResult.data.default;
})();

// map of release slug to release object
export const releasesMap = (() => {
    const res = new Map<string, (typeof releasesParsed)[number]>();
    releasesParsed.forEach((release) => res.set(release.slug, release));
    res.set("unreleased", {
        slug: "unreleased",
        name: "Unreleased",
        year: 0,
        shorthand: "UNRL",
    });
    return res;
})();

export const motifsParsed = Object.entries(motifFiles).map(([k, v]) => {
    const motifParse = Motif.safeParse(v);
    if (!motifParse.success) {
        console.error(z.prettifyError(motifParse.error));
        throw new Error(
            `\`${k}\` was not successfully parsed. Please check that the format of the yaml file follows that of the Motif schema.`,
        );
    }

    return { ...motifParse.data, slug: slugFromPath(k) };
});

// map of motif slug to motif object
export const motifsMap = (() => {
    const res = new Map<string, (typeof motifsParsed)[number]>();
    motifsParsed.forEach((motif) => res.set(motif.slug, motif));
    return res;
})();

export const albumsParsed = Object.entries(albumFiles).map(([k, v]) => {
    const albumParse = Album.safeParse(v);
    if (!albumParse.success) {
        console.error(z.prettifyError(albumParse.error));
        throw new Error(
            `\`${k}\` was not successfully parsed. Please check that the format of the yaml file follows that of the Album schema.`,
        );
    }
    return { ...albumParse.data, slug: slugFromPath(k) };
});

// map of album slug to album object
export const albumsMap = (() => {
    const res = new Map<string, (typeof albumsParsed)[number]>();
    albumsParsed.forEach((album) => res.set(album.slug, album));
    return res;
})();

export const activitiesParsed = Object.entries(activityFiles)
    .concat(Object.entries(strayActivities))
    .map(([k, v]) => {
        const activityParse = Activity.safeParse(v);
        if (!activityParse.success) {
            console.error(z.prettifyError(activityParse.error));
            throw new Error(
                `\`${k}\` was not successfully parsed. Please check that the format of the yaml file follows that of the Activity schema.`,
            );
        }

        const segments = k.split("/");
        const activityDirectoryType = segments[segments.length - 2];
        if (activityParse.data.type !== activityDirectoryType) {
            throw new Error(
                `\`${k}\` was not successfully parsed. Please check that the you have placed the right activity type into the right directory. E.g. \`dungeon\`s should go into \`/data/activities/dungeon/sastasha.yaml\`. `,
            );
        }

        return {
            ...activityParse.data,
            // we force unwrap here because we want all activities to associate with a release
            // if an activity exists, it's probably gonna have been released at *some* point in the game
            // it does not make sense for an activity to be playable yet not be released into the game at some point in history.
            release: unwrap(
                activityReleaseFromSlug(activityParse.data.releaseSlug),
            ),
            slug: slugFromPath(k),
        };
    });

// map of activity slug to activity object
export const activitiesMap = (() => {
    const res = new Map<string, (typeof activitiesParsed)[number]>();
    activitiesParsed.forEach((activity) => res.set(activity.slug, activity));
    return res;
})();

export const tracksParsed = Object.entries(trackFiles)
    .map(([k, v]) => {
        const trackParse = Track.safeParse(v);
        if (!trackParse.success) {
            console.error(z.prettifyError(trackParse.error));
            throw new Error(
                `\`${k}\` was not successfully parsed. Please check that the format of the yaml file follows that of the Track schema.`,
            );
        }

        return {
            ...trackParse.data,
            // if an activity is explicitly filed in a directory, we should assume that a release should be findable
            // so we actively force unwrap and crash if there's a nonexistent release on a track filed into a directory
            release: unwrap(trackReleaseFromPath(k)),
            slug: slugFromPath(k),
        };
    })
    .concat(
        // duplicate work because we need to treat failures from the trackReleaseFromPath function differently.
        Object.entries(strayTracks).map(([k, v]) => {
            const trackParse = Track.safeParse(v);
            if (!trackParse.success) {
                console.error(z.prettifyError(trackParse.error));
                throw new Error(
                    `\`${k}\` was not successfully parsed. Please check that the format of the yaml file follows that of the Track schema.`,
                );
            }

            return {
                ...trackParse.data,
                // but here, since we can collect stray tracks, we automatically assume stray tracks are either unreleased
                // or do not belong to a release.
                release: unwrapOr(trackReleaseFromPath(k), {
                    slug: "unreleased",
                    name: "Unreleased",
                    year: 0,
                    shorthand: "UNRL",
                }),
                slug: slugFromPath(k),
            };
        }),
    );

// map of track slug to track object
export const tracksMap = (() => {
    const res = new Map<string, (typeof tracksParsed)[number]>();
    tracksParsed.forEach((track) => res.set(track.slug, track));
    return res;
})();

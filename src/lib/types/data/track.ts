import { Sources } from "#/lib/types/data";
import { Activity } from "#/lib/types/data/activity";
import { Album } from "#/lib/types/data/album";
import { Motif } from "#/lib/types/data/motif";
import { Release } from "#/lib/types/data/releases";
import { z } from "zod";

export const TrackTimestamp = z
    .string()
    .regex(/^\d+:\d{2}(-\d+:\d{2})?$/, 'expected "m:ss" or "m:ss-m:ss"')
    .transform((raw) => {
        const toSeconds = (t: string) => {
            const [m, s] = t.split(":").map(Number);
            return m * 60 + s;
        };
        const [start, end] = raw.split("-");
        return {
            start: toSeconds(start),
            end: end ? toSeconds(end) : undefined,
        };
    });

export type TrackTimestamp = z.infer<typeof TrackTimestamp>;

export const TrackMotif = z.object({
    motifSlug: z.string(), // slug → resolved against motif index
    origin: z.boolean().default(false), // ≤1 per motif across ALL tracks
    at: z.array(TrackTimestamp).min(1),
    note: z.string().optional(),
    clip: z.string().optional(),
});

export type TrackMotif = z.infer<typeof TrackMotif>;

export const Track = z.object({
    title: z.string(),
    composers: z.array(z.string()).min(1),
    arrangers: z.array(z.string()).default([]),
    lyricists: z.array(z.string()).default([]),
    performers: z.array(z.string()).default([]),
    description: z.string().optional(),
    order: z.number().min(1),
    duration: z.templateLiteral([z.string(), ":", z.string()]),
    links: Sources.optional(),
    albums: z
        .array(
            z.object({
                albumSlug: z.string(), // slug → album index
                track: z.number().int().positive(),
            }),
        )
        .default([]),
    playsIn: z
        .array(
            z.object({
                activitySlug: z.string(), // slug → activity index
                note: z.string().optional(),
            }),
        )
        .default([]),
    motifs: z.array(TrackMotif).default([]),
});

export type Track = z.infer<typeof Track>;

export const TrackAlbumResolved = z.object({
    album: Album,
    track: z.number().int().positive(),
    note: z.string().optional(),
});

export type TrackAlbumResolved = z.infer<typeof TrackAlbumResolved>;

export const hasAlbum = (entry: {
    album: Album | undefined;
    track: number;
}): entry is TrackAlbumResolved => {
    return entry.album !== undefined;
};

export const TrackActivityResolved = z.object({
    activity: Activity,
    note: z.string().optional(),
    activitySlug: z.string(),
});

export type TrackActivityResolved = z.infer<typeof TrackActivityResolved>;

export const hasActivity = (entry: {
    activity: Activity | undefined;
}): entry is TrackActivityResolved => {
    return entry.activity !== undefined;
};

export const TrackMotifResolved = z.object({
    motif: Motif,
    origin: z.boolean().default(false), // ≤1 per motif across ALL tracks
    at: z.array(TrackTimestamp).min(1),
    note: z.string().optional(),
    clip: z.string().optional(),
    motifSlug: z.string(),
});

export type TrackMotifResolved = z.infer<typeof TrackMotifResolved>;

export const hasMotif = (entry: {
    motif: Motif | undefined;
    origin: boolean;
    at: Array<TrackTimestamp>;
}): entry is TrackMotifResolved => {
    return entry.motif !== undefined;
};

export const TrackResolved = z.object({
    ...Track.shape,
    albums: z.array(TrackAlbumResolved).default([]),
    playsIn: z.array(TrackActivityResolved).default([]),
    motifs: z.array(TrackMotifResolved),
    slug: z.string(),
    release: z.object({ ...Release.shape }),
});

export type TrackResolved = z.infer<typeof TrackResolved>;

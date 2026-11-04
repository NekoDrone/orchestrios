import {
    activitiesMap,
    activitiesParsed,
    albumsMap,
    motifsMap,
    motifsParsed,
    tracksParsed,
} from "#/lib/load";
import { buildIndex, search } from "#/lib/search/engine";
import type {
    SearchDocument,
    SearchField,
    SearchHit,
} from "#/lib/search/engine";
import type { Activity } from "#/lib/types/data/activity";
import type { Release } from "#/lib/types/data/releases";

export const SEARCH_KINDS = ["track", "motif", "activity"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export const SEARCH_KIND_LABEL: Record<
    SearchKind,
    { singular: string; plural: string }
> = {
    track: { singular: "Track", plural: "Tracks" },
    motif: { singular: "Motif", plural: "Motifs" },
    activity: { singular: "Activity", plural: "Activities" },
};

export const isSearchKind = (value: unknown): value is SearchKind =>
    SEARCH_KINDS.includes(value as SearchKind);

export const ACTIVITY_TYPE_LABEL: Record<Activity["type"], string> = {
    strike: "Strike",
    raid: "Raid",
    dungeon: "Dungeon",
    mission: "Mission",
    destination: "Destination",
    "pvp-map": "PvP Map",
    menu: "Menu",
    cinematic: "Cinematic",
    other: "Other",
};

const WEIGHT = {
    name: 10,
    alias: 8,
    catalogue: 6,
    composer: 5,
    related: 4,
    context: 3,
    prose: 2,
    note: 1.5,
} as const;

type WithSlug = { slug: string };

export type TrackDocument = WithSlug &
    SearchDocument<
        "track",
        {
            code: string;
            composers: Array<string>;
            release: Release;
            duration: string;
            hasOrigin: boolean;
            motifCount: number;
            heardIn?: string;
        }
    >;

export type MotifDocument = WithSlug &
    SearchDocument<
        "motif",
        {
            aka: Array<string>;
            trackCount: number;
            originTrack?: string;
        }
    >;

export type ActivityDocument = WithSlug &
    SearchDocument<
        "activity",
        {
            type: Activity["type"];
            typeLabel: string;
            release: Release;
        }
    >;

export type SongbookDocument = TrackDocument | MotifDocument | ActivityDocument;
export type SongbookHit = SearchHit<SongbookDocument>;

const field = (
    key: string,
    label: string,
    text: string | undefined,
    weight: number,
): Array<SearchField> =>
    text && text.trim().length > 0 ? [{ key, label, text, weight }] : [];

export const trackCode = (release: Release, order: number) =>
    `${release.shorthand}-${String(order).padStart(3, "0")}`;

const trackDocuments = (): Array<TrackDocument> =>
    tracksParsed.map((track): TrackDocument => {
        const code = trackCode(track.release, track.order);

        const motifFields = track.motifs.flatMap((m) => {
            const motif = motifsMap.get(m.motifSlug);
            if (!motif) return [];
            return [
                ...field("motif", "Motif", motif.name, WEIGHT.related),
                ...motif.aka.flatMap((aka) =>
                    field(
                        "motif",
                        `Motif (${motif.name})`,
                        aka,
                        WEIGHT.context,
                    ),
                ),
                ...field(
                    "motif-note",
                    `${motif.name} motif`,
                    m.note,
                    WEIGHT.note,
                ),
            ];
        });

        const activityNames: Array<string> = [];
        const activityFields = track.playsIn.flatMap((p) => {
            const activity = activitiesMap.get(p.activitySlug);
            if (!activity) return [];
            activityNames.push(activity.name);
            return [
                ...field("activity", "Heard in", activity.name, WEIGHT.related),
                ...field(
                    "activity-note",
                    `In ${activity.name}`,
                    p.note,
                    WEIGHT.note,
                ),
            ];
        });

        const albumFields = track.albums.flatMap((a) =>
            field(
                "album",
                "Album",
                albumsMap.get(a.albumSlug)?.title,
                WEIGHT.context,
            ),
        );

        return {
            id: `track:${track.slug}`,
            kind: "track",
            title: track.title,
            fields: [
                ...field("title", "Title", track.title, WEIGHT.name),
                ...field("catalogue", "Catalogue no.", code, WEIGHT.catalogue),
                ...track.composers.flatMap((c) =>
                    field("composer", "Composer", c, WEIGHT.composer),
                ),
                ...motifFields,
                ...activityFields,
                ...field(
                    "release",
                    "Release",
                    track.release.name,
                    WEIGHT.context,
                ),
                ...albumFields,
                ...field(
                    "description",
                    "Description",
                    track.description,
                    WEIGHT.prose,
                ),
            ],
            meta: {
                code,
                composers: track.composers,
                release: track.release,
                duration: track.duration,
                hasOrigin: track.motifs.some((m) => m.origin),
                motifCount: track.motifs.length,
                heardIn: activityNames[0],
            },
            slug: track.slug,
        };
    });

const motifDocuments = (): Array<MotifDocument> =>
    motifsParsed.map((motif): MotifDocument => {
        const tracks = tracksParsed.filter((t) =>
            t.motifs.some((m) => m.motifSlug === motif.slug),
        );
        const originTrack = tracks.find((t) =>
            t.motifs.some((m) => m.motifSlug === motif.slug && m.origin),
        );

        return {
            id: `motif:${motif.slug}`,
            kind: "motif",
            title: motif.name.trim(),
            fields: [
                ...field("title", "Name", motif.name, WEIGHT.name),
                ...motif.aka.flatMap((aka) =>
                    field("aka", "Also known as", aka, WEIGHT.alias),
                ),
                ...motif.related.flatMap((r) =>
                    field(
                        "related",
                        `Related (${r.relation})`,
                        motifsMap.get(r.motifSlug)?.name,
                        WEIGHT.context,
                    ),
                ),
                ...field(
                    "origin",
                    "Origin",
                    originTrack?.title,
                    WEIGHT.context,
                ),
                ...field(
                    "description",
                    "Description",
                    motif.description,
                    WEIGHT.prose,
                ),
            ],
            meta: {
                aka: motif.aka,
                trackCount: tracks.length,
                originTrack: originTrack?.title,
            },
            slug: motif.slug,
        };
    });

const activityDocuments = (): Array<ActivityDocument> =>
    activitiesParsed.map((activity): ActivityDocument => {
        const typeLabel = ACTIVITY_TYPE_LABEL[activity.type];
        const parent = activity.parentActivitySlug
            ? activitiesMap.get(activity.parentActivitySlug)
            : undefined;

        return {
            id: `activity:${activity.slug}`,
            kind: "activity",
            title: activity.name,
            fields: [
                ...field("title", "Name", activity.name, WEIGHT.name),
                ...field("type", "Type", typeLabel, WEIGHT.related),
                ...field(
                    "flavor",
                    "Flavor text",
                    activity.flavorText,
                    WEIGHT.related,
                ),
                ...field("parent", "Part of", parent?.name, WEIGHT.context),
                ...field(
                    "release",
                    "Release",
                    activity.release.name,
                    WEIGHT.context,
                ),
                ...field(
                    "description",
                    "Description",
                    activity.description,
                    WEIGHT.prose,
                ),
            ],
            meta: {
                type: activity.type,
                typeLabel,
                release: activity.release,
            },
            slug: activity.slug,
        };
    });

export const songbookDocuments: ReadonlyArray<SongbookDocument> = [
    ...trackDocuments(),
    ...motifDocuments(),
    ...activityDocuments(),
];

export const songbookIndex = buildIndex(songbookDocuments);

export const searchSongbook = (
    query: string,
    {
        kinds,
        limit,
    }: { kinds?: ReadonlyArray<SearchKind>; limit?: number } = {},
): Array<SongbookHit> =>
    search(songbookIndex, query, {
        filter: kinds ? (doc) => kinds.includes(doc.kind) : undefined,
        limit,
    });

export const searchTrackSlugs = (query: string): Set<string> =>
    new Set(
        searchSongbook(query, { kinds: ["track"] }).map((hit) => hit.doc.slug),
    );

export type HitGroup<
    THit extends { doc: { kind: SearchKind }; score: number },
> = { kind: SearchKind; hits: Array<THit> };

export const groupHits = <
    THit extends { doc: { kind: SearchKind }; score: number },
>(
    hits: ReadonlyArray<THit>,
): Array<HitGroup<THit>> => {
    const groups = new Map<SearchKind, Array<THit>>();
    for (const hit of hits) {
        const group = groups.get(hit.doc.kind);
        if (group) group.push(hit);
        else groups.set(hit.doc.kind, [hit]);
    }
    return [...groups]
        .map(([kind, kindHits]) => ({ kind, hits: kindHits }))
        .sort((a, b) => b.hits[0].score - a.hits[0].score);
};

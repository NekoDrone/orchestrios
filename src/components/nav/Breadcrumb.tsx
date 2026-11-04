import { getTrackBySlug } from "#/lib/data/get-track-by-slug";
import { toRomanNumeral } from "#/lib/utils";
import type { Enumify } from "#/lib/utils";
import { useLocation } from "@tanstack/react-router";

const PathsToCrumb: Record<string, string> = {
    tracks: "by track",
    releases: "by release",
    motifs: "by motif",
    albums: "by album",
    activities: "by activity",
    about: "about the songbook",
    search: "search the songbook",
    track: "",
} as const;
type PathsToCrumb = Enumify<typeof PathsToCrumb>;

export const Breadcrumb = () => {
    const { pathname } = useLocation();
    const segments = pathname.split("/").filter((p) => p.length > 0);
    const breadcrumbText: Array<string> = [];
    if (segments.some((s) => s === "track" && segments.length > 1)) {
        const trackIndex = segments.findIndex((s) => s === "track");
        const track = getTrackBySlug(segments[trackIndex + 1]);
        if (!track.ok)
            throw new Error(
                "Breadcrumb could not find track even though you were in tracks page. Did you supply a valid track name?",
            );
        const release = track.value.release;
        const releaseCardinality = Number.parseInt(release.slug.split("_")[0]);
        breadcrumbText.push(
            `${releaseCardinality === 0
                ? "Prelude"
                : toRomanNumeral(releaseCardinality)
            } - ${release.shorthand}`,
        );
        breadcrumbText.push(track.value.title);
    }
    const finalBreadcrumbText = ["parachoral"]
        .concat(
            pathname
                .split("/")
                .map((p) => {
                    const text = PathsToCrumb[p] ?? "";
                    if (p === "track") {
                        return text;
                    }
                    return text;
                })
                .filter((p) => p.length > 0),
        )
        .concat(breadcrumbText);

    return (
        <nav
            aria-label="Breadcrumb"
            className="flex font-mono font-light text-[11px] pt-4 uppercase text-subtext-1 tracking-widest"
        >
            {finalBreadcrumbText.join(" · ")}
        </nav>
    );
};

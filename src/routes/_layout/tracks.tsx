import { CountUp } from "#/components/animated/CountUp";
import { Breadcrumb } from "#/components/nav/Breadcrumb";
import { PageWrapper } from "#/components/page/PageWrapper";
import { SortStrategy, Toolbar } from "#/components/page/Toolbar";
import { TrackSpine } from "#/components/tracks/TrackSpine";
import { ByRelease } from "#/components/tracks/TracksSection/ByRelease";
import { getReleaseSections } from "#/lib/data/get-release-sections";
import type { ReleaseSection } from "#/lib/data/get-release-sections";
import { useAtmosphereColor } from "#/lib/hooks/useAtmosphere";
import { tracksParsed } from "#/lib/load";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { useDeferredValue, useMemo, useState } from "react";

export const Route = createFileRoute("/_layout/tracks")({
    component: RouteComponent,
});

function RouteComponent() {
    const [query, setQuery] = useState("");
    const [originsOnly, setOriginsOnly] = useState(false);
    const [sortStrategy, setSortStrategy] = useState<SortStrategy>(
        SortStrategy.RELEASE,
    );
    useAtmosphereColor("#c7a65b18");

    // One derivation, shared by the spine and the list so they cannot drift.
    const deferredQuery = useDeferredValue(query);
    const sections = useMemo(
        () => getReleaseSections({ originsOnly, query: deferredQuery }),
        [originsOnly, deferredQuery],
    );
    const tracksCount = sections.reduce(
        (acc, { tracks }) => acc + tracks.length,
        0,
    );

    return (
        <PageWrapper variant="half">
            <Breadcrumb />
            <section className="pt-8 max-w-[1080px]">
                <p className="font-light font-sans text-accent uppercase tracking-[0.42em] text-[11px] m-0">
                    Arranged by
                </p>
                <h1 className="font-medium text-[42px] tracking-wide">
                    Tracks
                </h1>
                <p className="text-[18px] text-subtext-1  max-w-xl">
                    There are{" "}
                    <CountUp
                        to={tracksParsed.length}
                        className="text-accent-alt underline"
                        duration={1}
                        startOnView={false}
                    />{" "}
                    tracks across Destiny's history. Each of them bringing to
                    life the way a Guardian feels in a particular moment. This
                    is every one of them.
                </p>
                <Toolbar
                    query={query}
                    setQuery={setQuery}
                    showOriginsToggle={true}
                    originsOnly={originsOnly}
                    setOriginsOnly={setOriginsOnly}
                    sortStrategy={sortStrategy}
                    setSortStrategy={setSortStrategy}
                    placeholder="Search by title, composer, motif, or activity"
                    numberFound={tracksCount}
                />
            </section>

            <div className="grid grid-cols-[54px_1fr] gap-8 pt-7">
                {sortStrategy === SortStrategy.RELEASE ? (
                    <TrackSpine sections={sections} />
                ) : (
                    <div />
                )}
                <div>
                    <div
                        className="text-[10px] tracking-[0.28em] uppercase pt-0 pr-[10px] pb-[12px] pl-1 border-b border-text/13 font-mono text-subtext-0 grid grid-cols-[86px_1.5fr_1.25fr_1.05fr_108px_26px] gap-4 items-baseline mb-6"
                        aria-hidden="true"
                    >
                        <span>No.</span>
                        <span> Title </span>
                        <span> Composers </span>
                        <span> Heard in </span>
                        <span className="text-right"> Motifs </span>
                        <span />
                    </div>
                    <TracksSectionWrapper
                        sections={sections}
                        sortStrategy={sortStrategy}
                    />
                </div>
            </div>
        </PageWrapper>
    );
}

const TracksSectionWrapper = ({
    sections,
    sortStrategy,
}: {
    sections: Array<ReleaseSection>;
    sortStrategy: SortStrategy;
}) => {
    switch (sortStrategy) {
        case SortStrategy.RELEASE:
            return (
                <AnimatePresence initial={true}>
                    {sections.map(({ release, tracks }) => (
                        <ByRelease
                            key={release.slug}
                            release={release}
                            tracks={tracks}
                        />
                    ))}
                </AnimatePresence>
            );
        case SortStrategy.COMPOSER:
            return (
                <p key={sortStrategy}>
                    Pardon our dust. We're not done building this yet!
                </p>
            );
        case SortStrategy.TITLE:
            return (
                <p key={sortStrategy}>
                    Pardon our dust. We're not done building this yet!
                </p>
            );
        case SortStrategy.DATE:
            return (
                <p key={sortStrategy}>
                    Pardon our dust. We're not done building this yet!
                </p>
            );
        default:
            throw new Error(
                "Provided SortStrategy went to default case in switch statemenet. Did you forget to handle the case?",
            );
    }
};

import { Diamond } from "#/components/misc/Diamond";
import { Highlight } from "#/components/search/Highlight";
import type { Range } from "#/lib/search/engine";
import {
    hitContext,
    hitLinkOptions,
    rangesFor,
    type HitContext,
} from "#/lib/search/hit";
import type { SongbookHit } from "#/lib/search/songbook";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import type { MouseEventHandler, ReactNode } from "react";

const SHOWN_COMPACT = new Set(["title", "catalogue"]);
const SHOWN_FULL = {
    track: new Set(["title", "catalogue", "composer", "release"]),
    motif: new Set(["title", "aka", "origin"]),
    activity: new Set(["title", "type", "release", "flavor"]),
} as const;

export const SearchResult = ({
    hit,
    variant,
    tabIndex,
    onClick,
}: {
    hit: SongbookHit;
    variant: "compact" | "full";
    tabIndex?: number;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
}) => {
    const { doc } = hit;
    const titleRanges = rangesFor(hit, "title", doc.title);

    if (variant === "compact") {
        const context = hitContext(hit, SHOWN_COMPACT, 36);
        return (
            <Link
                {...hitLinkOptions(doc)}
                tabIndex={tabIndex}
                onClick={onClick}
                className="grid grid-cols-[64px_1fr_auto] gap-3 items-baseline px-3 py-2"
            >
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-subtext-0 truncate">
                    <MarginLabel hit={hit} />
                </span>
                <span className="min-w-0">
                    <span className="flex items-center gap-2 font-serif text-[17px] leading-tight text-text">
                        <span className="truncate">
                            <Highlight text={doc.title} ranges={titleRanges} />
                        </span>
                        {doc.kind === "track" && doc.meta.hasOrigin && (
                            <Diamond size={5} />
                        )}
                    </span>
                    {context && (
                        <span className="block font-mono text-[10.5px] text-subtext-0 truncate mt-0.5">
                            <ContextLine context={context} />
                        </span>
                    )}
                </span>
                <span className="font-mono text-[10.5px] text-subtext-0 whitespace-nowrap">
                    <TrailingDetail hit={hit} />
                </span>
            </Link>
        );
    }

    const context = hitContext(hit, SHOWN_FULL[doc.kind]);
    return (
        <Link
            {...hitLinkOptions(doc)}
            tabIndex={tabIndex}
            onClick={onClick}
            className="group grid grid-cols-[86px_1fr_auto] gap-4 items-baseline px-3 py-4 transition-colors duration-180 ease-[ease] hover:bg-text/3"
        >
            <span className="font-mono text-xs tracking-wide uppercase text-subtext-0">
                <MarginLabel hit={hit} />
            </span>
            <span className="min-w-0 flex flex-col gap-1">
                <span className="flex items-center gap-2.5 font-serif text-[22px] leading-tight text-text transition-colors group-hover:text-accent">
                    <Highlight text={doc.title} ranges={titleRanges} />
                    {doc.kind === "track" && doc.meta.hasOrigin && (
                        <span title="Origin of a motif">
                            <Diamond size={6} />
                        </span>
                    )}
                </span>
                <span className="font-mono text-[11.5px] tracking-[0.06em] text-subtext-1">
                    <Subtitle hit={hit} />
                </span>
                {context && (
                    <span className="italic text-[15px] text-subtext-1 mt-0.5">
                        <ContextLine context={context} />
                    </span>
                )}
            </span>
            <span className="font-mono text-[11.5px] text-subtext-0 whitespace-nowrap">
                <TrailingDetail hit={hit} />
            </span>
        </Link>
    );
};

const MarginLabel = ({ hit }: { hit: SongbookHit }) => {
    const { doc } = hit;
    switch (doc.kind) {
        case "track":
            return (
                <Highlight
                    text={doc.meta.code}
                    ranges={rangesFor(hit, "catalogue", doc.meta.code)}
                />
            );
        case "motif":
            return "Motif";
        case "activity":
            return (
                <Highlight
                    text={doc.meta.typeLabel}
                    ranges={rangesFor(hit, "type", doc.meta.typeLabel)}
                />
            );
    }
};

const TrailingDetail = ({ hit }: { hit: SongbookHit }) => {
    const { doc } = hit;
    switch (doc.kind) {
        case "track":
            return doc.meta.duration;
        case "motif":
            return `${doc.meta.trackCount} ${doc.meta.trackCount === 1 ? "track" : "tracks"}`;
        case "activity":
            return doc.meta.release.shorthand;
    }
};

const Subtitle = ({ hit }: { hit: SongbookHit }) => {
    const { doc } = hit;
    const parts: Array<ReactNode> = [];

    switch (doc.kind) {
        case "track":
            parts.push(
                <Joined
                    key="composers"
                    items={doc.meta.composers.map((c) => ({
                        text: c,
                        ranges: rangesFor(hit, "composer", c),
                    }))}
                    separator=", "
                />,
                <Highlight
                    key="release"
                    text={doc.meta.release.name}
                    ranges={rangesFor(hit, "release", doc.meta.release.name)}
                />,
            );
            break;
        case "motif":
            if (doc.meta.aka.length > 0)
                parts.push(
                    <span key="aka">
                        also{" "}
                        <Joined
                            items={doc.meta.aka.map((a) => ({
                                text: a,
                                ranges: rangesFor(hit, "aka", a),
                            }))}
                            separator=", "
                        />
                    </span>,
                );
            if (doc.meta.originTrack)
                parts.push(
                    <span key="origin">
                        first heard in{" "}
                        <Highlight
                            text={doc.meta.originTrack}
                            ranges={rangesFor(
                                hit,
                                "origin",
                                doc.meta.originTrack,
                            )}
                        />
                    </span>,
                );
            break;
        case "activity": {
            parts.push(
                <Highlight
                    key="release"
                    text={doc.meta.release.name}
                    ranges={rangesFor(hit, "release", doc.meta.release.name)}
                />,
            );
            const flavor = doc.fields.find((f) => f.key === "flavor")?.text;
            if (flavor)
                parts.push(
                    <span
                        key="flavor"
                        className="font-serif italic text-[14px]"
                    >
                        “
                        <Highlight
                            text={flavor}
                            ranges={rangesFor(hit, "flavor", flavor)}
                        />
                        ”
                    </span>,
                );
            break;
        }
    }

    return <Joined items={parts.map((node) => ({ node }))} separator=" · " />;
};

const Joined = ({
    items,
    separator,
}: {
    items: Array<{ text: string; ranges: Array<Range> } | { node: ReactNode }>;
    separator: string;
}) => (
    <>
        {items.map((item, i) => (
            <Fragment key={i}>
                {i > 0 && <span className="text-subtext-0">{separator}</span>}
                {"node" in item ? (
                    item.node
                ) : (
                    <Highlight text={item.text} ranges={item.ranges} />
                )}
            </Fragment>
        ))}
    </>
);

const ContextLine = ({ context }: { context: HitContext }) => (
    <>
        <span className="not-italic font-mono text-[10px] tracking-[0.18em] uppercase text-subtext-0">
            {context.label}
        </span>
        <span className="text-subtext-0"> — </span>
        <Highlight text={context.text} ranges={context.ranges} />
    </>
);

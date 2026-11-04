import { Diamond } from "#/components/misc/Diamond";
import { Breadcrumb } from "#/components/nav/Breadcrumb";
import { PageWrapper } from "#/components/page/PageWrapper";
import { SearchResult } from "#/components/search/SearchResult";
import {
    SEARCH_KINDS,
    SEARCH_KIND_LABEL,
    groupHits,
    isSearchKind,
    searchSongbook,
} from "#/lib/search/songbook";
import type { SearchKind, SongbookHit } from "#/lib/search/songbook";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

type SearchParams = { q?: string; type?: SearchKind };

export const Route = createFileRoute("/_layout/search")({
    validateSearch: (search: Record<string, unknown>): SearchParams => ({
        q:
            (typeof search.q === "string" || typeof search.q === "number") &&
                String(search.q) !== ""
                ? String(search.q)
                : undefined,
        type: isSearchKind(search.type) ? search.type : undefined,
    }),
    head: () => ({ meta: [{ title: "Search · parachoral.fm" }] }),
    component: RouteComponent,
});

const SUGGESTIONS = ["Guardian", "Vault of Glass", "Salvatori", "Tribulation"];

function RouteComponent() {
    const navigate = Route.useNavigate();
    const params = Route.useSearch();

    const hydrated = useHydrated();
    const q = hydrated ? (params.q ?? "") : "";
    const type = hydrated ? params.type : undefined;

    const [draft, setDraft] = useState(q);
    useEffect(() => setDraft(q), [q]);

    const setQuery = (value: string) => {
        setDraft(value);
        void navigate({
            search: (prev: any) => ({ ...prev, q: value || undefined }),
            replace: true,
        });
    };

    const setType = (value: SearchKind | undefined) =>
        void navigate({
            search: (prev: any) => ({ ...prev, type: value }),
            replace: true,
        });

    const deferredQuery = useDeferredValue(q);
    const hits = useMemo(() => searchSongbook(deferredQuery), [deferredQuery]);
    const counts = useMemo(() => {
        const res = { track: 0, motif: 0, activity: 0 };
        for (const hit of hits) res[hit.doc.kind]++;
        return res;
    }, [hits]);
    const shown = type ? hits.filter((h) => h.doc.kind === type) : hits;

    return (
        <PageWrapper variant="half">
            <Breadcrumb />
            <section className="pt-8 max-w-[1080px]">
                <p className="font-light font-sans text-accent uppercase tracking-[0.42em] text-[11px] m-0">
                    Searching
                </p>
                <h1 className="font-medium text-[42px] tracking-wide">
                    The Songbook
                </h1>
                <p className="text-[18px] text-subtext-1 max-w-xl">
                    Every track, motif and activity, and everything written
                    about them: composers, albums, the moments a track plays in,
                    and each note in the margins.
                </p>

                <label className="flex items-center gap-3 mt-8 border border-text/13 bg-surface0/50 px-4 py-3.5 transition-colors duration-200 ease-[ease] focus-within:border-accent/40">
                    <Diamond filled={draft !== ""} size={7} />
                    <input
                        className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-text font-serif text-[22px] placeholder:text-text/40"
                        type="search"
                        placeholder="Search by title, composer, motif, or activity"
                        aria-label="Search the songbook"
                        value={draft}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus={!params.q}
                    />
                </label>

                {q !== "" && (
                    <div
                        className="flex flex-wrap items-center gap-2 mt-4"
                        role="group"
                        aria-label="Filter results by kind"
                    >
                        <KindFilter
                            label="All"
                            count={hits.length}
                            active={type === undefined}
                            onSelect={() => setType(undefined)}
                        />
                        {SEARCH_KINDS.map((kind) => (
                            <KindFilter
                                key={kind}
                                label={SEARCH_KIND_LABEL[kind].plural}
                                count={counts[kind]}
                                active={type === kind}
                                onSelect={() => setType(kind)}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section className="pt-10 pb-24" aria-live="polite">
                {q === "" ? (
                    <Suggestions onPick={setQuery} />
                ) : shown.length === 0 ? (
                    <NoResults query={q} filtered={hits.length > 0} />
                ) : type ? (
                    <ResultList hits={shown} />
                ) : (
                    <AnimatePresence initial={false}>
                        {groupHits(shown).map(({ kind, hits: groupHits }) => (
                            <ResultGroup
                                key={kind}
                                kind={kind}
                                hits={groupHits}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </section>
        </PageWrapper>
    );
}

const KindFilter = ({
    label,
    count,
    active,
    onSelect,
}: {
    label: string;
    count: number;
    active: boolean;
    onSelect: () => void;
}) => (
    <button
        type="button"
        aria-pressed={active}
        disabled={count === 0 && !active}
        onClick={onSelect}
        className={
            "appearance-none bg-transparent border font-sans text-[11px] tracking-[0.24em] uppercase px-4 py-2.5 inline-flex items-center gap-2.5 transition-colors duration-200 ease-[ease] disabled:opacity-40 disabled:cursor-default " +
            (active
                ? "border-accent/60 text-accent"
                : "border-text/13 text-text/70 enabled:hover:border-accent/40 enabled:hover:text-text")
        }
    >
        {label}
        <span className="font-mono text-[11px] tracking-normal text-subtext-0">
            {count}
        </span>
    </button>
);

const ResultGroup = ({
    kind,
    hits,
}: {
    kind: SearchKind;
    hits: Array<SongbookHit>;
}) => (
    <motion.section
        className="pb-8"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        aria-label={SEARCH_KIND_LABEL[kind].plural}
    >
        <header className="flex items-center gap-4 mb-2">
            <h2 className="font-medium text-2xl m-0">
                {SEARCH_KIND_LABEL[kind].plural}
            </h2>
            <span className="flex-1 h-px bg-overlay-0" />
            <span className="text-subtext-1">
                {hits.length} {hits.length === 1 ? "result" : "results"}
            </span>
        </header>
        <ResultList hits={hits} />
    </motion.section>
);

const ResultList = ({ hits }: { hits: Array<SongbookHit> }) => (
    <ul className="list-none m-0 p-0 divide-y divide-overlay-0">
        {hits.map((hit) => (
            <li key={hit.doc.id}>
                <SearchResult hit={hit} variant="full" />
            </li>
        ))}
    </ul>
);

const Suggestions = ({ onPick }: { onPick: (query: string) => void }) => (
    <div className="text-subtext-1 text-[18px]">
        <p className="m-0">
            Try a title, a composer, a motif, or somewhere a track is heard.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
            {SUGGESTIONS.map((s) => (
                <button
                    key={s}
                    type="button"
                    onClick={() => onPick(s)}
                    className="appearance-none bg-transparent border border-text/13 px-3 py-1.5 font-mono text-[12px] text-subtext-1 transition-colors duration-200 hover:border-accent/40 hover:text-accent"
                >
                    {s}
                </button>
            ))}
        </div>
    </div>
);

const NoResults = ({
    query,
    filtered,
}: {
    query: string;
    filtered: boolean;
}) => (
    <div className="text-[18px] text-subtext-1">
        <p className="m-0 italic">
            {filtered
                ? `Nothing of that kind matches “${query}”.`
                : `Nothing in the songbook matches “${query}”.`}
        </p>
        <p className="mt-2 text-[16px] text-text/50">
            Every word has to match somewhere, so try fewer words. Think
            something is missing?{" "}
            <a
                href="https://github.com/NekoDrone/parachoral"
                className="text-accent hover:text-text transition-colors"
                target="_blank"
                rel="noreferrer"
            >
                Submit a change
            </a>
            .
        </p>
    </div>
);

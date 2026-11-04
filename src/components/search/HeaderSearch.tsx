import { SearchResult } from "#/components/search/SearchResult";
import { useModalMousedownEffect } from "#/lib/hooks/useModalMousedownEffect";
import { hitLinkOptions } from "#/lib/search/hit";
import {
    SEARCH_KIND_LABEL,
    groupHits,
    searchSongbook,
} from "#/lib/search/songbook";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useHotkeys } from "react-hotkeys-hook";
import {
    useDeferredValue,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import type { KeyboardEvent } from "react";

const PER_KIND = 2;

export const HeaderSearch = () => {
    const navigate = useNavigate();
    const id = useId();
    const listboxId = `${id}-listbox`;
    const optionId = (index: number) => `${id}-option-${index}`;

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState("");
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [shortcut, setShortcut] = useState("⌘K");

    const deferredQuery = useDeferredValue(query);
    const hits = useMemo(() => searchSongbook(deferredQuery), [deferredQuery]);
    const groups = useMemo(() => {
        let offset = 0;
        return groupHits(hits).map((group) => {
            const shown = group.hits.slice(0, PER_KIND);
            const start = offset;
            offset += shown.length;
            return { ...group, shown, start };
        });
    }, [hits]);
    const options = groups.flatMap((g) => g.shown);
    const seeAllIndex = options.length;
    const optionCount = options.length + 1;

    const open = focused && !dismissed && query.trim() !== "";
    const active = Math.min(activeIndex, optionCount - 1);

    useModalMousedownEffect({
        setShowModal: (show) => {
            if (!show) setFocused(false);
        },
        modalRef: containerRef,
    });

    // Platform-appropriate shortcut hint
    useEffect(() => {
        if (!/Mac|iPhone|iPad/i.test(navigator.userAgent))
            setShortcut("Ctrl K");
    }, []);

    const focusInput = () => {
        inputRef.current?.focus();
        inputRef.current?.select();
    };

    // ⌘K / Ctrl K works everywhere, including while typing in a field.
    useHotkeys("meta+k, ctrl+k", focusInput, {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
    });

    // "/" only when not typing. Matched by produced key, regardless of the
    // modifiers a given keyboard layout needs to produce it.
    useHotkeys("/", focusInput, {
        preventDefault: true,
        useKey: true,
        ignoreModifiers: true,
    });

    useEffect(() => {
        if (!open) return;
        document
            .getElementById(optionId(active))
            ?.scrollIntoView({ block: "nearest" });
    }, [active, open]);

    const close = () => {
        setQuery("");
        setFocused(false);
        inputRef.current?.blur();
    };

    const goToAll = () => {
        void navigate({ to: "/search", search: { q: query } });
        close();
    };

    const choose = (index: number) => {
        if (index === seeAllIndex) return goToAll();
        void navigate(hitLinkOptions(options[index].doc));
        close();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            if (open) {
                e.preventDefault();
                setDismissed(true);
            } else {
                close();
            }
            return;
        }
        if (query.trim() === "") return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setDismissed(false);
                setActiveIndex((active + 1) % optionCount);
                break;
            case "ArrowUp":
                e.preventDefault();
                setDismissed(false);
                setActiveIndex((active - 1 + optionCount) % optionCount);
                break;
            case "Enter":
                // Confirming an IME composition is not a request to navigate.
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                choose(e.shiftKey || !open ? seeAllIndex : active);
                break;
        }
    };

    return (
        <div ref={containerRef} className="relative hidden md:block">
            <label className="flex items-center gap-2.5 border border-overlay-1 px-3 py-2 transition-colors duration-200 focus-within:border-accent/40">
                <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    placeholder="Search the songbook"
                    aria-label="Search the songbook"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={open ? optionId(active) : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-[168px] bg-transparent font-mono text-xs font-light text-text outline-none placeholder:text-subtext-0"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setActiveIndex(0);
                        setDismissed(false);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => {
                        const next = e.relatedTarget;
                        if (next && !containerRef.current?.contains(next))
                            setFocused(false);
                    }}
                    onKeyDown={onKeyDown}
                />
                <kbd className="border border-overlay-1 px-1.5 font-mono text-[10px] text-subtext-0 whitespace-nowrap">
                    {shortcut}
                </kbd>
            </label>

            <AnimatePresence>
                {open && (
                    <motion.div
                        id={listboxId}
                        role="listbox"
                        aria-label="Search results"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.1, ease: "easeOut" }}
                        className="absolute right-0 top-full z-50 mt-2 w-[480px] max-h-[min(70vh,640px)] overflow-y-auto border border-overlay-1 bg-surface0 shadow-xl"
                    >
                        {groups.length === 0 && (
                            <p className="m-0 px-4 py-5 italic text-[16px] text-subtext-1">
                                Nothing matches “{deferredQuery.trim()}”.
                            </p>
                        )}

                        {groups.map((group) => (
                            <div
                                key={group.kind}
                                role="group"
                                aria-labelledby={`${id}-${group.kind}`}
                                className="py-1.5 border-b border-overlay-0"
                            >
                                <div
                                    id={`${id}-${group.kind}`}
                                    className="flex justify-between px-3 pt-1.5 pb-1 font-sans text-[10px] font-light uppercase tracking-[0.28em] text-accent"
                                >
                                    <span>
                                        {SEARCH_KIND_LABEL[group.kind].plural}
                                    </span>
                                    {group.hits.length > group.shown.length && (
                                        <span className="font-mono tracking-normal text-subtext-0 normal-case">
                                            {group.shown.length} of{" "}
                                            {group.hits.length}
                                        </span>
                                    )}
                                </div>
                                {group.shown.map((hit, i) => {
                                    const index = group.start + i;
                                    return (
                                        <div
                                            key={hit.doc.id}
                                            id={optionId(index)}
                                            role="option"
                                            aria-selected={index === active}
                                            onMouseMove={() =>
                                                setActiveIndex(index)
                                            }
                                            className={
                                                "transition-colors " +
                                                (index === active
                                                    ? "bg-text/5"
                                                    : "")
                                            }
                                        >
                                            <SearchResult
                                                hit={hit}
                                                variant="compact"
                                                tabIndex={-1}
                                                onClick={close}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        <div
                            id={optionId(seeAllIndex)}
                            role="option"
                            aria-selected={active === seeAllIndex}
                            onMouseMove={() => setActiveIndex(seeAllIndex)}
                            className={
                                "transition-colors " +
                                (active === seeAllIndex ? "bg-text/5" : "")
                            }
                        >
                            <Link
                                to="/search"
                                search={{ q: query }}
                                tabIndex={-1}
                                onClick={close}
                                className="flex items-center justify-between px-3 py-2.5 font-sans text-[11px] font-light uppercase tracking-[0.24em] text-subtext-1 hover:text-accent"
                            >
                                <span className="flex items-center gap-2">
                                    {hits.length === 0
                                        ? "Open search"
                                        : `See all ${hits.length} ${hits.length === 1 ? "result" : "results"}`}
                                    <ArrowRightIcon size={10} />
                                </span>
                                <span className="font-mono text-[10px] tracking-normal normal-case text-subtext-0">
                                    ↑↓ move · ↵ open · ⇧↵ all
                                </span>
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

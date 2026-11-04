import {
    STOPWORDS,
    normalize,
    normalizeText,
    toOriginalRange,
    tokenize,
} from "#/lib/search/normalize";
import type { NormalizedText, Token } from "#/lib/search/normalize";

/**
 * This large comment mostly exists to explain how we do search.
 *
 * Our engine is a small, dependency-free full-text search over an in-memory corpus.
 * Because our data is loaded at build time from data/, we can do all of this in-memory.
 *
 * Documents are a bag of weighted fields. A query is split into terms; every
 * non-stopword term must match *some* field of a document for it to be a hit, and a
 * document's score is the sum, per term, of its best (match quality × field weight).
 * Two bonuses go on top. A phrase bonus, so a title written in full outranks a track
 * that merely mentions those words; and a coverage bonus for how much of a field the
 * query accounts for, so "hope" will prefer "The Hope" over "Hope for the Future".
 *
 * Match quality, best first:
 * - exact:     the term is a whole word in the field
 * - prefix:    a word starts with the term (so results appear while typing)
 * - substring: the term appears mid-word ("light" in "Starlight")
 * - fuzzy:     a word is within one or two edits of the term ("guardain")
 *
 * Fuzzy matching is a fallback: it only applies to a term that matches nothing,
 * anywhere, any other way. A correctly spelled "hope" should not also turn up "home".
 *
 * Substring and fuzzy matching only apply to name-like fields (weight ≥
 * {@link LOOSE_MATCH_MIN_WEIGHT}). Applying them to long descriptions mostly produces
 * noise: a typo of "guardian" would otherwise surface every track whose prose mentions
 * guardians.
 */

export type SearchField = {
    // stable identifier for the kind of field e.g. `title` or `composer`
    key: string;
    // human-readable label, shown when the field explains why a result matched
    label: string;
    text: string;
    // relative importance. titles are ~10, prose is ~2
    weight: number;
};

export type SearchDocument<TKind extends string = string, TMeta = unknown> = {
    id: string;
    kind: TKind;
    title: string;
    // fields to search. multi-valued data (composers, motifs, ...) should be one field per
    // value under a shared key so that a match can point at the specific value.
    fields: Array<SearchField>;
    // multiplier applied to the final score. defaults to 1
    boost?: number;
    meta: TMeta;
};

type IndexedField = SearchField & {
    normalized: NormalizedText;
    tokens: Array<Token>;
};

type IndexedDocument<TDoc> = {
    doc: TDoc;
    fields: Array<IndexedField>;
};

export type SearchIndex<TDoc> = {
    readonly entries: ReadonlyArray<IndexedDocument<TDoc>>;
};

// [start, end)
export type Range = [number, number];

export type FieldMatch = {
    key: string;
    label: string;
    text: string;
    score: number;
    ranges: Array<Range>;
};

export type SearchHit<TDoc> = {
    doc: TDoc;
    score: number;
    matches: Array<FieldMatch>;
};

export type SearchOptions<TDoc> = {
    filter?: (doc: TDoc) => boolean;
    limit?: number;
};

export const MATCH_QUALITY = {
    exact: 1,
    prefix: 0.8,
    substring: 0.45,
    fuzzy: 0.35,
    fuzzyPrefix: 0.3,
} as const;

export const LOOSE_MATCH_MIN_WEIGHT = 3;
const SUBSTRING_MIN_LENGTH = 3;
const STOPWORD_FACTOR = 0.25;
const EXTRA_EDIT_PENALTY = 0.4;

const COVERAGE_BONUS = 0.3;

const PHRASE_BONUS = {
    whole: 1,
    start: 0.6,
    within: 0.4,
} as const;

export const maxEditsFor = (length: number): number =>
    length >= 8 ? 2 : length >= 4 ? 1 : 0;

export const buildIndex = <TDoc extends SearchDocument>(
    docs: ReadonlyArray<TDoc>,
): SearchIndex<TDoc> => ({
    entries: docs.map((doc) => ({
        doc,
        fields: doc.fields
            .filter((field) => field.text.trim().length > 0)
            .map((field) => {
                const normalized = normalize(field.text);
                return {
                    ...field,
                    normalized,
                    tokens: tokenize(normalized.text),
                };
            }),
    })),
});

export const queryTerms = (query: string): Array<string> => [
    ...new Set(tokenize(normalizeText(query)).map((t) => t.value)),
];

export const search = <TDoc extends SearchDocument>(
    index: SearchIndex<TDoc>,
    query: string,
    { filter, limit }: SearchOptions<TDoc> = {},
): Array<SearchHit<TDoc>> => {
    const terms = queryTerms(query);
    if (terms.length === 0) return [];

    const phrase = terms.join(" ");
    const allStopwords = terms.every((t) => STOPWORDS.has(t));
    const isRequired = (term: string) => allStopwords || !STOPWORDS.has(term);

    const entries = filter
        ? index.entries.filter((entry) => filter(entry.doc))
        : index.entries;

    const fuzzyTerms = new Set(
        terms.filter(
            (term) =>
                !entries.some((entry) =>
                    entry.fields.some(
                        (field) =>
                            matchTerm(term, field, { fuzzy: false }).quality >
                            0,
                    ),
                ),
        ),
    );

    const hits: Array<SearchHit<TDoc>> = [];
    for (const entry of entries) {
        const hit = scoreEntry(entry, {
            terms,
            phrase,
            isRequired,
            fuzzyTerms,
        });
        if (hit) hits.push(hit);
    }

    hits.sort(
        (a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title),
    );

    return limit === undefined ? hits : hits.slice(0, limit);
};

type ScoringContext = {
    terms: Array<string>;
    phrase: string;
    isRequired: (term: string) => boolean;
    fuzzyTerms: ReadonlySet<string>;
};

const scoreEntry = <TDoc extends SearchDocument>(
    entry: IndexedDocument<TDoc>,
    { terms, phrase, isRequired, fuzzyTerms }: ScoringContext,
): SearchHit<TDoc> | null => {
    const fieldScores = new Array<number>(entry.fields.length).fill(0);
    const fieldRanges: Array<Array<Range>> = entry.fields.map(() => []);
    let total = 0;

    for (const term of terms) {
        let best = 0;

        entry.fields.forEach((field, i) => {
            const match = matchTerm(term, field, {
                fuzzy: fuzzyTerms.has(term),
            });
            if (match.quality === 0) return;

            const score = match.quality * field.weight;
            fieldScores[i] += score;
            fieldRanges[i].push(...match.ranges);
            best = Math.max(best, score);
        });

        if (best === 0 && isRequired(term)) return null;
        total += STOPWORDS.has(term) ? best * STOPWORD_FACTOR : best;
    }

    if (total === 0) return null;

    let coverageBonus = 0;
    entry.fields.forEach((field, i) => {
        if (fieldRanges[i].length === 0) return;
        const covered = mergeRanges(fieldRanges[i]).reduce(
            (sum, [start, end]) => sum + end - start,
            0,
        );
        const coverage = covered / field.normalized.text.length;
        const fieldBonus = COVERAGE_BONUS * coverage * field.weight;
        fieldScores[i] += fieldBonus;
        coverageBonus = Math.max(coverageBonus, fieldBonus);
    });

    let phraseBonus = 0;
    entry.fields.forEach((field, i) => {
        const text = field.normalized.text;
        const at = ` ${text}`.indexOf(` ${phrase}`);
        if (at === -1) return;

        const kind = text === phrase ? "whole" : at === 0 ? "start" : "within";
        if (kind !== "whole" && terms.length === 1) return;

        const fieldBonus = PHRASE_BONUS[kind] * field.weight;
        fieldScores[i] += fieldBonus;
        fieldRanges[i].push([at, at + phrase.length]);
        phraseBonus = Math.max(phraseBonus, fieldBonus);
    });

    const matches: Array<FieldMatch> = [];
    entry.fields.forEach((field, i) => {
        if (fieldRanges[i].length === 0) return;
        matches.push({
            key: field.key,
            label: field.label,
            text: field.text,
            score: fieldScores[i],
            ranges: mergeRanges(
                fieldRanges[i].map(([start, end]) =>
                    toOriginalRange(field.normalized, start, end),
                ),
            ),
        });
    });
    matches.sort((a, b) => b.score - a.score);

    return {
        doc: entry.doc,
        score: (total + coverageBonus + phraseBonus) * (entry.doc.boost ?? 1),
        matches,
    };
};

type TermMatch = { quality: number; ranges: Array<Range> };

const NO_MATCH: TermMatch = { quality: 0, ranges: [] };

export const matchTerm = (
    term: string,
    field: Pick<IndexedField, "normalized" | "tokens" | "weight">,
    { fuzzy = true }: { fuzzy?: boolean } = {},
): TermMatch => {
    let quality = 0;
    const ranges: Array<Range> = [];

    for (const token of field.tokens) {
        if (token.value === term) {
            quality = Math.max(quality, MATCH_QUALITY.exact);
            ranges.push([token.start, token.start + token.value.length]);
        } else if (token.value.startsWith(term)) {
            quality = Math.max(quality, MATCH_QUALITY.prefix);
            ranges.push([token.start, token.start + term.length]);
        }
    }

    const loose = field.weight >= LOOSE_MATCH_MIN_WEIGHT;
    if (!loose) return quality > 0 ? { quality, ranges } : NO_MATCH;

    if (term.length >= SUBSTRING_MIN_LENGTH) {
        const text = field.normalized.text;
        for (
            let at = text.indexOf(term);
            at !== -1;
            at = text.indexOf(term, at + 1)
        ) {
            if (at === 0 || text[at - 1] === " ") continue;
            quality = Math.max(quality, MATCH_QUALITY.substring);
            ranges.push([at, at + term.length]);
        }
    }

    if (quality > 0) return { quality, ranges };

    const maxEdits = fuzzy ? maxEditsFor(term.length) : 0;
    if (maxEdits === 0) return NO_MATCH;

    for (const token of field.tokens) {
        const near = fuzzyMatchToken(term, token.value, maxEdits);
        if (!near) continue;
        if (near.quality > quality) {
            quality = near.quality;
            ranges.length = 0;
        }
        if (near.quality === quality) {
            ranges.push([token.start, token.start + near.length]);
        }
    }

    return quality > 0 ? { quality, ranges } : NO_MATCH;
};

const fuzzyMatchToken = (
    term: string,
    token: string,
    maxEdits: number,
): { quality: number; length: number } | null => {
    const quality = (base: number, edits: number) =>
        base * (1 - EXTRA_EDIT_PENALTY * (edits - 1));

    if (Math.abs(token.length - term.length) <= maxEdits) {
        const edits = editDistance(term, token, maxEdits);
        if (edits <= maxEdits)
            return {
                quality: quality(MATCH_QUALITY.fuzzy, edits),
                length: token.length,
            };
    }

    let best: { quality: number; length: number } | null = null;
    for (
        let length = Math.max(1, term.length - maxEdits);
        length <= Math.min(token.length - 1, term.length + maxEdits);
        length++
    ) {
        const edits = editDistance(term, token.slice(0, length), maxEdits);
        if (edits > maxEdits) continue;
        const q = quality(MATCH_QUALITY.fuzzyPrefix, edits);
        if (!best || q > best.quality) best = { quality: q, length };
    }
    return best;
};

export const editDistance = (a: string, b: string, max = Infinity): number => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;

    let prevPrev: Array<number> = [];
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);

    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let value = Math.min(
                prev[j] + 1,
                current[j - 1] + 1,
                prev[j - 1] + cost,
            );
            if (
                i > 1 &&
                j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1]
            ) {
                value = Math.min(value, prevPrev[j - 2] + 1);
            }
            current.push(value);
            rowMin = Math.min(rowMin, value);
        }
        if (rowMin > max) return max + 1;
        prevPrev = prev;
        prev = current;
    }

    return prev[b.length];
};

export const mergeRanges = (ranges: Array<Range>): Array<Range> => {
    const sorted = ranges
        .filter(([start, end]) => end > start)
        .toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);

    const merged: Array<Range> = [];
    for (const [start, end] of sorted) {
        const last = merged.at(-1);
        if (last && start <= last[1]) last[1] = Math.max(last[1], end);
        else merged.push([start, end]);
    }
    return merged;
};

export type HighlightSegment = { text: string; highlighted: boolean };

export const segmentHighlights = (
    text: string,
    ranges: ReadonlyArray<Range>,
): Array<HighlightSegment> => {
    const segments: Array<HighlightSegment> = [];
    let cursor = 0;
    for (const [start, end] of mergeRanges([...ranges])) {
        const from = Math.max(start, cursor);
        const to = Math.min(end, text.length);
        if (from >= to) continue;
        if (from > cursor)
            segments.push({
                text: text.slice(cursor, from),
                highlighted: false,
            });
        segments.push({ text: text.slice(from, to), highlighted: true });
        cursor = to;
    }
    if (cursor < text.length)
        segments.push({ text: text.slice(cursor), highlighted: false });
    return segments;
};

export const excerpt = (
    text: string,
    ranges: ReadonlyArray<Range>,
    radius = 60,
): { text: string; ranges: Array<Range> } => {
    if (text.length <= radius * 2 || ranges.length === 0)
        return { text, ranges: [...ranges] };

    const [firstStart, firstEnd] = ranges[0];
    let start = Math.max(0, firstStart - radius);
    let end = Math.min(text.length, firstEnd + radius);

    if (start > 0) {
        const space = text.indexOf(" ", start);
        if (space !== -1 && space < firstStart) start = space + 1;
    }
    if (end < text.length) {
        const space = text.lastIndexOf(" ", end);
        if (space > firstEnd) end = space;
    }
    while (start < firstStart && /\s/.test(text[start])) start++;
    while (end > firstEnd && /\s/.test(text[end - 1])) end--;

    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    const shift = prefix.length - start;

    return {
        text: prefix + text.slice(start, end) + suffix,
        ranges: ranges
            .filter(([s, e]) => s >= start && e <= end)
            .map(([s, e]) => [s + shift, e + shift]),
    };
};

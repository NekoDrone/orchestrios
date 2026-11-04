// text normalisation for stuff like S.A.B.E.R. to be searchable as "saber"

export type NormalizedText = {
    text: string;
    starts: Array<number>;
    ends: Array<number>;
};

export type Token = {
    value: string;
    start: number;
};

const DROPPED = /['’ʼ‘`.]/u;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const COMBINING_MARK = /\p{M}/gu;

const foldChar = (char: string): string =>
    char
        .normalize("NFD")
        .replace(COMBINING_MARK, "")
        .toLowerCase()
        .replace(COMBINING_MARK, "");

export const normalize = (input: string): NormalizedText => {
    let text = "";
    const starts: Array<number> = [];
    const ends: Array<number> = [];

    let offset = 0;
    for (const char of input) {
        const start = offset;
        offset += char.length;

        if (DROPPED.test(char)) continue;

        for (const folded of foldChar(char)) {
            if (WORD_CHAR.test(folded)) {
                text += folded;
                starts.push(start);
                ends.push(offset);
            } else if (text.length > 0 && text[text.length - 1] !== " ") {
                text += " ";
                starts.push(start);
                ends.push(offset);
            }
        }
    }

    if (text.endsWith(" ")) {
        text = text.slice(0, -1);
        starts.pop();
        ends.pop();
    }

    return { text, starts, ends };
};

export const normalizeText = (input: string): string => normalize(input).text;

export const tokenize = (normalized: string): Array<Token> => {
    const tokens: Array<Token> = [];
    let start = 0;
    for (const value of normalized.split(" ")) {
        if (value.length > 0) tokens.push({ value, start });
        start += value.length + 1;
    }
    return tokens;
};

export const toOriginalRange = (
    normalized: NormalizedText,
    start: number,
    end: number,
): [number, number] => [normalized.starts[start], normalized.ends[end - 1]];

export const STOPWORDS: ReadonlySet<string> = new Set([
    "a",
    "an",
    "and",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
]);

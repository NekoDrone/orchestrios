/**
 * Minimal RFC 4180 CSV parsing for the scripts in this directory: quoted
 * fields, doubled quotes inside them, and newlines inside quotes. Same
 * reasoning as `yaml.mjs` — not worth a dependency for a few dev scripts.
 */

/** Parse CSV text into an array of rows, each an array of raw string cells. */
export const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (c === '"') {
                quoted = false;
            } else {
                cell += c;
            }
            continue;
        }

        if (c === '"') {
            quoted = true;
        } else if (c === ",") {
            row.push(cell);
            cell = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += c;
        }
    }

    // A trailing newline leaves nothing pending; anything else is a last row.
    if (cell !== "" || row.length) {
        row.push(cell);
        rows.push(row);
    }

    return rows;
};

/** Parse CSV text whose first row is a header into an array of objects. */
export const parseCsvRecords = (text) => {
    const [header, ...rows] = parseCsv(text);
    return rows.map((row, i) => ({
        // 1-indexed, counting the header — matches what a spreadsheet shows.
        line: i + 2,
        fields: Object.fromEntries(header.map((key, j) => [key, row[j] ?? ""]))
    }));
};

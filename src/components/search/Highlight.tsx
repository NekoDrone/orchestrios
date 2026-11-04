import { segmentHighlights } from "#/lib/search/engine";
import type { Range } from "#/lib/search/engine";

export const Highlight = ({
    text,
    ranges = [],
}: {
    text: string;
    ranges?: ReadonlyArray<Range>;
}) => (
    <>
        {segmentHighlights(text, ranges).map((segment, i) =>
            segment.highlighted ? (
                <mark
                    key={i}
                    className="bg-transparent text-accent-alt underline decoration-accent/40 underline-offset-[3px]"
                >
                    {segment.text}
                </mark>
            ) : (
                segment.text
            ),
        )}
    </>
);

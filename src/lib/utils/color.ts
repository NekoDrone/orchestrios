/** `--color-haze` at 13% — the resting tint of the top atmosphere. */
export const DEFAULT_ATMOSPHERE_COLOR = "rgba(97, 126, 180, 0.13)";

/** Per-release tint, keyed on release slug. Unlisted releases fall back to the default. */
export const RELEASE_ATMORPHSERE_COLOR: Record<string, string> = {} as const;

export const isRgbColor = (value: string) => /^rgba?\(/i.test(value.trim());

export const hexToRgba = (hex: string, opacity?: number): string => {
    let normalized = hex.replace("#", "").trim();
    if (normalized.length === 3 || normalized.length === 4) {
        normalized = normalized
            .split("")
            .map((c) => c + c)
            .join("");
    }
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const hasAlphaChannel = normalized.length === 8;
    const alpha =
        opacity ??
        (hasAlphaChannel ? parseInt(normalized.slice(6, 8), 16) / 255 : 1);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

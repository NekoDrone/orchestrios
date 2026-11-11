/**
 * Given the relative path to a YAML file, return the slug.
 * We treat the file's name minus the extension as the slug for that file.
 * This is reusable across the application.
 */
export const slugFromPath = (path: string): string => {
    const arr = path.split("/");
    const res = arr[arr.length - 1];
    return res.replace(/\.ya?ml$/, "");
};

const SOURCE_TYPE_HUMANISE: Record<string, string> = {
    youtube: "YouTube",
    spotify: "Spotify",
    soundcloud: "SoundCloud",
    archive: "Internet Archive",
    "square-enix-store": "Square Enix Store",
};

export const humaniseSourceType = (sourceType: string) =>
    SOURCE_TYPE_HUMANISE[sourceType];

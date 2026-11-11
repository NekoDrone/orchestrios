import { z } from "zod";

export const Release = z.object({
    slug: z.string(),
    name: z.string(),
    year: z.number().int(),
    parentReleaseSlug: z.string().optional(),
    shorthand: z.string().min(2).max(6),
});

export type Release = z.infer<typeof Release>;

export const Releases = z.array(Release);

export type Releases = z.infer<typeof Releases>;

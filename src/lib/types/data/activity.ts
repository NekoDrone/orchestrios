import { z } from "zod";

export const Activity = z.object({
    name: z.string(),
    type: z.enum([
        "zone", // field areas, cities, housing
        "dungeon",
        "trial",
        "raid", // 8-man; normal and savage share music
        "alliance-raid",
        "ultimate",
        "deep-dungeon",
        "field-operation", // Eureka, Bozja, Occult Crescent
        "solo-duty", // instanced MSQ/quest battles
        "pvp",
        "gold-saucer",
        "menu",
        "cinematic",
        "other",
    ]),
    flavorText: z.string().optional(),
    description: z.string().optional(),
    releaseSlug: z.string(),
    parentActivitySlug: z.string().optional(),
});

export type Activity = z.infer<typeof Activity>;

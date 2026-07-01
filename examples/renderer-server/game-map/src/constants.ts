import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Assets live on disk (no bundler/URL imports on the server). Resolve paths
// relative to this file so the example runs from any working directory.
const ASSETS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const village = (file: string) => join(ASSETS_DIR, "villages", file);
const terrain = (file: string) => join(ASSETS_DIR, "terrains", file);

export const COLORS = ["red", "blue", "purple"] as const;
export type Color = (typeof COLORS)[number];

export const VILLAGE_TYPES = ["normal", "barbar"] as const;
export type VillageType = (typeof VILLAGE_TYPES)[number];

export const VILLAGE_SIZES = [1, 2, 3, 4, 5, 6] as const;
export type VillageSize = (typeof VILLAGE_SIZES)[number];

export const TERRAINS = ["forest", "lake", "mine"] as const;
export type Terrain = (typeof TERRAINS)[number];

export const NORMAL_VILLAGE_IMAGES: Record<VillageSize, string> = {
    1: village("village1.webp"),
    2: village("village2.webp"),
    3: village("village3.webp"),
    4: village("village4.webp"),
    5: village("village5.webp"),
    6: village("village6.webp"),
};

export const BARBAR_VILLAGE_IMAGES: Record<VillageSize, string> = {
    1: village("village1_barbar.webp"),
    2: village("village2_barbar.webp"),
    3: village("village3_barbar.webp"),
    4: village("village4_barbar.webp"),
    5: village("village5_barbar.webp"),
    6: village("village6_barbar.webp"),
};

export const TERRAIN_IMAGES: Record<Terrain, string> = {
    forest: terrain("forest.webp"),
    lake: terrain("lake.webp"),
    mine: terrain("mine.webp"),
};

import Village1Webp from "../public/villages/village1.webp";
import Village2Webp from "../public/villages/village2.webp";
import Village3Webp from "../public/villages/village3.webp";
import Village4Webp from "../public/villages/village4.webp";
import Village5Webp from "../public/villages/village5.webp";
import Village6Webp from "../public/villages/village6.webp";
import Village1BarbarWebp from "../public/villages/village1_barbar.webp";
import Village2BarbarWebp from "../public/villages/village2_barbar.webp";
import Village3BarbarWebp from "../public/villages/village3_barbar.webp";
import Village4BarbarWebp from "../public/villages/village4_barbar.webp";
import Village5BarbarWebp from "../public/villages/village5_barbar.webp";
import Village6BarbarWebp from "../public/villages/village6_barbar.webp";
import ForestTerrainWebp from "../public/terrains/forest.webp";
import LakeTerrainWebp from "../public/terrains/lake.webp";
import MineTerrainWebp from "../public/terrains/mine.webp";

export const COLORS = ["red", "blue", "purple"] as const;
export type Color = (typeof COLORS)[number];

export const VILLAGE_TYPES = ["normal", "barbar"] as const;
export type VillageType = (typeof VILLAGE_TYPES)[number];

export const VILLAGE_SIZES = [1, 2, 3, 4, 5, 6] as const;
export type VillageSize = (typeof VILLAGE_SIZES)[number];

export const TERRAINS = ["forest", "lake", "mine"] as const;
export type Terrain = (typeof TERRAINS)[number];

export const NORMAL_VILLAGE_IMAGES: Record<VillageSize, string> = {
    1: Village1Webp,
    2: Village2Webp,
    3: Village3Webp,
    4: Village4Webp,
    5: Village5Webp,
    6: Village6Webp,
};

export const BARBAR_VILLAGE_IMAGES: Record<VillageSize, string> = {
    1: Village1BarbarWebp,
    2: Village2BarbarWebp,
    3: Village3BarbarWebp,
    4: Village4BarbarWebp,
    5: Village5BarbarWebp,
    6: Village6BarbarWebp,
};

export const TERRAIN_IMAGES: Record<Terrain, string> = {
    forest: ForestTerrainWebp,
    lake: LakeTerrainWebp,
    mine: MineTerrainWebp,
};

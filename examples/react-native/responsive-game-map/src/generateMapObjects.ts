import {
    BARBAR_VILLAGE_IMAGES,
    COLORS,
    type ImageAsset,
    NORMAL_VILLAGE_IMAGES,
    TERRAIN_IMAGES,
    TERRAINS,
    VILLAGE_SIZES,
    type VillageSize,
} from "./constants";

export type MapObjectType = "terrain" | "normal" | "barbar";

export interface MapObject {
    id: string;
    playerName: string;
    villageName: string;
    x: number;
    y: number;
    color: string;
    /** Metro asset id for the object's sprite. */
    image: ImageAsset;
    type: MapObjectType;
    size: VillageSize;
}

// Tiny local random generators (replaces faker for a lighter React Native bundle).
const PLAYER_NAMES = ["Wolf", "Raven", "Eagle", "Viper", "Bear", "Fox", "Hawk", "Lynx", "Drake", "Otter"];
const STREET_NAMES = ["Oakridge", "Ironhold", "Stonewall", "Riverside", "Greendale", "Highmoor", "Blackwood", "Sunhaven"];

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const getRandomMapObjectType = (): MapObjectType => pick(["terrain", "normal", "barbar"] as const);

const getRandomObjectColor = (objectType: MapObjectType): string => {
    if (objectType === "terrain") return "darkgreen";
    if (objectType === "barbar") return "gray";
    return pick(COLORS);
};

const getRandomVillageSize = (): VillageSize => pick(VILLAGE_SIZES);

const getObjectImage = (objectType: MapObjectType, size: VillageSize): ImageAsset => {
    if (objectType === "normal") return NORMAL_VILLAGE_IMAGES[size];
    if (objectType === "barbar") return BARBAR_VILLAGE_IMAGES[size];
    return TERRAIN_IMAGES[pick(TERRAINS)];
};

/**
 * Generates map objects in a circular pattern around a specified origin.
 * Each coordinate can only have one object.
 */
export const generateMapObjects = (
    count: number,
    originX: number = 0,
    originY: number = 0,
    spacing: number = 1
): MapObject[] => {
    const objects: MapObject[] = [];
    const usedCoordinates = new Set<string>();

    let radius = 0;
    let objectsGenerated = 0;

    while (objectsGenerated < count) {
        const actualRadius = radius * spacing;
        const pointsAtRadius = radius === 0 ? 1 : Math.ceil(2 * Math.PI * radius);

        for (let i = 0; i < pointsAtRadius && objectsGenerated < count; i++) {
            let x: number, y: number;

            if (radius === 0) {
                x = originX;
                y = originY;
            } else {
                const angle = (i / pointsAtRadius) * 2 * Math.PI;
                x = Math.round(originX + actualRadius * Math.cos(angle));
                y = Math.round(originY + actualRadius * Math.sin(angle));
            }

            const coordKey = `${x},${y}`;
            if (usedCoordinates.has(coordKey)) continue;
            usedCoordinates.add(coordKey);

            const objectType = getRandomMapObjectType();
            const playerName = objectType === "barbar" ? "Barbarian" : pick(PLAYER_NAMES);
            const villageName = objectType === "barbar" ? "Barbarian Camp" : pick(STREET_NAMES);
            const size = getRandomVillageSize();
            const color = getRandomObjectColor(objectType);
            const image = getObjectImage(objectType, size);

            objects.push({
                id: uuid(),
                playerName,
                villageName,
                x,
                y,
                color,
                image,
                type: objectType,
                size,
            });

            objectsGenerated++;
        }

        radius++;
    }

    return objects;
};

import {
    BARBAR_VILLAGE_IMAGES,
    COLORS,
    NORMAL_VILLAGE_IMAGES,
    TERRAIN_IMAGES,
    TERRAINS,
    VILLAGE_SIZES,
    type VillageSize,
} from "./constants";

import { faker } from "@faker-js/faker";

type MapObjectType = "terrain" | "normal" | "barbar";

/**
 * Randomly selects a map object type.
 */
const getRandomMapObjectType = (): MapObjectType => {
    const types: MapObjectType[] = ["terrain", "normal", "barbar"];
    const randomIndex = Math.floor(Math.random() * types.length);
    return types[randomIndex];
};

/**
 *  Randomly selects a color based on the object type.
 */
const getRandomObjectColor = (objectType: MapObjectType): string => {
    if (objectType === "terrain") {
        return "darkgreen";
    }
    if (objectType === "barbar") {
        return "gray";
    }
    return COLORS[Math.floor(Math.random() * COLORS.length)];
};

/**
 * Randomly selects a village size
 */
const getRandomVillageSize = (): VillageSize => {
    return VILLAGE_SIZES[Math.floor(Math.random() * VILLAGE_SIZES.length)];
};

/**
 * gets the image URL for the map object based on its type and size
 */
const getObjectImage = (objectType: MapObjectType, size: VillageSize): string => {
    if (objectType === "normal") {
        return NORMAL_VILLAGE_IMAGES[size];
    }
    if (objectType === "barbar") {
        return BARBAR_VILLAGE_IMAGES[size];
    }
    return TERRAIN_IMAGES[TERRAINS[Math.floor(Math.random() * TERRAINS.length)]];
};

/**
 * Generates map objects in a circular pattern around a specified origin
 * Each coordinate can only have one object
 * @param count - Number of objects to generate
 * @param originX - X coordinate of the center point
 * @param originY - Y coordinate of the center point
 * @param spacing - Spacing multiplier between objects (1 = normal, 2 = double space, etc.)
 */
export const generateMapObjects = (count: number, originX: number = 0, originY: number = 0, spacing: number = 1) => {
    const objects = [];
    const usedCoordinates = new Set<string>();

    let radius = 0;
    let objectsGenerated = 0;

    while (objectsGenerated < count) {
        // Generate objects in a circular pattern at current radius
        const actualRadius = radius * spacing;
        const pointsAtRadius = radius === 0 ? 1 : Math.ceil(2 * Math.PI * radius);

        for (let i = 0; i < pointsAtRadius && objectsGenerated < count; i++) {
            let x: number, y: number;

            if (radius === 0) {
                x = originX;
                y = originY;
            } else {
                // Calculate angle for this point
                const angle = (i / pointsAtRadius) * 2 * Math.PI;
                x = Math.round(originX + actualRadius * Math.cos(angle));
                y = Math.round(originY + actualRadius * Math.sin(angle));
            }

            const coordKey = `${x},${y}`;

            // Skip if coordinate already used
            if (usedCoordinates.has(coordKey)) {
                continue;
            }

            usedCoordinates.add(coordKey);

            const objectType = getRandomMapObjectType();
            const playerName = objectType === "barbar" ? "Barbarian" : faker.internet.username().slice(0, 10);
            const villageName = objectType === "barbar" ? "Barbarian Camp" : faker.location.street().slice(0, 15);
            const size = getRandomVillageSize();
            const color = getRandomObjectColor(objectType);
            const imageUrl = getObjectImage(objectType, size);

            objects.push({
                id: faker.string.uuid(),
                playerName,
                villageName,
                x,
                y,
                color,
                imageUrl,
                type: objectType,
                size,
            });

            objectsGenerated++;
        }

        radius++;
    }

    return objects;
};

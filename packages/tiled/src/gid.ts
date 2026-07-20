/** Tiled GID flip flags (top bits of the 32-bit GID). */
export const GID_FLIP_H = 0x80000000;
export const GID_FLIP_V = 0x40000000;
export const GID_FLIP_D = 0x20000000;
/** Hex-120°-rotation bit; unused on orthogonal maps but must be masked. */
export const GID_ROTATE_HEX = 0x10000000;
export const GID_MASK = 0x0fffffff;

export interface DecodedGid {
    gid: number;
    flipX: boolean;
    flipY: boolean;
    /** Degrees, clockwise. */
    rotate: number;
}

/**
 * Split a raw GID into the tile id and its orientation, expressed in engine
 * terms. The engine applies flips in image-local space BEFORE rotation
 * (renderers do translate → rotate → scale), and Tiled applies its flags as
 * diagonal-first, then horizontal, then vertical. Composing the two gives:
 *
 * | H | V | D | engine                  |
 * |---|---|---|-------------------------|
 * | 0 | 0 | 0 | —                       |
 * | 1 | 0 | 0 | flipX                   |
 * | 0 | 1 | 0 | flipY                   |
 * | 1 | 1 | 0 | flipX + flipY           |
 * | 0 | 0 | 1 | rotate 90 + flipY       |
 * | 1 | 0 | 1 | rotate 90               |
 * | 0 | 1 | 1 | rotate 270              |
 * | 1 | 1 | 1 | rotate 90 + flipX       |
 */
export function decodeGid(raw: number): DecodedGid {
    const u = raw >>> 0;
    const h = (u & GID_FLIP_H) !== 0;
    const v = (u & GID_FLIP_V) !== 0;
    const d = (u & GID_FLIP_D) !== 0;
    const gid = u & GID_MASK;

    if (!d) {
        return { gid, flipX: h, flipY: v, rotate: 0 };
    }
    if (h && v) return { gid, flipX: true, flipY: false, rotate: 90 };
    if (h) return { gid, flipX: false, flipY: false, rotate: 90 };
    if (v) return { gid, flipX: false, flipY: false, rotate: 270 };
    return { gid, flipX: false, flipY: true, rotate: 90 };
}

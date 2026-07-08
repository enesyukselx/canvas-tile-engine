import { RGBA } from "../../utils/color";
import {
    LINE_FRAGMENT_SHADER,
    LINE_VERTEX_SHADER,
    shapeFragmentShaderAA,
    SHAPE_FRAGMENT_SHADER_AA_300,
    SHAPE_FRAGMENT_SHADER_HARD,
    SHAPE_VERTEX_SHADER,
    SHAPE_VERTEX_SHADER_300,
    TEXTURE_FRAGMENT_SHADER,
    TEXTURE_VERTEX_SHADER,
} from "./shaders";

/** A filled rounded box (also used for circles, where radius === half extent). */
export interface ShapeInstance {
    /** Center X in CSS pixels. */
    cx: number;
    /** Center Y in CSS pixels. */
    cy: number;
    /** Half width in CSS pixels. */
    halfW: number;
    /** Half height in CSS pixels. */
    halfH: number;
    /** Corner radii in CSS pixels, [topLeft, topRight, bottomRight, bottomLeft] (0 = sharp). */
    radius: [number, number, number, number];
    /** Rotation around the center in radians. */
    rotation: number;
    /** Normalized RGBA color. */
    color: RGBA;
}

/** A solid colored line segment with a pixel width. */
export interface LineInstance {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    /** Stroke width in CSS pixels. */
    width: number;
    color: RGBA;
}

/** A textured quad (image) in CSS-pixel space. */
export interface ImageInstance {
    texture: WebGLTexture;
    /** Top-left X in CSS pixels. */
    x: number;
    /** Top-left Y in CSS pixels. */
    y: number;
    /** Draw width in CSS pixels. */
    w: number;
    /** Draw height in CSS pixels. */
    h: number;
    /** Rotation around the center in radians. */
    rotation: number;
    /** Opacity multiplier in [0, 1]. */
    alpha: number;
    /** Normalized texcoord of the left/top edge (default: 0). Used for spritesheet frames. */
    u0?: number;
    v0?: number;
    /** Normalized texcoord of the right/bottom edge (default: 1). Used for spritesheet frames. */
    u1?: number;
    v1?: number;
}

type GL = WebGLRenderingContext;

const SHAPE_FLOATS_PER_VERTEX = 14; // pos(2) local(2) halfSize(2) radius(4) color(4)
const LINE_FLOATS_PER_VERTEX = 6; // pos(2) color(4)
const TEXTURE_FLOATS_PER_VERTEX = 4; // pos(2) texcoord(2)

interface ShapeProgram {
    program: WebGLProgram;
    a_position: number;
    a_local: number;
    a_halfSize: number;
    a_radius: number;
    a_color: number;
    u_resolution: WebGLUniformLocation | null;
}

interface LineProgram {
    program: WebGLProgram;
    a_position: number;
    a_color: number;
    u_resolution: WebGLUniformLocation | null;
}

interface TextureProgram {
    program: WebGLProgram;
    a_position: number;
    a_texcoord: number;
    u_resolution: WebGLUniformLocation | null;
    u_texture: WebGLUniformLocation | null;
    u_alpha: WebGLUniformLocation | null;
}

/**
 * Thin batched drawing layer over a raw WebGL context.
 *
 * Each `draw*` call uploads a freshly built vertex array and issues a single
 * draw call, so a layer that paints thousands of rects collapses into one GPU
 * batch. Calls execute immediately and in order, which preserves the engine's
 * layer-based paint order.
 * @internal
 */
export class GLRenderer {
    private gl: GL;

    private shape: ShapeProgram;
    private line: LineProgram;
    private texture: TextureProgram;

    private shapeBuffer: WebGLBuffer;
    private lineBuffer: WebGLBuffer;
    private textureBuffer: WebGLBuffer;

    private textures = new Map<TexImageSource, { texture: WebGLTexture; width: number; height: number }>();

    private cssWidth = 0;
    private cssHeight = 0;

    constructor(gl: GL) {
        this.gl = gl;

        // Derivatives (fwidth) are core in GLSL ES 3.00 but not in ESSL 1.00, and some
        // WebGL2 drivers reject the OES_standard_derivatives extension pragma outright
        // rather than polyfilling it onto ESSL 1.00. So WebGL2 gets a real
        // `#version 300 es` shape shader pair (guaranteed to work, no extension
        // needed); WebGL1 keeps the ESSL 1.00 shader gated on the extension being
        // present, falling back to a hard (non-AA) edge otherwise.
        const isWebGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
        let shapeVertex: string;
        let shapeFragment: string;
        if (isWebGL2) {
            shapeVertex = SHAPE_VERTEX_SHADER_300;
            shapeFragment = SHAPE_FRAGMENT_SHADER_AA_300;
        } else if (gl.getExtension("OES_standard_derivatives")) {
            shapeVertex = SHAPE_VERTEX_SHADER;
            shapeFragment = shapeFragmentShaderAA();
        } else {
            shapeVertex = SHAPE_VERTEX_SHADER;
            shapeFragment = SHAPE_FRAGMENT_SHADER_HARD;
        }

        const shapeProgram = this.createProgram(shapeVertex, shapeFragment);
        this.shape = {
            program: shapeProgram,
            a_position: gl.getAttribLocation(shapeProgram, "a_position"),
            a_local: gl.getAttribLocation(shapeProgram, "a_local"),
            a_halfSize: gl.getAttribLocation(shapeProgram, "a_halfSize"),
            a_radius: gl.getAttribLocation(shapeProgram, "a_radius"),
            a_color: gl.getAttribLocation(shapeProgram, "a_color"),
            u_resolution: gl.getUniformLocation(shapeProgram, "u_resolution"),
        };

        const lineProgram = this.createProgram(LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
        this.line = {
            program: lineProgram,
            a_position: gl.getAttribLocation(lineProgram, "a_position"),
            a_color: gl.getAttribLocation(lineProgram, "a_color"),
            u_resolution: gl.getUniformLocation(lineProgram, "u_resolution"),
        };

        const textureProgram = this.createProgram(TEXTURE_VERTEX_SHADER, TEXTURE_FRAGMENT_SHADER);
        this.texture = {
            program: textureProgram,
            a_position: gl.getAttribLocation(textureProgram, "a_position"),
            a_texcoord: gl.getAttribLocation(textureProgram, "a_texcoord"),
            u_resolution: gl.getUniformLocation(textureProgram, "u_resolution"),
            u_texture: gl.getUniformLocation(textureProgram, "u_texture"),
            u_alpha: gl.getUniformLocation(textureProgram, "u_alpha"),
        };

        this.shapeBuffer = this.createBuffer();
        this.lineBuffer = this.createBuffer();
        this.textureBuffer = this.createBuffer();

        gl.enable(gl.BLEND);
        // Separate alpha blend keeps destination alpha at a_s + a_d(1-a_s); plain
        // blendFunc would square the source alpha in the alpha channel, leaving the
        // (alpha: true) canvas partially transparent under translucent/AA pixels.
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        // Texcoords map screen-top to v=0, which already matches the top row of an
        // uploaded image, so the source must NOT be flipped on upload.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    }

    /**
     * Update the drawing resolution.
     * @param physicalWidth Backing store width (CSS width * dpr).
     * @param physicalHeight Backing store height (CSS height * dpr).
     * @param cssWidth Logical width used for vertex coordinates.
     * @param cssHeight Logical height used for vertex coordinates.
     */
    setSize(physicalWidth: number, physicalHeight: number, cssWidth: number, cssHeight: number) {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        this.gl.viewport(0, 0, physicalWidth, physicalHeight);
    }

    /** Clear the framebuffer with a background color. */
    clear(color: RGBA) {
        const gl = this.gl;
        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // ─── Shapes ───

    drawShapes(shapes: ShapeInstance[]) {
        if (shapes.length === 0) return;
        const gl = this.gl;

        const data = new Float32Array(shapes.length * 6 * SHAPE_FLOATS_PER_VERTEX);
        let o = 0;

        for (const s of shapes) {
            const pad = 1; // 1px skirt so the anti-aliased edge is not clipped
            const hw = s.halfW + pad;
            const hh = s.halfH + pad;
            const cos = Math.cos(s.rotation);
            const sin = Math.sin(s.rotation);

            // Local (unrotated) corner offsets, CCW: TL, TR, BR, BL
            const corners = [
                [-hw, -hh],
                [hw, -hh],
                [hw, hh],
                [-hw, hh],
            ];

            const verts: number[][] = [];
            for (const [lx, ly] of corners) {
                const px = s.cx + lx * cos - ly * sin;
                const py = s.cy + lx * sin + ly * cos;
                verts.push([px, py, lx, ly]);
            }

            // Two triangles: TL, TR, BR and TL, BR, BL
            const order = [0, 1, 2, 0, 2, 3];
            for (const i of order) {
                const [px, py, lx, ly] = verts[i];
                data[o++] = px;
                data[o++] = py;
                data[o++] = lx;
                data[o++] = ly;
                data[o++] = s.halfW;
                data[o++] = s.halfH;
                // Shader quadrant-select order: (bottomRight, topRight, bottomLeft, topLeft)
                data[o++] = s.radius[2];
                data[o++] = s.radius[1];
                data[o++] = s.radius[3];
                data[o++] = s.radius[0];
                data[o++] = s.color[0];
                data[o++] = s.color[1];
                data[o++] = s.color[2];
                data[o++] = s.color[3];
            }
        }

        gl.useProgram(this.shape.program);
        gl.uniform2f(this.shape.u_resolution, this.cssWidth, this.cssHeight);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

        const stride = SHAPE_FLOATS_PER_VERTEX * 4;
        this.enableAttrib(this.shape.a_position, 2, stride, 0);
        this.enableAttrib(this.shape.a_local, 2, stride, 2 * 4);
        this.enableAttrib(this.shape.a_halfSize, 2, stride, 4 * 4);
        this.enableAttrib(this.shape.a_radius, 4, stride, 6 * 4);
        this.enableAttrib(this.shape.a_color, 4, stride, 10 * 4);

        gl.drawArrays(gl.TRIANGLES, 0, shapes.length * 6);

        this.disableAttrib(this.shape.a_position);
        this.disableAttrib(this.shape.a_local);
        this.disableAttrib(this.shape.a_halfSize);
        this.disableAttrib(this.shape.a_radius);
        this.disableAttrib(this.shape.a_color);
    }

    // ─── Lines ───

    drawLines(lines: LineInstance[]) {
        if (lines.length === 0) return;
        const gl = this.gl;

        const data = new Float32Array(lines.length * 6 * LINE_FLOATS_PER_VERTEX);
        let o = 0;

        for (const l of lines) {
            let dx = l.x2 - l.x1;
            let dy = l.y2 - l.y1;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len;
            dy /= len;
            const half = Math.max(l.width, 0.5) / 2;
            // Perpendicular offset
            const nx = -dy * half;
            const ny = dx * half;

            const corners = [
                [l.x1 + nx, l.y1 + ny],
                [l.x1 - nx, l.y1 - ny],
                [l.x2 + nx, l.y2 + ny],
                [l.x2 - nx, l.y2 - ny],
            ];

            const order = [0, 1, 2, 1, 3, 2];
            for (const i of order) {
                data[o++] = corners[i][0];
                data[o++] = corners[i][1];
                data[o++] = l.color[0];
                data[o++] = l.color[1];
                data[o++] = l.color[2];
                data[o++] = l.color[3];
            }
        }

        gl.useProgram(this.line.program);
        gl.uniform2f(this.line.u_resolution, this.cssWidth, this.cssHeight);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

        const stride = LINE_FLOATS_PER_VERTEX * 4;
        this.enableAttrib(this.line.a_position, 2, stride, 0);
        this.enableAttrib(this.line.a_color, 4, stride, 2 * 4);

        gl.drawArrays(gl.TRIANGLES, 0, lines.length * 6);

        this.disableAttrib(this.line.a_position);
        this.disableAttrib(this.line.a_color);
    }

    // ─── Images ───

    /**
     * Draw textured quads. Consecutive items sharing the same texture and alpha
     * collapse into a single buffer upload and draw call, so callers should keep
     * items with the same texture grouped together. Paint order is preserved.
     */
    drawImages(items: ImageInstance[]) {
        if (items.length === 0) return;
        const gl = this.gl;

        gl.useProgram(this.texture.program);
        gl.uniform2f(this.texture.u_resolution, this.cssWidth, this.cssHeight);
        gl.uniform1i(this.texture.u_texture, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);

        const stride = TEXTURE_FLOATS_PER_VERTEX * 4;
        this.enableAttrib(this.texture.a_position, 2, stride, 0);
        this.enableAttrib(this.texture.a_texcoord, 2, stride, 2 * 4);

        const order = [0, 1, 2, 0, 2, 3];

        let start = 0;
        while (start < items.length) {
            const { texture, alpha } = items[start];
            let end = start + 1;
            while (end < items.length && items[end].texture === texture && items[end].alpha === alpha) {
                end++;
            }

            const count = end - start;
            const data = new Float32Array(count * 6 * TEXTURE_FLOATS_PER_VERTEX);
            let o = 0;

            for (let idx = start; idx < end; idx++) {
                const item = items[idx];
                const cx = item.x + item.w / 2;
                const cy = item.y + item.h / 2;
                const hw = item.w / 2;
                const hh = item.h / 2;
                const cos = Math.cos(item.rotation);
                const sin = Math.sin(item.rotation);

                // Corner local offsets with their texcoords. Screen-top maps to v0,
                // matching the top row of the (un-flipped) uploaded image. The UV
                // rect defaults to the full texture; sprite frames narrow it.
                const u0 = item.u0 ?? 0;
                const v0 = item.v0 ?? 0;
                const u1 = item.u1 ?? 1;
                const v1 = item.v1 ?? 1;
                const corners = [
                    [-hw, -hh, u0, v0],
                    [hw, -hh, u1, v0],
                    [hw, hh, u1, v1],
                    [-hw, hh, u0, v1],
                ];

                for (const i of order) {
                    const [lx, ly, u, v] = corners[i];
                    data[o++] = cx + lx * cos - ly * sin;
                    data[o++] = cy + lx * sin + ly * cos;
                    data[o++] = u;
                    data[o++] = v;
                }
            }

            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
            gl.uniform1f(this.texture.u_alpha, alpha);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.drawArrays(gl.TRIANGLES, 0, count * 6);

            start = end;
        }

        this.disableAttrib(this.texture.a_position);
        this.disableAttrib(this.texture.a_texcoord);
    }

    /**
     * Get (or lazily upload) a texture for an image source. Returns null if the
     * source has no dimensions yet (e.g. an image that has not loaded). If the
     * source's dimensions changed since upload (e.g. a resized canvas or a
     * swapped img src), its pixels are re-uploaded automatically; same-size
     * content mutations require {@link invalidateTexture}.
     */
    getTexture(source: TexImageSource): WebGLTexture | null {
        const width = (source as { width?: number }).width ?? 0;
        const height = (source as { height?: number }).height ?? 0;
        if (!width || !height) return null;

        const gl = this.gl;
        const existing = this.textures.get(source);
        if (existing) {
            if (existing.width === width && existing.height === height) return existing.texture;
            gl.bindTexture(gl.TEXTURE_2D, existing.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            existing.width = width;
            existing.height = height;
            return existing.texture;
        }

        const texture = gl.createTexture();
        if (!texture) return null;

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

        this.textures.set(source, { texture, width, height });
        return texture;
    }

    /** Drop the cached texture for a source so the next draw re-uploads its pixels. */
    invalidateTexture(source: TexImageSource) {
        const entry = this.textures.get(source);
        if (!entry) return;
        this.gl.deleteTexture(entry.texture);
        this.textures.delete(source);
    }

    /** Release all GPU resources. */
    dispose() {
        const gl = this.gl;
        for (const { texture } of this.textures.values()) {
            gl.deleteTexture(texture);
        }
        this.textures.clear();
        gl.deleteBuffer(this.shapeBuffer);
        gl.deleteBuffer(this.lineBuffer);
        gl.deleteBuffer(this.textureBuffer);
        gl.deleteProgram(this.shape.program);
        gl.deleteProgram(this.line.program);
        gl.deleteProgram(this.texture.program);
    }

    // ─── Internal helpers ───

    private enableAttrib(location: number, size: number, stride: number, offset: number) {
        if (location < 0) return;
        const gl = this.gl;
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    }

    private disableAttrib(location: number) {
        if (location < 0) return;
        this.gl.disableVertexAttribArray(location);
    }

    private createBuffer(): WebGLBuffer {
        const buffer = this.gl.createBuffer();
        if (!buffer) throw new Error("WebGL: failed to create vertex buffer");
        return buffer;
    }

    private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
        const gl = this.gl;
        const vertex = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragment = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        if (!program) throw new Error("WebGL: failed to create program");

        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);

        // Shaders can be flagged for deletion once linked.
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`WebGL: program link failed: ${log ?? "unknown error"}`);
        }

        return program;
    }

    private compileShader(type: number, source: string): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type);
        if (!shader) throw new Error("WebGL: failed to create shader");

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`WebGL: shader compile failed: ${log ?? "unknown error"}`);
        }

        return shader;
    }
}

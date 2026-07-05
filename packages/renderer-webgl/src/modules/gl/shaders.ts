/**
 * GLSL shader sources for the WebGL renderer.
 *
 * All vertex shaders work in CSS-pixel space: positions are supplied in logical
 * pixels (top-left origin, y-down) and projected to clip space using a
 * `u_resolution` uniform. Device pixel ratio is handled by `gl.viewport`, so the
 * shaders themselves never need to know about it.
 * @internal
 */

// ─── Shape program (anti-aliased rounded boxes / circles) ───

export const SHAPE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_local;
attribute vec2 a_halfSize;
attribute vec4 a_radius;
attribute vec4 a_color;

uniform vec2 u_resolution;

varying vec2 v_local;
varying vec2 v_halfSize;
varying vec4 v_radius;
varying vec4 v_color;

void main() {
    vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    v_local = a_local;
    v_halfSize = a_halfSize;
    v_radius = a_radius;
    v_color = a_color;
}
`;

/**
 * Signed-distance rounded box with per-corner radii. With derivatives available
 * we anti-alias the edge across one pixel; this single shape covers sharp rects,
 * rounded rects and circles (circle = box where radius == halfSize).
 *
 * Radius packing (local space is y-down): x = bottom-right, y = top-right,
 * z = bottom-left, w = top-left.
 */
const SHAPE_FRAGMENT_BODY = `
precision mediump float;

varying vec2 v_local;
varying vec2 v_halfSize;
varying vec4 v_radius;
varying vec4 v_color;

float sdRoundBox(vec2 p, vec2 b, vec4 r) {
    vec2 rr = (p.x > 0.0) ? r.xy : r.zw;
    float cr = (p.y > 0.0) ? rr.x : rr.y;
    vec2 q = abs(p) - b + cr;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - cr;
}

void main() {
    vec4 r = min(v_radius, vec4(min(v_halfSize.x, v_halfSize.y)));
    float dist = sdRoundBox(v_local, v_halfSize, r);
    float alpha = EDGE_ALPHA;
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`;

const SHAPE_FRAGMENT_AA_BODY = SHAPE_FRAGMENT_BODY.replace(
    "EDGE_ALPHA",
    "1.0 - smoothstep(-fwidth(dist), fwidth(dist), dist)"
);

/**
 * Fragment shader variant that anti-aliases using screen-space derivatives.
 * WebGL1 requires the OES_standard_derivatives extension directive; in WebGL2
 * derivatives are core and the directive must be omitted.
 */
export function shapeFragmentShaderAA(isWebGL2: boolean): string {
    return isWebGL2
        ? SHAPE_FRAGMENT_AA_BODY
        : "#extension GL_OES_standard_derivatives : enable\n" + SHAPE_FRAGMENT_AA_BODY;
}

/** Fallback fragment shader (hard edge) when derivatives are unsupported. */
export const SHAPE_FRAGMENT_SHADER_HARD = SHAPE_FRAGMENT_BODY.replace("EDGE_ALPHA", "dist < 0.0 ? 1.0 : 0.0");

// ─── Line program (solid colored thick lines) ───

export const LINE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_color;

uniform vec2 u_resolution;

varying vec4 v_color;

void main() {
    vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    v_color = a_color;
}
`;

export const LINE_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 v_color;
void main() {
    gl_FragColor = v_color;
}
`;

// ─── Texture program (images) ───

export const TEXTURE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texcoord;

uniform vec2 u_resolution;

varying vec2 v_texcoord;

void main() {
    vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    v_texcoord = a_texcoord;
}
`;

export const TEXTURE_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_alpha;
varying vec2 v_texcoord;
void main() {
    vec4 color = texture2D(u_texture, v_texcoord);
    gl_FragColor = vec4(color.rgb, color.a * u_alpha);
}
`;

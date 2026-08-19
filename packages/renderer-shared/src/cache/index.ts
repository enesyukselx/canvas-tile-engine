// Bounded caching shared by every renderer's draw pipeline. Pure data
// structures only: no context, no platform types, and no cache-sizing policy —
// each renderer picks its own bound next to the cost its misses pay.
export { LruCache } from "./lru";

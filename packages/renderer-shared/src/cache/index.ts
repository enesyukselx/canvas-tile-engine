// Bounded caching shared by every renderer's draw pipeline. Pure data
// structures only: no context, no platform types.
export { COLOR_CACHE_LIMIT, LruCache } from "./lru";

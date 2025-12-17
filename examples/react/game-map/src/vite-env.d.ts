/// <reference types="vite/client" />

declare module "*.webp" {
    const src: string;
    export default src;
}

declare module "/villages/*" {
    const src: string;
    export default src;
}

declare module "/terrains/*" {
    const src: string;
    export default src;
}


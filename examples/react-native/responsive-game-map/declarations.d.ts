// Image asset modules resolve to a Metro asset id (number) at runtime.
declare module "*.webp" {
    const value: number;
    export default value;
}

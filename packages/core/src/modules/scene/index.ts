export {
    createSceneDocument,
    parseSceneDocument,
    stringifySceneDocument,
    prepareScene,
    PreparedScene,
    SceneAttachmentError,
    type SceneTarget,
    type SceneAttachment,
    type SceneAttachOptions,
} from "./SceneDocument";
export { SCENE_SCHEMA_VERSION, DEFAULT_SCENE_LIMITS, SceneValidationError, validateSceneDocument } from "./validation";
export type * from "./types";

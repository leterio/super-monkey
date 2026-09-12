import { DEFAULT_IMG_SELECTORS, DEFAULT_IMG_URL_SOURCES } from "../../../utils/links";
import { ResourcesMapping } from "../metadata";

export const BUILTIN_RESOURCES_MAPPINGS: Record<string, ResourcesMapping> = {
    images: {
        type: "leaf",
        selectors: DEFAULT_IMG_SELECTORS,
        urlSources: DEFAULT_IMG_URL_SOURCES,
        decoration: {
            wrapElement: true,
            overridePosition: true,
        },
    },
    videos: {
        type: "leaf",
        selectors: [
            "video > source[src][type='video/mp4']",
            "video > source[src][type='video/mkv']",
            "video > source[src][type='video/webm']",
            "video > source[src]",
        ],
        urlSources: ["src"],
        decoration: {
            overridePosition: true,
            closestSelectors: ["video"]
        },
    },
    audios: {
        type: "leaf",
        selectors: [
            "audio > source[src][type='audio/aac']",
            "audio > source[src][type='audio/ogg']",
            "audio > source[src][type='audio/mp3']",
            "audio > source[src]",
        ],
        urlSources: ["src"],
        decoration: {
            overridePosition: true,
            closestSelectors: ["audio"]
        },
    }
};

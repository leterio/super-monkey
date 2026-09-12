import { ScanMode } from "../../content-manager/metadata";
import { DEFAULT_IMG_URL_SOURCES } from "../../utils/links";
import { Integration } from "../metadata";

export const REDDIT_COM_INTEGRATION: Integration = {
    name: "reddit_com",
    matchedDomains: [
        "www.reddit.com",
        "reddit.com",
    ],
    contentManager: {
        scanIntervalMs: 1000,
        scanMode: ScanMode.INTERVAL,
        groups: {
            posts: {
                views: [
                    {
                        name: "post",
                        selectors: ["main#main-content > shreddit-post[id]"],
                        idSource: { source: "attribute", attributes: ["id"] },
                    }
                ],
                listings: [
                    {
                        name: "feed",
                        containerSelectors: ["shreddit-feed"],
                        entriesSelectors: ["shreddit-post[id]", "shreddit-ad-post[id]"],
                        entryIdSource: [{ source: "attribute", attributes: ["id"] }],
                        entryContainerSelector: ["article"],
                    },
                    {
                        name: "right-rail",
                        containerSelectors: ["pdp-right-rail ul"],
                        entriesSelectors: ["li > reddit-pdp-right-rail-post[right-rail-post-id]"],
                        entryIdSource: [{ source: "attribute", attributes: ["right-rail-post-id"] }],
                        entryContainerSelector: ["li"],
                    },
                ],
            },
        },
    },
    modules: {
        history: {
            module: "History",
            opts: {
                group: "posts",
                recordFilter: ["!!right-rail"],
                listedStyles: `
                    & shreddit-post,
                    & reddit-pdp-right-rail-post > div { border-left: 0.15em solid yellow; }
                `,
                viewedStyles: `
                    & shreddit-post,
                    & reddit-pdp-right-rail-post > div { border-left: 0.15em solid red; }
                `,
            },
        },
        customCss: {
            module: "CustomCss",
            opts: {
                static: `
                        :root { --sm-nb-offset-top: 3.5em; }
                        shreddit-feed > hr, faceplate-batch > hr { display: none !important; }
                        shreddit-feed article { border-top: 0.1em solid var(--color-neutral-border-weak); }
                        shreddit-post[data-sm-rd-decorated-by] > .sm-rd-download-btn { --sm-rd-offset-top: 1.75em; }
                        main > shreddit-post[data-sm-rd-decorated-by] > .sm-rd-download-btn { --sm-rd-offset-top: 4.25em; }
                        shreddit-post[data-sm-rd-decorated-by] > [slot="title"] { width: calc(100% - 2em); }
                        [data-sm-rd-decorated-by="video"] > .sm-rd-download-btn { --sm-rd-offset-top: 3em; }
                        [id="shreddit-media-lightbox"] .sm-rd-download-btn { --sm-rd-offset-top: 5em; --sm-rd-offset-right: 0.5em; --sm-rd-button-size: 4.5em; }
                        .sm-rd-download-btn { opacity: 0.25; }
                    `
            },
        },
        resourcesDownloader: {
            module: "ResourcesDownloader",
            opts: {
                mappings: {
                    postImage: {
                        type: "leaf",
                        urlSources: DEFAULT_IMG_URL_SOURCES,
                        selectors: ["img.preview-img"],
                        decoration: {
                            useImmediateParent: true,
                        },
                    },
                    video: {
                        type: "leaf",
                        selectors: ["shreddit-player[packaged-media-json]"],
                        urlSources: [{
                            source: "attribute",
                            attributes: ["packaged-media-json"],
                            map: [
                                {
                                    type: "json_path",
                                    path: "playbackMp4s.permutations",
                                },
                                {
                                    type: "sort",
                                    by: {
                                        area: {
                                            width: "source.dimensions.width",
                                            height: "source.dimensions.height",
                                        },
                                    },
                                    order: "desc",
                                },
                                {
                                    type: "pick",
                                    at: "first",
                                },
                                {
                                    type: "json_path",
                                    path: "source.url",
                                },
                            ],
                        }],
                        decoration: {
                            closestSelectors: ["[slot='post-media-container']"]
                        },
                    },
                    carouselImage: {
                        type: "leaf",
                        urlSources: DEFAULT_IMG_URL_SOURCES,
                        selectors: ["ul figure > img"],
                        decoration: {
                            closestSelectors: ["figure"]
                        },
                    },
                    carousel: {
                        type: "collection",
                        selectors: ["gallery-carousel"],
                        children: ["carouselImage"],
                        decoration: {
                            closestSelectors: ["shreddit-post"],
                            overridePosition: true,
                        },
                    },
                }
            },
        },
    },
};

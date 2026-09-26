import { ScanMode } from "../../content-manager/metadata";
import { CustomCssOpts } from "../../modules/custom-css/custom-css-opts";
import { HistoryOpts } from "../../modules/history/history-opts";
import { NotificationBarOpts } from "../../modules/notification-bar/notification-bar";
import { ResourcesDownloaderOpts } from "../../modules/resources-downloader/resources-downloader-opts";
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
                        idSource: {
                            source: "attribute",
                            attributes: ["id"],
                            map: [{
                                type: "replace",
                                regexes: ["^t[0-9]_"],
                                replacement: "",
                            }]
                        },
                    },
                    {
                        name: "post-media",
                        selectors: ["shreddit-app[pagetype='cdn_media_page']"],
                        idSource: {
                            source: "attribute",
                            attributes: ["href"],
                            selectors: ["post-bottom-bar a[slot='open-app-button']"],
                            map: [{
                                type: "extract",
                                regexes: ["/comments/([^/]+)/"],
                            }]
                        }
                    }
                ],
                listings: [
                    {
                        name: "feed",
                        containerSelectors: ["shreddit-feed"],
                        entriesSelectors: ["shreddit-post[id]", "shreddit-ad-post[id]"],
                        entryIdSource: [{
                            source: "attribute", attributes: ["id"], map: [{
                                type: "replace",
                                regexes: ["^t[0-9]_"],
                                replacement: "",
                            }]
                        }],
                        entryContainerSelector: ["article"],
                    },
                    {
                        name: "right-rail",
                        containerSelectors: ["pdp-right-rail ul"],
                        entriesSelectors: ["li > reddit-pdp-right-rail-post[right-rail-post-id]"],
                        entryIdSource: [{
                            source: "attribute", attributes: ["right-rail-post-id"], map: [{
                                type: "replace",
                                regexes: ["^t[0-9]_"],
                                replacement: "",
                            }]
                        }],
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
            } as HistoryOpts,
        },
        customCss: {
            module: "CustomCss",
            opts: {
                static: `
                        :root { --sm-nb-offset-top: 3.5em; --sm-nb-offset-bottom: 4em; --sm-nb-z-index: 999; }
                        shreddit-feed > hr, faceplate-batch > hr { display: none !important; }
                        shreddit-feed article { border-top: 0.1em solid var(--color-neutral-border-weak); }
                        shreddit-post[data-sm-rd-decorated-by] > .sm-rd-download-btn { --sm-rd-offset-top: 1.75em; }
                        main > shreddit-post[data-sm-rd-decorated-by] > .sm-rd-download-btn { --sm-rd-offset-top: 4.25em; }
                        shreddit-post[data-sm-rd-decorated-by] > [slot="title"] { width: calc(100% - 2em); }
                        [data-sm-rd-decorated-by="video"] > .sm-rd-download-btn { --sm-rd-offset-top: 3em; }
                        [id="shreddit-media-lightbox"] .sm-rd-download-btn { --sm-rd-offset-top: 5em; --sm-rd-offset-right: 0.5em; --sm-rd-button-size: 4.5em; }
                        .sm-rd-download-btn { opacity: 0.25; }
                    `,
                rules: [
                    {
                        key: "largerPostsLayout",
                        type: "boolean",
                        defaultValue: false,
                        label: "Larger posts layout",
                        description: "If enabled, posts use a larger layout and gallery carousels get a larger height. Recommended for larger screens.",
                        onEventType: "entitiesInjected",
                        shadowRootSelectors: ["gallery-carousel:shadowRoot"],
                        css: `
                            @media (min-width: 1200px) {
                                #subgrid-container { width: max(80%, 1120px); }
                                .main-container { grid-template-columns: minmax(0, 100%) minmax(0, 316px) !important; }
                                [id$='aspect-ratio'] { max-height: 70dvh !important; }
                            }
                            faceplate-carousel {
                                max-height: 70dvh !important;
                            }
                        `,
                    },
                ],
            } as CustomCssOpts,
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
                    mediaImage: {
                        type: "leaf",
                        urlSources: DEFAULT_IMG_URL_SOURCES,
                        selectors: ["zoomable-img>img"],
                        decoration: {
                            wrapElement: true,
                            overridePosition: true
                        },
                    },
                    videoWithPackagedMediaJson: {
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
                    videoShredditPlayer: {
                        type: "leaf",
                        selectors: ["shreddit-player source"],
                        urlSources: ["src"],
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
            } as ResourcesDownloaderOpts,
        },
    },
    defaults: {
        notificationBar: {
            position: "bottom-right"
        } as NotificationBarOpts,
    }
};

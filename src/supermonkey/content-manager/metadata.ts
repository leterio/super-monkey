import { ValueSource } from "../utils/value-resolver";

/**
 * DOM `data-*` attribute names used to mark mapped content.
 * `VIEWED` / `LISTED` values are space-separated Content Manager group keys.
 * `ID` is a template: after substituting `GROUP_KEY`, the attribute value is the resolved entity id.
 */
export const ContentManagerMarkers = {
    VIEWED: "data-sm-cm-viewed",
    LISTED: "data-sm-cm-listed",
    /** Template for the per-group id attribute (`data-sm-cm-<groupKey>-id`). */
    ID: "data-sm-cm-{{GROUP_KEY}}-id",
} as const;

/**
 * How Content Manager rescans listing surfaces on the live document.
 */
export enum ScanMode {
    ONLOAD = "onload",
    INTERVAL = "interval",
}

/**
 * Top-level Content Manager configuration for an integration.
 * Scan options apply to every group; content kinds live under `groups`.
 */
export type ContentManagerOpts = {
    /**
     * How often listing surfaces are rescanned. Defaults to `"onload"`.
     */
    readonly scanMode?: ScanMode;
    /**
     * Rescan interval in milliseconds when `scanMode` is `interval`.
     * Defaults to `1000` when omitted.
     */
    readonly scanIntervalMs?: number;
    /** Map of group key → group options (for example `videos`, `posts`). */
    readonly groups: Record<string, ContentManagerGroup>;
};

/**
 * One content kind. At least one of `views` or `listings` must be present.
 */
export type ContentManagerGroup = {
    readonly views?: readonly ContentManagerView[];
    readonly listings?: readonly ContentManagerListing[];
};

/**
 * Detects open content items and resolves each id.
 * Every view config that resolves publishes `entity-viewed` (one event per resolution).
 * When `selectors` is omitted, URL-based `idSource` entries use the tab location.
 */
export type ContentManagerView = {
    /**
     * Stable name for this view config.
     * Used by History `recordFilter` / `decorateFilter` and similar consumers.
     */
    readonly name: string;
    /**
     * Selectors matched inside the container; each match is removed unless it is
     * exactly a listed entity element. Matches that wrap or nest inside entities
     * are still removed.
     */
    readonly selectors?: string[];
    /**
     * Source for the id of the matched element.
     */
    readonly idSource: ValueSource;
    /**
     * Optional page filter for this view config.
     * Allowlist, denylist (`!!`), or hybrid names from `mappedPages`; empty/omitted runs on every page.
     */
    readonly pageFilter?: readonly string[];
};

/**
 * How a listing removes non-entry DOM from each matched container after discover.
 * Modes are mutually exclusive.
 */
export type ContentManagerListingCleanup =
    | {
        /**
         * When `true`, removes each direct child of the container that is not a listed
         * entity and does not contain one.
         */
        readonly removeNonEntities: true;
    }
    | {
        /**
         * Selectors matched inside the container; each match is removed unless it is
         * exactly a listed entity element. Matches that wrap or nest inside entities
         * are still removed.
         */
        readonly removeSelectors: string[];
    };

/**
 * Finds many listable items under listing containers and resolves each item id.
 */
export type ContentManagerListing = {
    /**
     * Stable name for this listing config.
     * Used by History `recordFilter` / `decorateFilter` and similar consumers.
     */
    readonly name: string;
    /** Listing containers to search (all matching containers). */
    readonly containerSelectors: string[];
    /** Nodes matched inside each container (all matches). */
    readonly entriesSelectors: string[];
    /** Id sources tried in order on the matched entry node (first success wins). */
    readonly entryIdSource: ValueSource[];
    /**
     * Closest selectors for the managed entry element, scoped under the listing container.
     * Use when `entriesSelectors` match a deep child but the entry root is an ancestor.
     *
     * @example
     * // Match the anchor for the id; manage `.entry` as the listed element
     * {
     *   containerSelectors: [".container"],
     *   entriesSelectors: [".entry a"],
     *   entryIdSource: [{ source: "attribute", attributes: ["href"] }],
     *   entryContainerSelector: [".entry"],
     * }
     */
    readonly entryContainerSelector?: string[];
    /**
     * Optional cleanup of non-entry nodes in each listing container after discover.
     */
    readonly cleanup?: ContentManagerListingCleanup;
    /**
     * Optional page filter for this listing config.
     * Allowlist, denylist (`!!`), or hybrid names from `mappedPages`; empty/omitted runs on every page.
     */
    readonly pageFilter?: readonly string[];
};

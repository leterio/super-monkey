import { ValueSource } from "../../utils/value-resolver";
import { ItemState } from "../../utils/item-state";
import { ProgressItemHandle } from "../notification-bar/entries/progress-menu/progress-item";

//#region Resources

type BaseResource = {
    state: ItemState;
    parent?: ResourceCollection;
    downloadButton?: HTMLButtonElement;
    readonly element: HTMLElement;
    /** Mapping key that produced this resource. */
    readonly mappedBy: string;
};

/** Single downloadable resource matched from a leaf mapping. */
export type ResourceLeaf = BaseResource & {
    readonly type: "leaf";
    progress?: ProgressItemHandle;
    /** Progress rows for ancestor collections that include this leaf. */
    branchProgress?: ProgressItemHandle[];
};

/** Container resource whose children come from nested mapping keys. */
export type ResourceCollection = BaseResource & {
    readonly type: "collection";
    readonly children: Resource[];
};

/** Mapped resource node: a leaf or a collection. */
export type Resource = ResourceLeaf | ResourceCollection;

/** Click handler for a decorated resource download control. */
export type ResourceDownloadClickHandler = (resource: Resource) => void;

/** Mapping target marker; value is the mapping key (`mappedBy`). */
export const MAPPED_BY_ATTR = "data-sm-rd-mapped-by";

/** Decoration-container gate; value is the mapping key that decorated the container. */
export const DECORATED_BY_ATTR = "data-sm-rd-decorated-by";

/** Resource element state marker; value is the {@link ItemState}. */
export const RESOURCE_STATE_ATTR = "data-sm-rd-state";
//#endregion

//#region Mappings

/** How the download control is attached relative to a matched element. */
export type ResourcesDecoration = {
    /** Wrap the target in a container before attaching the button. */
    readonly wrapElement?: boolean;
    /** Extra wrap classes; applied before copied or built-in wrap classes. */
    readonly wrapClasses?: string[];
    /** Copy the target’s classes onto the wrap. */
    readonly wrapCopyElementClasses?: boolean;
    /**
     * Use the target’s immediate parent as the decoration container.
     * Takes precedence over `closestSelectors`.
     */
    readonly useImmediateParent?: boolean;
    /** `element.closest` candidates; first matching selector wins. */
    readonly closestSelectors?: string[];
    /** Set `position: relative` on the decoration container. */
    readonly overridePosition?: boolean;
};

type BaseResourcesMapping = {
    readonly selectors: string[];
    /** Skip attaching a download control for this mapping. */
    readonly ignoreDecoration?: boolean;
    readonly decoration?: ResourcesDecoration;
};

/** Mapping that matches a single downloadable element and resolves its URL. */
export type ResourcesMappingLeaf = BaseResourcesMapping & {
    readonly type: "leaf";
    /**
     * Ordered attribute names and/or value sources.
     * At download time, the first non-empty value on the live element wins.
     */
    readonly urlSources: (string | ValueSource)[];
    /** Download mode name. Defaults to `"download"`. */
    readonly downloadMode?: string;
};

/** Mapping that matches a container and scans nested mapping keys inside it. */
export type ResourcesMappingCollection = BaseResourcesMapping & {
    readonly type: "collection";
    /** Mapping keys to scan inside each matched container. */
    readonly children: string[];
};

/** Leaf or collection mapping entry under ResourcesDownloader `mappings`. */
export type ResourcesMapping = ResourcesMappingLeaf | ResourcesMappingCollection;

//#endregion

//#region Download modes

/** Built-in mode names always available alongside custom `downloadModes`. */
export const BUILTIN_DOWNLOAD_MODES = ["download"] as const;

/** Built-in download mode name. */
export type BuiltinDownloadModeName = (typeof BUILTIN_DOWNLOAD_MODES)[number];

/** Request body for a document download step: raw string or field map. */
export type DownloadRequestData = string | Record<string, string | ValueSource>;

/** One fetch against a document URL before the final download step. */
export type DocumentDownloadStep = {
    readonly mode: "document";
    /**
     * Resolves the URL (or related values) for this step.
     * Element sources need at least one `selectors` entry so values resolve inside the fetched document.
     */
    readonly valueSource: ValueSource;
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly data?: DownloadRequestData;
    readonly timeout?: number;
};

/** Final transfer step that saves the current branch URL via `GM_download`. */
export type FinalDownloadStep = {
    readonly mode: "download";
    readonly headers?: Record<string, string>;
    readonly timeout?: number;
};

/** One step in a custom download pipeline. The last step must be `download`. */
export type DownloadStep = DocumentDownloadStep | FinalDownloadStep;

/** Named multi-step download pipeline referenced by a leaf mapping’s `downloadMode`. */
export type DownloadMode = {
    readonly name: string;
    readonly steps: DownloadStep[];
};

//#endregion

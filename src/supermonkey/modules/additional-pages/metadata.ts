import { ItemState } from "../../utils/item-state";
import { ProgressItemHandle } from "../notification-bar/entries/progress-menu/progress-item";
import type { ResolvedUrlTemplate } from "./url-template";

/** Placeholder token substituted when building numbered page URLs. */
export const NUMBERS_PLACEHOLDER = "{{NUMBER}}";

/** Attribute set on paginator page-index elements to mirror additional-page load state. */
export const META_AP_STATUS_ATTRIBUTE = "data-sm-ap-status";

/** One listing page in an Additional Pages run (root or additional). */
export type Page = {
    url: string;
    readonly number: number;
    state: ItemState;
    label?: string;
    /** Content Manager group binder key for this page in a multi-group run. */
    groupKey?: string;
    progress?: ProgressItemHandle;
};

/**
 * Where status attributes and loaded classes attach relative to each `pageIndexes` match.
 * Page number and URL still resolve on the matched node.
 */
export type PageIndexDecoration = {
    readonly closestSelectors?: string[];
    readonly useImmediateParent?: boolean;
    readonly loadedPageClassNames?: string[];
};

/** Selector set used by {@link DomContextManager} to bind paginator controls. */
export type PaginatorSelectors = {
    readonly rootContainers: string[];
    readonly previousSelectors?: string[];
    readonly nextSelectors?: string[];
    readonly currentSelectors?: string[];
    readonly pageIndexes?: string[];
    /** Extra attributes tried before `href` when reading or writing page URLs. */
    readonly urlAttributes?: string[];
    readonly pageIndexDecoration?: PageIndexDecoration;
};

/** Bound paginator controls for one root container. */
export type PaginatorRefs = {
    readonly rootContainer: HTMLElement;
    readonly previous: HTMLElement | null;
    readonly next: HTMLElement | null;
    readonly current: HTMLElement | null;
    readonly pageIndexes: Map<number, Set<HTMLElement>>;
};

/**
 * Runtime pagination state produced by a context manager and consumed by a paging strategy.
 */
export type PaginationContext = {
    /** Snapshot from `resolveUrlTemplate`; required by numbered strategies. */
    readonly resolvedUrlTemplate?: ResolvedUrlTemplate;
    readonly totalPages?: number;
    readonly rootPage: Page;
    cursor: Page;
    readonly paginators: PaginatorRefs[];
    readonly selectors?: PaginatorSelectors;
};

/** Result of fetching one additional page document. */
export type LoadedPageResult = {
    readonly content: Document;
    readonly paginators?: PaginatorRefs[];
};

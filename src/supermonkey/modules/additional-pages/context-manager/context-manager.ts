import { Logger } from "../../../utils/logger";
import type { ContextManagerConfig } from "../additional-pages-opts";
import {
    Page,
    PaginationContext,
    PaginatorRefs
} from "../metadata";
import type { ResolvedNumberedPagingOpts } from "../paging-strategy/numbered-paging-strategy";
import { DomContextManager } from "./dom-context-manager";
import { UrlContextManager } from "./url-context-manager";

/**
 * Resolves pagination context from the live tab and updates paginator DOM when applicable.
 * Built by {@link ContextManagerLoader} from integration opts.
 */
export interface ContextManager {
    /**
     * Builds the initial {@link PaginationContext} for the live tab.
     * @param fallbackPageNumber - Used when the page number cannot be parsed (default `1`)
     */
    resolveContext(fallbackPageNumber?: number): PaginationContext;

    /**
     * Binds paginator roots and controls under `document`.
     * Present on DOM-backed managers; omitted for URL-only managers.
     */
    bindPaginators?(document: Document): PaginatorRefs[];

    /**
     * Marks paginator page-index elements for `page` (status attribute and loaded classes).
     */
    updatePaginators?(context: PaginationContext, page: Page): void;

    /**
     * Writes previous/next pointer URLs onto paginator controls after a successful load run.
     */
    applyPaginatorPointers?(
        context: PaginationContext,
        previousPage: Page | null,
        nextPage: Page | null,
    ): void;
}

/**
 * Constructs a {@link ContextManager} from normalized `contextManager` opts (`type` `"dom"` | `"url"`).
 */
export class ContextManagerLoader {
    private static readonly log: Logger = new Logger("ContextManagerLoader");

    /**
     * @param pageNumbering - Resolved numbered-strategy flags used when DOM text labels differ from URL numbering
     * @throws When `config.type` is not a known context manager kind
     */
    static load(
        config: ContextManagerConfig,
        pageNumbering?: ResolvedNumberedPagingOpts,
    ): ContextManager {
        this.log.debug("Loading context manager", config.type, config);

        switch (config.type) {
            case "dom":
                return new DomContextManager(config, pageNumbering);
            case "url":
                return new UrlContextManager(config);
            default: {
                const _exhaustive: never = config;
                throw new Error(
                    `Unknown context manager type: ${(_exhaustive as ContextManagerConfig).type}`,
                );
            }
        }
    }
}

import { Logger } from "../../../utils/logger";
import type { PagingStrategyConfig } from "../additional-pages-opts";
import { Page, PaginationContext, PaginatorRefs } from "../metadata";
import { NextLinkPagingStrategy } from "./next-link-paging-strategy";
import {
    DecrementalNumberedPagingStrategy,
    IncrementalNumberedPagingStrategy,
} from "./numbered-paging-strategy";

/**
 * Decides which additional page URLs to fetch and how to update paginator pointers.
 * Built by {@link PagingStrategyLoader} from integration opts.
 */
export interface PagingStrategy {
    /**
     * Returns pending pages to load after `cursor`, up to `requestedAdditionalPages`.
     * @param navigationPaginators - Optional paginators from a fetched document (next-link); defaults to `context.paginators`
     */
    resolveNextPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
        navigationPaginators?: PaginatorRefs[],
    ): Page[];

    /**
     * Returns pages before `cursor` for pointer calculation (numbered strategies).
     */
    resolvePreviousPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
    ): Page[];

    /**
     * Computes previous/next pointer pages after a load run.
     * @param additionalPagesLoaded - How many additional pages were successfully loaded in this run
     */
    resolvePaginatorPointers(
        context: PaginationContext,
        additionalPagesLoaded: number,
        navigationPaginators?: PaginatorRefs[],
    ): { previousPage: Page | null; nextPage: Page | null };

    /**
     * Ensures `context` satisfies this strategy before loading begins.
     * @throws When required template, selectors, or other context fields are missing
     */
    validateContext(context: PaginationContext): void;

    /** First page number for numbered strategies (respects zero-based opts). */
    getDefaultPageNumber?(): number;
}

/**
 * Constructs a {@link PagingStrategy} from normalized `pagingStrategy` opts
 * (`type` `"next-link"` | `"incremental"` | `"decremental"`).
 */
export class PagingStrategyLoader {
    private static readonly log: Logger = new Logger("PagingStrategyLoader");

    /**
     * @throws When `config.type` is not a known paging strategy kind
     */
    static load(config: PagingStrategyConfig): PagingStrategy {
        this.log.debug("Loading paging strategy", config.type, config);

        switch (config.type) {
            case "next-link":
                return new NextLinkPagingStrategy();
            case "incremental":
                return new IncrementalNumberedPagingStrategy(config);
            case "decremental":
                return new DecrementalNumberedPagingStrategy(config);
            default: {
                const _exhaustive: never = config;
                throw new Error(
                    `Unknown paging strategy type: ${(_exhaustive as PagingStrategyConfig).type}`,
                );
            }
        }
    }
}

import { getFirstElementAttributeValue } from "../../../utils/dom/elements";
import { resolveUrlAttributes } from "../../../utils/links";
import { ItemState } from "../../../utils/item-state";
import { Page, PaginationContext, PaginatorRefs } from "../metadata";
import { PagingStrategy } from "./paging-strategy";

/**
 * Follows the live paginator “next” control `href` (or configured URL attributes).
 * Requires DOM context with non-empty `nextSelectors`. Resolves at most one next page per call.
 */
export class NextLinkPagingStrategy implements PagingStrategy {
    private resolveNextPageUrl(
        refs: PaginatorRefs[],
        urlAttributes?: readonly string[],
    ): string | null {
        const attributes = resolveUrlAttributes(urlAttributes);

        return refs
            .map((ref) => ref.next)
            .filter((element): element is HTMLElement => element != null)
            .flatMap((element) => getFirstElementAttributeValue(element, attributes))
            .filter((url): url is string => url != null)
            .at(0) ?? null;
    }

    resolveNextPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
        navigationPaginators?: PaginatorRefs[],
    ): Page[] {
        const paginators = navigationPaginators ?? context.paginators;

        if (
            requestedAdditionalPages <= 0
            || cursor.state !== ItemState.DONE
            || paginators.length === 0
        ) {
            return [];
        }

        const nextPageUrl = this.resolveNextPageUrl(
            paginators,
            context.selectors?.urlAttributes,
        );

        if (nextPageUrl == null) {
            return [];
        }

        return [{
            url: nextPageUrl,
            number: cursor.number + 1,
            label: String(cursor.number + 1),
            state: ItemState.PENDING,
        }];
    }

    resolvePreviousPages(
        _context: PaginationContext,
        _totalAdditionalPages: number,
        _cursor: Page,
    ): Page[] {
        return [];
    }

    resolvePaginatorPointers(
        context: PaginationContext,
        _additionalPagesLoaded: number,
        navigationPaginators?: PaginatorRefs[],
    ): { previousPage: Page | null; nextPage: Page | null } {
        return {
            previousPage: null,
            nextPage: this.resolveNextPages(
                context,
                1,
                context.cursor,
                navigationPaginators,
            ).at(0) ?? null,
        };
    }

    /**
     * @throws When `context.selectors.nextSelectors` is missing or empty
     */
    validateContext(context: PaginationContext): void {
        if (context.selectors?.nextSelectors == null || context.selectors.nextSelectors.length === 0) {
            throw new Error("NextLinkPagingStrategy: context.selectors.nextSelectors is required");
        }
    }
}

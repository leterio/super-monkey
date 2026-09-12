import { ItemState } from "../../../utils/item-state";
import { NUMBERS_PLACEHOLDER, Page, PaginationContext, PaginatorRefs } from "../metadata";
import {
    buildPagedUrl,
    hasPageNumberPlaceholder,
    isValidUrlTemplatePath,
} from "../url-template";
import { PagingStrategy } from "./paging-strategy";

/** Shared opts for incremental and decremental numbered strategies. */
export type NumberedPagingStrategyOpts = {
    /** When `true`, page numbers in built URLs start at `0` (default `false` → start at `1`). */
    readonly numberingStartsFromZero?: boolean;
    /**
     * When `true`, progress UI labels use zero-based numbers.
     * Defaults to the same value as `numberingStartsFromZero`.
     */
    readonly numberingLabelStartsFromZero?: boolean;
};

/** Resolved numbering flags used by numbered strategies and DOM label parsing. */
export type ResolvedNumberedPagingOpts = {
    readonly numberingStartsFromZero: boolean;
    readonly numberingLabelStartsFromZero: boolean;
};

/** Resolves optional numbered-strategy opts to concrete boolean flags. */
export function resolveNumberedPagingOpts(
    opts?: NumberedPagingStrategyOpts,
): ResolvedNumberedPagingOpts {
    const numberingStartsFromZero = opts?.numberingStartsFromZero ?? false;
    return {
        numberingStartsFromZero,
        numberingLabelStartsFromZero:
            opts?.numberingLabelStartsFromZero ?? numberingStartsFromZero,
    };
}

/**
 * Converts a paginator display label to the internal page number used in URLs.
 * No-op when URL numbering and labels share the same base.
 */
export function pageNumberFromDisplayLabel(
    label: number,
    opts: ResolvedNumberedPagingOpts,
): number {
    if (opts.numberingStartsFromZero === opts.numberingLabelStartsFromZero) {
        return label;
    }

    return opts.numberingStartsFromZero ? label - 1 : label + 1;
}

/** Builds the progress/UI label for an internal page number. */
export function displayLabelFromPageNumber(
    pageNumber: number,
    opts: ResolvedNumberedPagingOpts,
): string {
    if (opts.numberingStartsFromZero) {
        return opts.numberingLabelStartsFromZero
            ? pageNumber.toString()
            : (pageNumber + 1).toString();
    }

    return opts.numberingLabelStartsFromZero
        ? (pageNumber - 1).toString()
        : pageNumber.toString();
}

/**
 * Builds additional page URLs from `context.resolvedUrlTemplate` by substituting `{{NUMBER}}`.
 * Subclasses define ascending vs descending numbering.
 */
export abstract class NumberedPagingStrategy implements PagingStrategy {
    protected readonly numberingStartsFromZero: boolean;
    protected readonly numberingLabelStartsFromZero: boolean;

    constructor(opts?: NumberedPagingStrategyOpts) {
        const resolved = resolveNumberedPagingOpts(opts);
        this.numberingStartsFromZero = resolved.numberingStartsFromZero;
        this.numberingLabelStartsFromZero = resolved.numberingLabelStartsFromZero;
    }

    abstract resolveNextPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
        navigationPaginators?: PaginatorRefs[],
    ): Page[];

    abstract resolvePreviousPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
    ): Page[];

    resolvePaginatorPointers(
        context: PaginationContext,
        additionalPagesLoaded: number,
        navigationPaginators?: PaginatorRefs[],
    ): { previousPage: Page | null; nextPage: Page | null } {
        let previousPage = this.resolvePreviousPages(context, 1, context.rootPage).at(0) ?? null;
        if (previousPage != null && additionalPagesLoaded > 0) {
            previousPage = this.resolvePreviousPages(
                context,
                additionalPagesLoaded,
                previousPage,
            ).at(-1) ?? null;
        }

        const nextPage = this.resolveNextPages(
            context,
            1,
            context.cursor,
            navigationPaginators,
        ).at(0) ?? null;

        return { previousPage, nextPage };
    }

    /**
     * @throws When `resolvedUrlTemplate` is missing, lacks `{{NUMBER}}`, or is not a path/absolute http(s) URL
     */
    validateContext(context: PaginationContext): void {
        const resolved = context.resolvedUrlTemplate;

        if (resolved == null || !hasPageNumberPlaceholder(resolved.template)) {
            throw new Error(
                `NumberedPagingStrategy: urlTemplate is required and must include ${NUMBERS_PLACEHOLDER}`,
            );
        }

        if (!isValidUrlTemplatePath(resolved.template)) {
            throw new Error(
                "NumberedPagingStrategy: urlTemplate must be a relative path starting with '/' " +
                "or an absolute URL starting with 'http://' or 'https://'.",
            );
        }
    }

    getDefaultPageNumber(): number {
        return this.resolveFirstPageNumber();
    }

    protected resolveFirstPageNumber(): number {
        return this.numberingStartsFromZero ? 0 : 1;
    }

    protected createPage(context: PaginationContext, pageNumber: number): Page {
        return {
            url: buildPagedUrl(context.resolvedUrlTemplate!, pageNumber),
            number: pageNumber,
            label: displayLabelFromPageNumber(pageNumber, {
                numberingStartsFromZero: this.numberingStartsFromZero,
                numberingLabelStartsFromZero: this.numberingLabelStartsFromZero,
            }),
            state: ItemState.PENDING,
        };
    }
}

/** Next pages use higher numbers from the resolved URL template. */
export class IncrementalNumberedPagingStrategy extends NumberedPagingStrategy {
    resolveNextPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
        _navigationPaginators?: PaginatorRefs[],
    ): Page[] {
        if (context.resolvedUrlTemplate == null || requestedAdditionalPages <= 0) {
            return [];
        }

        const start =
            typeof cursor?.number === "number"
                ? cursor.number
                : this.resolveFirstPageNumber();

        return [...Array(requestedAdditionalPages).keys()]
            .map(offset => start + offset + 1)
            .map(pageNumber => {
                if (
                    typeof context.totalPages === "number" &&
                    pageNumber > context.totalPages
                ) {
                    return null;
                }

                return this.createPage(context, pageNumber);
            })
            .filter((page): page is Page => page != null);
    }

    resolvePreviousPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
    ): Page[] {
        if (
            context.resolvedUrlTemplate == null ||
            requestedAdditionalPages <= 0 ||
            typeof cursor?.number !== "number"
        ) {
            return [];
        }

        const first = this.resolveFirstPageNumber();

        return [...Array(requestedAdditionalPages).keys()]
            .map(offset => cursor.number - offset - 1)
            .filter(pageNumber => pageNumber >= first)
            .map(pageNumber => this.createPage(context, pageNumber));
    }
}

/**
 * Same as {@link IncrementalNumberedPagingStrategy}, with next/previous directions swapped
 * (sites where lower numbers are “later” pages).
 */
export class DecrementalNumberedPagingStrategy extends IncrementalNumberedPagingStrategy {
    override resolveNextPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
        _navigationPaginators?: PaginatorRefs[],
    ): Page[] {
        return super.resolvePreviousPages(context, requestedAdditionalPages, cursor);
    }

    override resolvePreviousPages(
        context: PaginationContext,
        requestedAdditionalPages: number,
        cursor: Page,
    ): Page[] {
        return super.resolveNextPages(context, requestedAdditionalPages, cursor);
    }
}

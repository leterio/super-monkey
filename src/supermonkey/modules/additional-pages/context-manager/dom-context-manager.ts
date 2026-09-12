import { closestMatching, findElementAttributeValueInAncestors, findElementAttributeValueInDescendants, getFirstElementAttributeValue } from "../../../utils/dom/elements";
import { query, queryAll } from "../../../utils/dom/query";
import { resolveUrlAttributes } from "../../../utils/links";
import { Logger } from "../../../utils/logger";
import { parseInteger } from "../../../utils/number";
import { ItemState } from "../../../utils/item-state";
import { META_AP_STATUS_ATTRIBUTE, Page, PageIndexDecoration, PaginationContext, PaginatorRefs, PaginatorSelectors } from "../metadata";
import {
    displayLabelFromPageNumber,
    pageNumberFromDisplayLabel,
    type ResolvedNumberedPagingOpts,
} from "../paging-strategy/numbered-paging-strategy";
import {
    extractPageNumberFromUrl,
    resolveUrlTemplate,
    type ResolvedUrlTemplate,
    type UrlTemplate,
} from "../url-template";
import { ContextManager } from "./context-manager";

/** Options for {@link DomContextManager} (`contextManager.type: "dom"`). */
export type DomContextManagerOpts = {
    readonly paginatorSelectors: PaginatorSelectors;
    /** Optional URL template for numbered strategies and page-number detection. */
    readonly urlTemplate?: UrlTemplate;
    /** When `true`, leaves `totalPages` unset even if page indexes are visible. */
    readonly ignoreLastPage?: boolean;
};

/**
 * Context manager backed by DOM paginator roots and controls.
 * Resolves the current page from paginator text/href or the live URL template, and updates pointer attributes after loads.
 */
export class DomContextManager implements ContextManager {
    private readonly log: Logger = new Logger("DomContextManager");
    private resolvedUrlTemplate: ResolvedUrlTemplate | null = null;

    constructor(
        private readonly opts: DomContextManagerOpts,
        private readonly pageNumbering?: ResolvedNumberedPagingOpts,
    ) { }

    /**
     * Resolves `urlTemplate` against the live document, binds paginators, and returns the pagination context.
     * @param fallbackPageNumber - Used when the current page cannot be parsed (default `1`)
     */
    resolveContext(fallbackPageNumber: number = 1): PaginationContext {
        this.log.debug("Resolving pagination context with fallback page number:", fallbackPageNumber);

        this.resolvedUrlTemplate = resolveUrlTemplate(this.opts.urlTemplate, document);
        const templatePath = this.resolvedUrlTemplate?.template;

        const paginators = this.bindPaginators(document);
        if (paginators.length === 0) {
            this.log.warn("No paginators found for selector; continuing with empty paginators.");
        } else {
            this.log.debug("Found", paginators.length, "paginators on the current page.");
        }

        const pageNumber = this.resolveCurrentPageNumber(paginators, fallbackPageNumber, templatePath);
        this.log.debug("Resolved current page number:", pageNumber);

        const rootPage: Page = {
            url: window.location.href.toString(),
            number: pageNumber,
            state: ItemState.DONE,
            ...(this.pageNumbering != null
                ? { label: displayLabelFromPageNumber(pageNumber, this.pageNumbering) }
                : {}),
        };
        if (Logger.isTraceEnabled()) {
            this.log.trace("Created root page:", rootPage);
        } else {
            this.log.debug("Created root page: number:", rootPage.number, "url:", rootPage.url);
        }

        const context: PaginationContext = {
            rootPage,
            cursor: rootPage,
            totalPages: this.opts.ignoreLastPage === true
                ? undefined
                : this.resolveTotalPages(paginators),
            paginators,
            selectors: this.opts.paginatorSelectors,
            ...(this.resolvedUrlTemplate != null
                ? { resolvedUrlTemplate: this.resolvedUrlTemplate }
                : {}),
        };

        this.updatePaginators(context, rootPage);

        return context;
    }

    /** Binds every matching paginator root under `document` into {@link PaginatorRefs}. */
    bindPaginators(document: Document): PaginatorRefs[] {
        const templatePath = this.ensureResolvedTemplate(document)?.template;

        const roots = queryAll<HTMLElement>(this.opts.paginatorSelectors.rootContainers, document);

        this.log.trace(
            "Paginator root containers:",
            roots.length,
            this.opts.paginatorSelectors.rootContainers,
        );

        return roots.map((root) => {
            const previous = this.opts.paginatorSelectors.previousSelectors != null
                ? query<HTMLElement>(this.opts.paginatorSelectors.previousSelectors, root)
                : null;
            const next = this.opts.paginatorSelectors.nextSelectors != null
                ? query<HTMLElement>(this.opts.paginatorSelectors.nextSelectors, root)
                : null;
            const current = this.opts.paginatorSelectors.currentSelectors != null
                ? query<HTMLElement>(this.opts.paginatorSelectors.currentSelectors, root)
                : null;

            this.log.trace("Bound paginator refs under root:", {
                root,
                previous,
                next,
                current,
            });

            return {
                rootContainer: root,
                previous,
                next,
                current,
                pageIndexes: this.resolvePageIndexes(
                    root,
                    this.opts.paginatorSelectors,
                    templatePath,
                    { previous, next, current },
                ),
            };
        });
    }

    private ensureResolvedTemplate(base: Document): ResolvedUrlTemplate | null {
        if (this.resolvedUrlTemplate != null) {
            return this.resolvedUrlTemplate;
        }

        this.resolvedUrlTemplate = resolveUrlTemplate(this.opts.urlTemplate, base);
        return this.resolvedUrlTemplate;
    }

    private resolvePageIndexNumber(
        element: HTMLElement,
        container: HTMLElement,
        urlTemplate: string | undefined,
        urlAttributes?: readonly string[],
    ): number | null {
        if (urlTemplate != null) {
            const fromUrl = this.resolvePageNumberFromUrlTemplate(
                element,
                container,
                urlTemplate,
                urlAttributes,
            );
            if (fromUrl != null) {
                return fromUrl;
            }
        }

        const fromText = parseInteger(element.textContent ?? "");
        if (fromText == null) {
            return null;
        }

        return this.pageNumbering != null
            ? pageNumberFromDisplayLabel(fromText, this.pageNumbering)
            : fromText;
    }

    private resolvePageNumberFromUrlTemplate(
        element: HTMLElement,
        container: HTMLElement,
        urlTemplate: string,
        urlAttributes?: readonly string[],
    ): number | null {
        if (element == null || container == null) {
            return null;
        }

        const attributes = resolveUrlAttributes(urlAttributes);
        const url =
            getFirstElementAttributeValue(element, attributes)
            ?? findElementAttributeValueInDescendants(element, attributes)
            ?? findElementAttributeValueInAncestors(element, container, attributes);

        if (url == null) {
            return null;
        }

        return extractPageNumberFromUrl(url, urlTemplate);
    }

    private isPaginatorControlElement(
        element: HTMLElement,
        controls: Pick<PaginatorRefs, "previous" | "next" | "current">,
    ): boolean {
        for (const control of [controls.previous, controls.next, controls.current]) {
            if (control == null) {
                continue;
            }

            if (element === control || element.contains(control) || control.contains(element)) {
                return true;
            }
        }

        return false;
    }

    private resolvePageIndexes(
        root: HTMLElement,
        selectors: PaginatorSelectors,
        urlTemplate: string | undefined,
        controls: Pick<PaginatorRefs, "previous" | "next" | "current">,
    ): Map<number, Set<HTMLElement>> {
        const pageIndexes = new Map<number, Set<HTMLElement>>();

        if (selectors.pageIndexes == null) {
            return pageIndexes;
        }

        for (const element of queryAll<HTMLElement>(selectors.pageIndexes, root)) {
            if (this.isPaginatorControlElement(element, controls)) {
                continue;
            }

            const pageNumber = this.resolvePageIndexNumber(
                element,
                root,
                urlTemplate,
                selectors.urlAttributes,
            );
            if (pageNumber == null) {
                continue;
            }

            const decorateTarget = DomContextManager.resolvePageIndexDecorationTarget(
                element,
                root,
                selectors.pageIndexDecoration,
            );

            let elements = pageIndexes.get(pageNumber);
            if (elements == null) {
                elements = new Set();
                pageIndexes.set(pageNumber, elements);
            }

            elements.add(decorateTarget);
        }

        return pageIndexes;
    }

    private static resolvePageIndexDecorationTarget(
        match: HTMLElement,
        root: HTMLElement,
        decoration: PageIndexDecoration | undefined,
    ): HTMLElement {
        if (decoration?.useImmediateParent === true) {
            return match.parentElement ?? match;
        }

        if (decoration?.closestSelectors != null && decoration.closestSelectors.length > 0) {
            const closest = closestMatching(match, decoration.closestSelectors);
            if (closest != null && root.contains(closest)) {
                return closest;
            }
        }

        return match;
    }

    /**
     * Sets `data-sm-ap-status` on page-index decoration targets for `page`.
     * When `page` is done, also applies `pageIndexDecoration.loadedPageClassNames` when configured.
     */
    updatePaginators(context: PaginationContext, page: Page): void {
        const paginators = context.paginators;
        if (paginators == null || paginators.length === 0) {
            return;
        }

        for (const paginator of paginators) {
            const elements = paginator.pageIndexes.get(page.number);
            if (elements == null) {
                continue;
            }

            for (const element of elements) {
                element.setAttribute(META_AP_STATUS_ATTRIBUTE, page.state.toString());
                const loadedPageClassNames =
                    this.opts.paginatorSelectors.pageIndexDecoration?.loadedPageClassNames;
                if (page.state === ItemState.DONE && loadedPageClassNames != null && loadedPageClassNames.length > 0) {
                    element.classList.add(...loadedPageClassNames);
                }
            }
        }
    }

    /** Writes previous/next URLs onto paginator controls using configured URL attributes (default includes `href`). */
    applyPaginatorPointers(
        context: PaginationContext,
        previousPage: Page | null,
        nextPage: Page | null,
    ): void {
        if (Logger.isTraceEnabled()) {
            this.log.trace("Applying paginator pointers:", { previousPage, nextPage });
        } else {
            this.log.debug("Applying paginator pointers: previousPage:", previousPage?.number, "nextPage:", nextPage?.number);
        }

        const paginators = context.paginators;
        if (paginators == null || paginators.length === 0) {
            return;
        }

        for (const paginator of paginators) {
            this.applyPointerAttributes(paginator.previous, previousPage, this.opts.paginatorSelectors.urlAttributes);
            this.applyPointerAttributes(paginator.next, nextPage, this.opts.paginatorSelectors.urlAttributes);
        }
    }

    private applyPointerAttributes(
        element: HTMLElement | null,
        page: Page | null,
        urlAttributes?: readonly string[],
    ): void {
        if (element == null) {
            return;
        }

        const attributes = resolveUrlAttributes(urlAttributes);

        if (page == null) {
            for (const attribute of attributes) {
                element.removeAttribute(attribute);
            }
            return;
        }

        for (const attribute of attributes) {
            element.setAttribute(attribute, page.url);
        }
    }

    private resolveTotalPages(paginators: PaginatorRefs[]): number | undefined {
        const numbers = paginators.flatMap((paginator) => [...paginator.pageIndexes.keys()]);

        if (numbers.length === 0) {
            return undefined;
        }

        return Math.max(...numbers);
    }

    private resolveCurrentPageNumber(
        paginators: PaginatorRefs[],
        fallbackPageNumber: number,
        urlTemplate?: string,
    ): number {
        if (urlTemplate != null) {
            for (const paginator of paginators) {
                if (paginator.current == null) {
                    continue;
                }

                const fromCurrentHref = this.resolvePageNumberFromUrlTemplate(
                    paginator.current,
                    paginator.rootContainer,
                    urlTemplate,
                    this.opts.paginatorSelectors.urlAttributes,
                );
                if (fromCurrentHref != null) {
                    return fromCurrentHref;
                }
            }

            const fromLocation = extractPageNumberFromUrl(window.location.href, urlTemplate);
            if (fromLocation != null) {
                return fromLocation;
            }
        }

        for (const paginator of paginators) {
            if (paginator.current == null) {
                continue;
            }

            const fromText = parseInteger(paginator.current.textContent ?? "");
            if (fromText != null) {
                return this.pageNumbering != null
                    ? pageNumberFromDisplayLabel(fromText, this.pageNumbering)
                    : fromText;
            }
        }

        this.log.warn(
            "Current page number could not be parsed from paginator or URL, using fallback:",
            fallbackPageNumber,
        );

        return fallbackPageNumber;
    }
}

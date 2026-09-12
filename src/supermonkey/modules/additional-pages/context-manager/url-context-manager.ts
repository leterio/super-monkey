import { Logger } from "../../../utils/logger";
import { ItemState } from "../../../utils/item-state";
import { Page, PaginationContext } from "../metadata";
import {
    extractPageNumberFromUrl,
    resolveUrlTemplate,
    type UrlTemplate,
} from "../url-template";
import { ContextManager } from "./context-manager";

/** Options for {@link UrlContextManager} (`contextManager.type: "url"`). */
export type UrlContextManagerOpts = {
    /** Required URL template used to parse the current page number from the tab URL. */
    readonly urlTemplate: UrlTemplate;
};

/**
 * Context manager that derives the current page solely from the tab URL and `urlTemplate`.
 * Does not bind or update DOM paginators.
 */
export class UrlContextManager implements ContextManager {
    private readonly log: Logger = new Logger("UrlContextManager");

    constructor(private readonly opts: UrlContextManagerOpts) { }

    /**
     * Resolves `urlTemplate` and reads the page number from `window.location`.
     * @param fallbackPageNumber - Used when the template does not capture a number (default `1`)
     */
    resolveContext(fallbackPageNumber: number = 1): PaginationContext {
        this.log.debug("Resolving pagination context from URL template ...", window.location.href);

        const resolvedUrlTemplate = resolveUrlTemplate(this.opts.urlTemplate, document);
        const templatePath = resolvedUrlTemplate?.template;

        const parsed = templatePath != null
            ? extractPageNumberFromUrl(window.location.href, templatePath)
            : null;

        if (parsed == null) {
            this.log.debug(
                "URL template did not capture a valid page number, returning fallback:",
                fallbackPageNumber,
            );
        }

        const rootPage = {
            url: window.location.href.toString(),
            number: parsed != null ? parsed : fallbackPageNumber,
            state: ItemState.DONE,
        };
        if (Logger.isTraceEnabled()) {
            this.log.trace("Created root page:", rootPage);
        } else {
            this.log.debug("Created root page: number:", rootPage.number, "url:", rootPage.url);
        }

        return {
            rootPage,
            cursor: rootPage,
            paginators: [],
            ...(resolvedUrlTemplate != null ? { resolvedUrlTemplate } : {}),
        };
    }

    applyPaginatorPointers(
        _context: PaginationContext,
        _previousPage: Page | null,
        _nextPage: Page | null,
    ): void {
    }
}

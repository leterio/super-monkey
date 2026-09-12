import { requireDocumentResponse } from "../../../utils/dom/document";
import { Logger } from "../../../utils/logger";
import { httpRequest } from "../../../utils/network";
import { normalizeUrl } from "../../../utils/urls";
import { Page } from "../metadata";

export type PageFetcherRequestOpts = {
    readonly method?: string;
    readonly headers?: Record<string, string>;
}

export type PageFetcherOpts = {
    readonly timeoutMs: number;
    readonly request?: PageFetcherRequestOpts;
}

export type PageFetchResponse = {
    readonly content: Document;
    readonly finalUrl: string;
}

export class PageFetcher {
    private readonly log: Logger = new Logger("PageFetcher");

    async fetchPage(page: Page, opts: PageFetcherOpts): Promise<PageFetchResponse> {
        const url = normalizeUrl(page.url);
        this.log.debug("Requesting page", page.number, "with url:", url, "and timeout:", opts.timeoutMs);

        page.progress?.setProgress(0);

        const response = await httpRequest(url, {
            method: opts.request?.method ?? "GET",
            responseType: "document",
            timeout: opts.timeoutMs,
            headers: opts.request?.headers ?? {},
            onprogress: (progress) => page.progress?.setProgress(progress.progress),
        });

        page.progress?.setProgress(100);

        this.log.debug("Page", page.number, "loaded with final url:", response.finalUrl || url, "and status:", response.status);

        return {
            content: requireDocumentResponse(response),
            finalUrl: response.finalUrl || url,
        };
    }
}

import { requireDocumentResponse } from "../../../utils/dom/document";
import { Logger } from "../../../utils/logger";
import { download, HttpProgress, httpRequest } from "../../../utils/network";
import { normalizeUrl } from "../../../utils/urls";
import { resolveValue } from "../../../utils/value-resolver";
import { DocumentDownloadStep, DownloadRequestData, FinalDownloadStep } from "../metadata";

export type DownloadFetchOpts = {
    method?: string;
    headers?: Record<string, string>;
    data?: string | FormData | Blob;
    timeout?: number;
    signal?: AbortSignal;
    onprogress?: (progress: HttpProgress) => void;
};

export type DocumentFetchResult = {
    readonly document: Document;
    readonly finalUrl: string;
};

export class DownloadExecutor {
    private readonly log: Logger = new Logger("DownloadExecutor");

    static buildRequestData(
        data: DownloadRequestData | undefined,
        element: HTMLElement,
    ): string | FormData | undefined {
        if (data == null) {
            return undefined;
        }

        if (typeof data === "string") {
            return data;
        }

        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === "string") {
                params.set(key, value);
                continue;
            }

            const resolved = resolveValue(value, element);
            if (resolved != null) {
                params.set(key, resolved);
            }
        }

        return params.toString();
    }

    async fetchDocument(url: string, opts?: DownloadFetchOpts): Promise<DocumentFetchResult> {
        const normalizedUrl = normalizeUrl(url);
        this.log.debug("Fetching document", normalizedUrl);

        const response = await httpRequest(normalizedUrl, {
            method: opts?.method ?? "GET",
            headers: opts?.headers,
            data: opts?.data,
            responseType: "document",
            timeout: opts?.timeout,
            signal: opts?.signal,
            onprogress: opts?.onprogress,
        });

        return {
            document: requireDocumentResponse(response),
            finalUrl: response.finalUrl || normalizedUrl,
        };
    }

    fetchDocumentStep(
        url: string,
        element: HTMLElement,
        step: DocumentDownloadStep,
        onprogress?: (progress: HttpProgress) => void,
        signal?: AbortSignal,
    ): Promise<DocumentFetchResult> {
        return this.fetchDocument(url, {
            method: step.method,
            headers: step.headers,
            data: DownloadExecutor.buildRequestData(step.data, element),
            timeout: step.timeout,
            signal,
            onprogress,
        });
    }

    downloadUrl(
        url: string,
        step?: FinalDownloadStep,
        onprogress?: (progress: HttpProgress) => void,
        signal?: AbortSignal,
    ): Promise<void> {
        const normalizedUrl = normalizeUrl(url);
        this.log.debug("Downloading", normalizedUrl);

        return download(normalizedUrl, {
            headers: step?.headers,
            timeout: step?.timeout,
            signal,
            onprogress,
        });
    }
}

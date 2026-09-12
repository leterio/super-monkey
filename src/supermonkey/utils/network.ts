import { GM_download, GM_xmlhttpRequest } from "$";
import { normalizeFileName } from "./file";
import { Logger } from "./logger";
import { randomString } from "./string";
import { tryNormalizeUrl } from "./urls";

//#region Core Types

/** Supported `GM_xmlhttpRequest` response body kinds. */
export type ResponseType =
    | "text"
    | "json"
    | "arraybuffer"
    | "blob"
    | "document";

/** Maps each {@link ResponseType} to its parsed body type. */
export type ResponseTypeMap = {
    text: string;
    json: unknown;
    arraybuffer: ArrayBuffer;
    blob: Blob;
    document: Document;
};

/** Successful HTTP result from {@link httpRequest}. */
export type HttpResponse<R extends ResponseType, C = undefined> = {
    status: number;
    statusText: string;
    response: ResponseTypeMap[R];
    responseHeaders: string;
    finalUrl: string;
    context: C;
};

/** Request progress snapshot for `onprogress` callbacks. */
export type HttpProgress = {
    totalBytes: number | null;
    bytesFetched: number;
    progress: number;
};

/** Options for {@link httpRequest}. */
export type HttpRequestOpts<
    R extends ResponseType = "text",
    C = undefined
> = {
    method?: string;
    headers?: Record<string, string>;
    data?: string | FormData | Blob;
    responseType?: R;
    timeout?: number;
    context?: C;
    signal?: AbortSignal;
    onprogress?: (progress: HttpProgress) => void;
};

/** Options for {@link download}. */
export type DownloadOpts = {
    name?: string;
    headers?: Record<string, string>;
    timeout?: number;
    signal?: AbortSignal;
    onprogress?: (progress: HttpProgress) => void;
};

//#endregion

//#region Errors

/** Discriminator for {@link HttpRequestError} subclasses. */
export enum HttpRequestErrorType {
    NETWORK_ERROR = "NETWORK_ERROR",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    HTTP_ERROR = "HTTP_ERROR",
    ABORT_ERROR = "ABORT_ERROR",
}

/** Base error for failed {@link httpRequest} / {@link download} calls. */
export abstract class HttpRequestError extends Error {
    constructor(
        message: string,
        public readonly errorType: HttpRequestErrorType,
        public readonly url: string,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

/** Transport-level failure before a usable HTTP status is available. */
export class NetworkError extends HttpRequestError {
    constructor(url: string, originalError?: Error) {
        super(
            `Network error for "${url}": ${originalError?.message || "Unknown network failure"}`,
            HttpRequestErrorType.NETWORK_ERROR,
            url,
            originalError
        );
    }
}

/** Request exceeded the configured timeout. */
export class TimeoutError extends HttpRequestError {
    constructor(url: string, timeoutMs?: number) {
        super(
            `Request timeout for "${url}"${timeoutMs ? ` after ${timeoutMs}ms` : ""}`,
            HttpRequestErrorType.TIMEOUT_ERROR,
            url
        );
    }
}

/** Request was aborted via `AbortSignal` or GM abort. */
export class AbortError extends HttpRequestError {
    constructor(url: string) {
        super(
            `Request aborted for "${url}"`,
            HttpRequestErrorType.ABORT_ERROR,
            url
        );
    }
}

/** HTTP response status was 400 or higher. */
export class HttpStatusError extends HttpRequestError {
    constructor(
        url: string,
        public readonly statusCode: number,
        public readonly statusText: string,
        public readonly responseBody?: string
    ) {
        super(
            `HTTP ${statusCode} ${statusText} for "${url}"`,
            HttpRequestErrorType.HTTP_ERROR,
            url
        );
    }
}

//#endregion

function toHttpProgress(event: {
    loaded?: number;
    total?: number;
    lengthComputable?: boolean;
}): HttpProgress {
    const bytesFetched = event.loaded ?? 0;
    const totalBytes =
        event.lengthComputable && event.total != null && event.total > 0
            ? event.total
            : null;
    const progress =
        totalBytes === null
            ? 0
            : Math.min(100, Math.max(0, (bytesFetched / totalBytes) * 100));

    return { totalBytes, bytesFetched, progress };
}

function toHttpResponse<R extends ResponseType, C>(
    event: {
        status: number;
        statusText: string;
        response: ResponseTypeMap[R];
        responseHeaders: string;
        finalUrl: string;
    },
    context: C
): HttpResponse<R, C> {
    return {
        status: event.status,
        statusText: event.statusText,
        response: event.response,
        responseHeaders: event.responseHeaders,
        finalUrl: event.finalUrl,
        context,
    };
}

/**
 * Performs an HTTP request via Tampermonkey `GM_xmlhttpRequest`.
 * Rejects with {@link AbortError}, {@link NetworkError}, {@link TimeoutError}, or {@link HttpStatusError}.
 * When `context` is omitted, a short random string is used for logging.
 */
export async function httpRequest<
    R extends ResponseType = "text",
    C = undefined
>(
    url: string,
    opts?: HttpRequestOpts<R, C>
): Promise<HttpResponse<R, C>> {
    const context = (opts?.context ?? randomString(8)) as C;
    const log = new Logger(`request-${context}`);
    const signal = opts?.signal;

    if (signal?.aborted) {
        log.warn("HTTP request aborted before start");
        throw new AbortError(url);
    }

    return new Promise((resolve, reject) => {
        let settled = false;

        const settle = (action: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            action();
        };

        const onAbortSignal = () => {
            gmRequest.abort();
        };

        const cleanup = () => {
            signal?.removeEventListener("abort", onAbortSignal);
        };

        const gmRequest = GM_xmlhttpRequest({
            url,
            method: opts?.method ?? "GET",
            headers: opts?.headers,
            data: opts?.data,
            responseType: opts?.responseType,
            timeout: opts?.timeout,
            context,

            onabort: () => {
                log.warn("HTTP request aborted");
                settle(() => reject(new AbortError(url)));
            },

            onerror: (event: { error?: string }) => {
                log.error("HTTP request failed", event.error);
                settle(() =>
                    reject(new NetworkError(url, new Error(event.error || "Unknown network failure")))
                );
            },

            ontimeout: () => {
                log.error("HTTP request timed out");
                settle(() => reject(new TimeoutError(url, opts?.timeout)));
            },

            onprogress: (event: {
                loaded?: number;
                total?: number;
                lengthComputable?: boolean;
            }) => {
                opts?.onprogress?.(toHttpProgress(event));
            },

            onload: (event: {
                status: number;
                statusText: string;
                response: ResponseTypeMap[R];
                responseHeaders: string;
                finalUrl: string;
                responseText?: string;
            }) => {
                if (event.status >= 400) {
                    settle(() =>
                        reject(
                            new HttpStatusError(
                                url,
                                event.status,
                                event.statusText,
                                event.responseText
                            )
                        )
                    );
                    return;
                }

                settle(() => resolve(toHttpResponse(event, context)));
            },
        });

        signal?.addEventListener("abort", onAbortSignal, { once: true });

        if (signal?.aborted) {
            gmRequest.abort();
        }
    });
}

/** Formats a byte count for progress labels. */
export function formatByteSize(bytes: number): string {
    const value = Math.max(0, bytes);
    if (value < 1024) {
        return `${Math.round(value)} B`;
    }

    const kb = value / 1024;
    if (kb < 1024) {
        return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
    }

    const mb = kb / 1024;
    if (mb < 1024) {
        return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
    }

    const gb = mb / 1024;
    return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
}

function fileNameFromUrl(url: string): string {
    try {
        const pathname = new URL(tryNormalizeUrl(url) ?? url).pathname;
        const segment = pathname.split("/").filter(Boolean).pop();
        return segment != null && segment.length > 0 ? segment : "download";
    } catch {
        return "download";
    }
}

/** Downloads a URL to disk via Tampermonkey `GM_download`. */
export async function download(url: string, opts?: DownloadOpts): Promise<void> {
    const name = normalizeFileName(opts?.name ?? fileNameFromUrl(url));
    const log = new Logger(`download-${randomString(8)}`);
    const signal = opts?.signal;

    if (signal?.aborted) {
        log.warn("Download aborted before start");
        throw new AbortError(url);
    }

    return new Promise((resolve, reject) => {
        let settled = false;

        const settle = (action: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            action();
        };

        const onAbortSignal = () => {
            gmDownload.abort();
            settle(() => reject(new AbortError(url)));
        };

        const cleanup = () => {
            signal?.removeEventListener("abort", onAbortSignal);
        };

        const gmDownload = GM_download({
            url,
            name,
            headers: opts?.headers,
            timeout: opts?.timeout,
            saveAs: false,

            onerror: (event: { error?: string; details?: string }) => {
                const reason = event.error ?? "Unknown download failure";
                const details = event.details != null && event.details.length > 0
                    ? `: ${event.details}`
                    : "";
                log.error("Download failed", reason, details);
                settle(() =>
                    reject(new NetworkError(url, new Error(`${reason}${details}`)))
                );
            },

            ontimeout: () => {
                log.error("Download timed out");
                settle(() => reject(new TimeoutError(url, opts?.timeout)));
            },

            onprogress: (event: {
                loaded?: number;
                total?: number;
                lengthComputable?: boolean;
            }) => {
                opts?.onprogress?.(toHttpProgress(event));
            },

            onload: () => {
                settle(() => resolve());
            },
        });

        signal?.addEventListener("abort", onAbortSignal, { once: true });

        if (signal?.aborted) {
            gmDownload.abort();
            settle(() => reject(new AbortError(url)));
        }
    });
}

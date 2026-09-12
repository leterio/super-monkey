import { HttpResponse } from "../network";

/**
 * Extracts a `Document` from an HTTP response with `responseType: "document"`.
 * @throws When the response body is missing or not a `Document`
 */
export function requireDocumentResponse(response: HttpResponse<"document">): Document {
    const content = response.response as unknown;
    const document =
        (content as { document?: Document } | null)?.document ?? content;

    if (document == null || !(document instanceof Document)) {
        throw new Error("HTTP response must contain a valid Document");
    }

    return document;
}

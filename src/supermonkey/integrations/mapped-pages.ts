import { pathnameMatchesPaths } from "../utils/urls";
import { IntegrationMappedPage } from "./metadata";

function resolveActivePageNames(
    mappedPages: readonly IntegrationMappedPage[] | null | undefined,
    pathname: string,
): readonly string[] {
    if (mappedPages == null || mappedPages.length === 0) {
        return [];
    }

    return mappedPages
        .filter((page) => pathnameMatchesPaths(pathname, page.paths))
        .map((page) => page.name);
}

/**
 * Builds a live active-page resolver for an integration catalog.
 * Each call reads `window.location.pathname`.
 */
export function createGetActivePages(
    mappedPages: readonly IntegrationMappedPage[] | null | undefined,
): () => readonly string[] {
    return () => resolveActivePageNames(mappedPages, window.location.pathname);
}

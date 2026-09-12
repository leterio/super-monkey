import { ContentManagerOpts } from "../../content-manager/metadata";
import { Normalized, OptsNormalization } from "../../utils/opts/normalization";
import { trimArray } from "../../utils/arrays";
import {
    hasPositiveAllowDenyPattern,
    normalizeAllowDenyPattern,
} from "../../utils/allow-deny";
import { isValidId } from "../../utils/string";
import { isPlainObject } from "../../utils/type";
import { isValidDomainPattern, isValidPathPattern } from "../../utils/urls";
import {
    Integration,
    IntegrationMappedPage,
    IntegrationModule,
} from "../metadata";

/**
 * Normalizes a stored integration envelope for the registry.
 * `contentManager` stays an opaque clone; Content Manager rules run in its loader.
 */
export function normalizeStoredIntegration(stored: unknown, mapKey: string): Normalized<Integration> {
    const walk = new OptsNormalization();

    try {
        if (!isPlainObject(stored)) {
            walk.reject("integration", "invalid entry");
            return walk.finish<Integration>(undefined);
        }

        const name = resolveIntegrationName(stored.name, mapKey);
        if (name == null) {
            walk.reject("name", "missing or invalid name");
            return walk.finish<Integration>(undefined);
        }

        const matchedDomains = readMatchedDomains(stored.matchedDomains, walk);
        if (matchedDomains.length === 0) {
            walk.reject("matchedDomains", "no valid matchedDomains");
            return walk.finish<Integration>(undefined);
        }

        const mappedPages = readMappedPages(stored.mappedPages, walk);
        const contentManager = readOpaqueObject<ContentManagerOpts>(
            stored.contentManager,
            "contentManager",
            walk,
        );
        const modules = readModules(stored.modules, walk);
        const defaults = readOpaqueObject<Record<string, unknown>>(
            stored.defaults,
            "defaults",
            walk,
        );

        return walk.finish({
            name,
            matchedDomains,
            ...(mappedPages != null ? { mappedPages } : {}),
            ...(contentManager != null ? { contentManager } : {}),
            ...(modules != null ? { modules } : {}),
            ...(defaults != null ? { defaults } : {}),
        });
    } catch (error) {
        walk.reject("integration", error instanceof Error ? error.message : String(error));
        return walk.finish<Integration>(undefined);
    }
}

function resolveIntegrationName(value: unknown, mapKey: string): string | undefined {
    if (value != null && typeof value !== "string") {
        return undefined;
    }

    const fromValue = typeof value === "string" ? value.trim() : "";
    if (fromValue.length > 0) {
        return isValidId(fromValue) ? fromValue : undefined;
    }

    const fromKey = mapKey.trim();
    return isValidId(fromKey) ? fromKey : undefined;
}

function readMatchedDomains(value: unknown, walk: OptsNormalization): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const domains: string[] = [];
    let dropped = 0;
    for (const item of trimArray(value)) {
        const normalized = normalizeAllowDenyPattern(item);
        if (normalized != null && isValidDomainPattern(normalized)) {
            domains.push(normalized);
            continue;
        }

        dropped += 1;
    }

    if (dropped > 0 && hasPositiveAllowDenyPattern(domains)) {
        walk.repair("matchedDomains", "ignored invalid matchedDomains entries");
    }

    return hasPositiveAllowDenyPattern(domains) ? domains : [];
}

function readMappedPages(
    value: unknown,
    walk: OptsNormalization,
): readonly IntegrationMappedPage[] | undefined {
    if (value == null) {
        return undefined;
    }

    if (!Array.isArray(value)) {
        walk.repair("mappedPages", "mappedPages ignored because it is not an array");
        return undefined;
    }

    const pages: IntegrationMappedPage[] = [];
    const seenNames = new Set<string>();

    for (const [index, entry] of value.entries()) {
        if (!isPlainObject(entry)) {
            walk.repair(`mappedPages[${index}]`, "mapped page dropped");
            continue;
        }

        const name = typeof entry.name === "string" ? entry.name.trim() : "";
        if (!isValidId(name)) {
            walk.repair(`mappedPages[${index}]`, "mapped page dropped");
            continue;
        }

        if (seenNames.has(name)) {
            walk.repair(`mappedPages.${name}`, "duplicate mapped page dropped");
            continue;
        }

        if (!Array.isArray(entry.paths)) {
            walk.repair(`mappedPages.${name}`, "mapped page dropped");
            continue;
        }

        const paths: string[] = [];
        let droppedPaths = 0;
        for (const rawPath of trimArray(entry.paths)) {
            const normalized = normalizeAllowDenyPattern(rawPath);
            if (normalized != null && isValidPathPattern(normalized)) {
                paths.push(normalized);
                continue;
            }
            droppedPaths += 1;
        }

        if (droppedPaths > 0) {
            walk.repair(`mappedPages.${name}.paths`, "ignored invalid path patterns");
        }

        if (!hasPositiveAllowDenyPattern(paths)) {
            walk.repair(`mappedPages.${name}`, "mapped page dropped");
            continue;
        }

        seenNames.add(name);
        pages.push({ name, paths });
    }

    return pages.length > 0 ? pages : undefined;
}

function readOpaqueObject<T extends object>(
    value: unknown,
    path: string,
    walk: OptsNormalization,
): T | undefined {
    if (value == null) {
        return undefined;
    }

    if (!isPlainObject(value)) {
        walk.repair(path, `${path} ignored because it is not an object`);
        return undefined;
    }

    return structuredClone(value) as T;
}

function readModules(value: unknown, walk: OptsNormalization): Record<string, IntegrationModule> | undefined {
    if (value == null) {
        return undefined;
    }

    if (!isPlainObject(value)) {
        walk.repair("modules", "modules ignored because it is not an object");
        return undefined;
    }

    const modules: Record<string, IntegrationModule> = {};
    for (const [instanceName, raw] of Object.entries(value)) {
        if (!isValidId(instanceName) || !isPlainObject(raw) || typeof raw.module !== "string") {
            walk.repair(`modules.${instanceName}`, "module instance dropped");
            continue;
        }

        const module = raw.module.trim();
        if (module.length === 0) {
            walk.repair(`modules.${instanceName}`, "module instance dropped");
            continue;
        }

        const opts = isPlainObject(raw.opts) ? structuredClone(raw.opts) : undefined;
        modules[instanceName] = {
            module,
            ...(opts != null ? { opts } : {}),
        };
    }

    return Object.keys(modules).length > 0 ? modules : undefined;
}

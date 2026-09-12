import { Normalized, OptsFinding, OptsNormalization } from "../utils/opts/normalization";
import { readStringList } from "../utils/opts/opts-fields";
import { normalizeValueSource, normalizeValueSources } from "../utils/opts/value-resolver-opts";
import { trimToUndefined } from "../utils/string";
import { isPlainObject } from "../utils/type";
import {
    ContentManagerGroup,
    ContentManagerListing,
    ContentManagerListingCleanup,
    ContentManagerOpts,
    ContentManagerView,
    ScanMode,
} from "./metadata";

/** Inclusive lower bound for `scanIntervalMs` when `scanMode` is `interval`. */
export const MIN_SCAN_INTERVAL_MS = 1000;
/** Inclusive upper bound for `scanIntervalMs` when `scanMode` is `interval`. */
export const MAX_SCAN_INTERVAL_MS = 60000;
/** Default `scanIntervalMs` when interval mode is active and the field is omitted. */
export const DEFAULT_SCAN_INTERVAL_MS = MIN_SCAN_INTERVAL_MS;
/** Default {@link ScanMode} when `scanMode` is omitted or unrecognized. */
export const DEFAULT_SCAN_MODE = ScanMode.ONLOAD;

/**
 * Normalizes Content Manager opts before load.
 * Unusable groups/views/listings are dropped as repairs; no usable group omits `value`.
 */
export function normalizeContentManagerOpts(raw: unknown): Normalized<ContentManagerOpts> {
    const walk = new OptsNormalization();

    if (!isPlainObject(raw)) {
        walk.reject("contentManager", "options must be an object");
        return walk.finish<ContentManagerOpts>(undefined);
    }

    const scanMode = normalizeScanModeField(raw, walk);
    const scanIntervalMs = normalizeScanIntervalMs(raw, scanMode, walk);
    const groups = normalizeGroups(raw, walk);

    return walk.finish({ groups, scanMode, scanIntervalMs });
}

/**
 * Findings from {@link normalizeContentManagerOpts} for UI validation.
 */
export function validateContentManagerOpts(raw: unknown): readonly OptsFinding[] {
    return normalizeContentManagerOpts(raw).findings;
}

function normalizeScanModeField(raw: Record<string, unknown>, walk: OptsNormalization): ScanMode {
    if (raw.scanMode == null) {
        return DEFAULT_SCAN_MODE;
    }

    const normalized = parseScanMode(raw.scanMode);
    if (normalized != null) {
        return normalized;
    }

    walk.repair(
        "contentManager.scanMode",
        `scanMode must be "${ScanMode.ONLOAD}" or "${ScanMode.INTERVAL}"; using "${DEFAULT_SCAN_MODE}"`,
    );
    return DEFAULT_SCAN_MODE;
}

function normalizeScanIntervalMs(
    raw: Record<string, unknown>,
    scanMode: ScanMode,
    walk: OptsNormalization,
): number | undefined {
    if (scanMode === ScanMode.INTERVAL) {
        const rawIntervalMs = raw.scanIntervalMs ?? DEFAULT_SCAN_INTERVAL_MS;
        const intervalMs = reboundScanIntervalMs(rawIntervalMs);

        if (intervalMs !== rawIntervalMs) {
            walk.repair(
                "contentManager.scanIntervalMs",
                `scanIntervalMs adjusted from ${rawIntervalMs} to ${intervalMs}`,
            );
        }

        return intervalMs;
    }

    if (raw.scanIntervalMs != null) {
        walk.repair(
            "contentManager.scanIntervalMs",
            "scanIntervalMs is ignored when scanMode is not interval",
        );
    }

    return undefined;
}

function normalizeGroups(
    raw: Record<string, unknown>,
    walk: OptsNormalization,
): Record<string, ContentManagerGroup> {
    const groups: Record<string, ContentManagerGroup> = {};
    const rawGroups = raw.groups;

    if (rawGroups == null || typeof rawGroups !== "object" || Array.isArray(rawGroups)) {
        walk.repair("contentManager.groups", "groups must be an object");
    } else {
        for (const groupKey of Object.keys(rawGroups)) {
            const trimmedKey = groupKey.trim();
            const groupPath = `contentManager.groups.${trimmedKey.length > 0 ? trimmedKey : groupKey}`;

            if (trimmedKey.length === 0) {
                walk.repair("contentManager.groups", "group names must be non-empty");
                continue;
            }

            const group = (rawGroups as Record<string, unknown>)[groupKey];

            if (!isPlainObject(group)) {
                walk.repair(groupPath, "group must be an object");
                continue;
            }

            if (!isUsableGroupShape(group as ContentManagerGroup)) {
                walk.repair(groupPath, "at least one of views or listings is required");
                continue;
            }

            const normalized = normalizeGroup(group as ContentManagerGroup, groupPath, walk);
            if (normalized == null) {
                continue;
            }

            groups[trimmedKey] = normalized;
        }
    }

    if (Object.keys(groups).length === 0) {
        walk.reject("contentManager.groups", "at least one usable group is required");
    }

    return groups;
}

function isUsableGroupShape(group: ContentManagerGroup): boolean {
    const hasViews = Array.isArray(group.views) && group.views.length > 0;
    const hasListings = Array.isArray(group.listings) && group.listings.length > 0;
    return hasViews || hasListings;
}

function reboundScanIntervalMs(intervalMs: unknown): number {
    if (typeof intervalMs !== "number" || !Number.isFinite(intervalMs)) {
        return DEFAULT_SCAN_INTERVAL_MS;
    }

    const rounded = Math.round(intervalMs);
    return Math.min(MAX_SCAN_INTERVAL_MS, Math.max(MIN_SCAN_INTERVAL_MS, rounded));
}

function parseScanMode(value: unknown): ScanMode | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === ScanMode.ONLOAD) {
        return ScanMode.ONLOAD;
    }

    if (normalized === ScanMode.INTERVAL) {
        return ScanMode.INTERVAL;
    }

    return undefined;
}

function normalizeGroup(
    group: ContentManagerGroup,
    path: string,
    walk: OptsNormalization,
): ContentManagerGroup | undefined {
    const views = group.views;
    const listings = group.listings;

    let normalizedViews: ContentManagerView[] | undefined;
    if (views != null && !Array.isArray(views)) {
        walk.repair(`${path}.views`, "views must be an array");
    } else if (Array.isArray(views) && views.length > 0) {
        normalizedViews = [];
        for (const [index, view] of views.entries()) {
            const normalized = normalizeView(view, `${path}.views[${index}]`, walk);
            if (normalized != null) {
                normalizedViews.push(normalized);
            }
        }
    }

    let normalizedListings: ContentManagerListing[] | undefined;
    if (listings != null && !Array.isArray(listings)) {
        walk.repair(`${path}.listings`, "listings must be an array");
    } else if (Array.isArray(listings) && listings.length > 0) {
        normalizedListings = [];
        for (const [index, listing] of listings.entries()) {
            const normalized = normalizeListing(listing, `${path}.listings[${index}]`, walk);
            if (normalized != null) {
                normalizedListings.push(normalized);
            }
        }
    }

    const hasUsableViews = normalizedViews != null && normalizedViews.length > 0;
    const hasUsableListings = normalizedListings != null && normalizedListings.length > 0;

    if (!hasUsableViews && !hasUsableListings) {
        walk.repair(path, "at least one usable view or listing is required");
        return undefined;
    }

    return {
        ...(hasUsableViews ? { views: normalizedViews } : {}),
        ...(hasUsableListings ? { listings: normalizedListings } : {}),
    };
}

function normalizeView(
    view: ContentManagerView,
    path: string,
    walk: OptsNormalization,
): ContentManagerView | undefined {
    if (view == null || typeof view !== "object") {
        walk.repair(path, "view must be an object");
        return undefined;
    }

    let idSource: ContentManagerView["idSource"] | undefined;
    if (view.idSource == null) {
        walk.repair(`${path}.idSource`, "idSource is required");
    } else {
        idSource = normalizeValueSource(view.idSource, `${path}.idSource`, walk);
    }

    const selectors = readStringList(view.selectors, `${path}.selectors`, walk, {
        label: "selectors",
        onEmpty: "repair",
    });
    const pageFilter = readStringList(view.pageFilter, `${path}.pageFilter`, walk, {
        label: "pageFilter",
        onEmpty: "omit",
    });
    const name = readRequiredName(view.name, `${path}.name`, walk);

    if (idSource == null || name == null) {
        return undefined;
    }

    return {
        name,
        idSource,
        ...(selectors != null ? { selectors } : {}),
        ...(pageFilter != null ? { pageFilter } : {}),
    };
}

function normalizeListing(
    listing: ContentManagerListing,
    path: string,
    walk: OptsNormalization,
): ContentManagerListing | undefined {
    if (listing == null || typeof listing !== "object") {
        walk.repair(path, "listing must be an object");
        return undefined;
    }

    let valid = true;

    const containerSelectors = readStringList(
        listing.containerSelectors,
        `${path}.containerSelectors`,
        walk,
        { required: true, label: "containerSelectors" },
    );
    if (containerSelectors == null) {
        valid = false;
    }

    const entriesSelectors = readStringList(
        listing.entriesSelectors,
        `${path}.entriesSelectors`,
        walk,
        { required: true, label: "entriesSelectors" },
    );
    if (entriesSelectors == null) {
        valid = false;
    }

    const entryIdSource = normalizeValueSources(listing.entryIdSource, `${path}.entryIdSource`, walk);
    if (entryIdSource.length === 0) {
        valid = false;
    }

    const entryContainerSelector = readStringList(
        listing.entryContainerSelector,
        `${path}.entryContainerSelector`,
        walk,
        { label: "entryContainerSelector", onEmpty: "repair" },
    );
    const cleanup = normalizeListingCleanup(listing.cleanup, `${path}.cleanup`, walk);
    const pageFilter = readStringList(listing.pageFilter, `${path}.pageFilter`, walk, {
        label: "pageFilter",
        onEmpty: "omit",
    });
    const name = readRequiredName(listing.name, `${path}.name`, walk);

    if (!valid || containerSelectors == null || entriesSelectors == null || name == null) {
        return undefined;
    }

    return {
        name,
        containerSelectors,
        entriesSelectors,
        entryIdSource,
        ...(entryContainerSelector != null ? { entryContainerSelector } : {}),
        ...(cleanup != null ? { cleanup } : {}),
        ...(pageFilter != null ? { pageFilter } : {}),
    };
}

function normalizeListingCleanup(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): ContentManagerListingCleanup | undefined {
    if (raw == null) {
        return undefined;
    }

    if (!isPlainObject(raw)) {
        walk.repair(path, "cleanup must be an object");
        return undefined;
    }

    const hasRemoveNonEntities = Object.prototype.hasOwnProperty.call(raw, "removeNonEntities");
    const hasRemoveSelectors = Object.prototype.hasOwnProperty.call(raw, "removeSelectors");

    if (hasRemoveNonEntities && hasRemoveSelectors) {
        walk.repair(
            path,
            "cleanup must use either removeNonEntities or removeSelectors, not both",
        );
        return undefined;
    }

    if (hasRemoveNonEntities) {
        if (raw.removeNonEntities === true) {
            return { removeNonEntities: true };
        }

        walk.repair(path, "removeNonEntities must be true when present");
        return undefined;
    }

    if (hasRemoveSelectors) {
        const removeSelectors = readStringList(raw.removeSelectors, `${path}.removeSelectors`, walk, {
            required: true,
            label: "removeSelectors",
        });
        if (removeSelectors == null) {
            return undefined;
        }
        return { removeSelectors };
    }

    walk.repair(
        path,
        "cleanup requires removeNonEntities: true or a non-empty removeSelectors list",
    );
    return undefined;
}

function readRequiredName(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): string | undefined {
    if (raw == null || typeof raw !== "string") {
        walk.repair(path, "name is required");
        return undefined;
    }

    const name = trimToUndefined(raw);
    if (name == null) {
        walk.repair(path, "name is required");
        return undefined;
    }

    return name;
}

import { trimArray } from "../../utils/arrays";
import { readStringList } from "../../utils/opts/opts-fields";
import { Normalized, OptsNormalization } from "../../utils/opts/normalization";
import { normalizeValueSource } from "../../utils/opts/value-resolver-opts";
import { trimToUndefined } from "../../utils/string";
import { isPlainObject } from "../../utils/type";
import type { ModuleOpts } from "../module";
import { BUILTIN_RESOURCES_MAPPINGS } from "./mapping/builtin";
import {
    BUILTIN_DOWNLOAD_MODES,
    type DocumentDownloadStep,
    type DownloadMode,
    type DownloadRequestData,
    type DownloadStep,
    type FinalDownloadStep,
    type ResourcesDecoration,
    type ResourcesMapping,
    type ResourcesMappingCollection,
    type ResourcesMappingLeaf,
} from "./metadata";
import type { ValueSource } from "../../utils/value-resolver";

export type ResourcesDownloaderOpts = ModuleOpts & {
    readonly mappings: Record<string, ResourcesMapping>;
    readonly entryPoints?: readonly string[];
    readonly downloadModes?: readonly DownloadMode[];
};

/**
 * Normalizes ResourcesDownloader opts before load.
 * Missing or unusable mappings omit `value`. Individual bad mappings or modes are dropped as repairs.
 * Returned `mappings` are user keys only; builtins merge at runtime in {@link ResourcesDownloader}.
 */
export function normalizeResourcesDownloaderOpts(raw: unknown): Normalized<ResourcesDownloaderOpts> {
    const walk = new OptsNormalization();

    if (!isPlainObject(raw)) {
        walk.reject("opts", "options must be an object");
        return walk.finish<ResourcesDownloaderOpts>(undefined);
    }

    const userMappings = normalizeUserMappings(raw.mappings, walk);
    if (userMappings == null) {
        return walk.finish<ResourcesDownloaderOpts>(undefined);
    }

    const downloadModes = normalizeDownloadModes(raw.downloadModes, walk);
    const downloadModeNames = new Set<string>(BUILTIN_DOWNLOAD_MODES);
    for (const mode of downloadModes ?? []) {
        downloadModeNames.add(mode.name);
    }

    const keptUserMappings = pruneUserMappings(userMappings, downloadModeNames, walk);
    stripRedundantBuiltinUserMappings(keptUserMappings, walk);
    if (Object.keys(keptUserMappings).length === 0) {
        walk.reject("mappings", "mappings is required");
        return walk.finish<ResourcesDownloaderOpts>(undefined);
    }

    dropCyclicUserMappings(keptUserMappings, {
        ...BUILTIN_RESOURCES_MAPPINGS,
        ...keptUserMappings,
    }, walk);
    stripDanglingCollectionChildren(keptUserMappings, walk);
    if (Object.keys(keptUserMappings).length === 0) {
        walk.reject("mappings", "mappings is required");
        return walk.finish<ResourcesDownloaderOpts>(undefined);
    }

    const consolidated: Record<string, ResourcesMapping> = {
        ...BUILTIN_RESOURCES_MAPPINGS,
        ...keptUserMappings,
    };

    const entryPoints = resolveEntryPoints(Object.keys(keptUserMappings), consolidated);
    if (entryPoints.length === 0) {
        walk.reject(
            "mappings",
            "no scannable mappings found; builtin mappings can only be used as collection children",
        );
        return walk.finish<ResourcesDownloaderOpts>(undefined);
    }

    return walk.finish({
        mappings: keptUserMappings,
        entryPoints,
        ...(downloadModes != null && downloadModes.length > 0 ? { downloadModes } : {}),
    });
}

/**
 * Drops user keys that are identical to a built-in mapping.
 * Heals opts that previously persisted consolidated builtins from save-time normalization.
 */
function stripRedundantBuiltinUserMappings(
    userMappings: Record<string, ResourcesMapping>,
    walk: OptsNormalization,
): void {
    for (const key of Object.keys(BUILTIN_RESOURCES_MAPPINGS)) {
        const userMapping = userMappings[key];
        if (userMapping == null) {
            continue;
        }

        const probe = new OptsNormalization();
        const normalizedBuiltin = normalizeMapping(
            BUILTIN_RESOURCES_MAPPINGS[key],
            `mappings.${key}`,
            probe,
        );
        if (normalizedBuiltin == null) {
            continue;
        }

        if (JSON.stringify(userMapping) !== JSON.stringify(normalizedBuiltin)) {
            continue;
        }

        delete userMappings[key];
        walk.repair(
            `mappings.${key}`,
            `redundant built-in mapping "${key}" removed; reference it as a collection child instead`,
        );
    }
}

function normalizeUserMappings(
    raw: unknown,
    walk: OptsNormalization,
): Record<string, ResourcesMapping> | undefined {
    if (raw == null || !isPlainObject(raw)) {
        walk.reject("mappings", "mappings is required");
        return undefined;
    }

    const keys = Object.keys(raw);
    if (keys.length === 0) {
        walk.reject("mappings", "mappings is required");
        return undefined;
    }

    const mappings: Record<string, ResourcesMapping> = {};

    for (const key of keys) {
        const path = `mappings.${key}`;
        const trimmedKey = key.trim();
        if (trimmedKey.length === 0) {
            walk.repair("mappings", "mapping keys must be non-empty");
            continue;
        }

        const mapping = normalizeMapping(raw[key], path, walk);
        if (mapping != null) {
            mappings[trimmedKey] = mapping;
        }
    }

    if (Object.keys(mappings).length === 0) {
        walk.reject("mappings", "mappings is required");
        return undefined;
    }

    return mappings;
}

function normalizeMapping(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): ResourcesMapping | undefined {
    if (!isPlainObject(raw)) {
        walk.repair(path, "mapping must be an object");
        return undefined;
    }

    const selectors = normalizeSelectors(raw.selectors, `${path}.selectors`, walk);
    if (selectors == null) {
        return undefined;
    }

    const ignoreDecoration = raw.ignoreDecoration === true ? true : undefined;
    const decoration = normalizeDecoration(raw.decoration, `${path}.decoration`, walk);

    const base = {
        selectors,
        ...(ignoreDecoration != null ? { ignoreDecoration } : {}),
        ...(decoration != null ? { decoration } : {}),
    };

    if (raw.type === "leaf") {
        return normalizeLeafMapping(raw, path, base, walk);
    }

    if (raw.type === "collection") {
        return normalizeCollectionMapping(raw, path, base, walk);
    }

    walk.repair(`${path}.type`, 'type must be "leaf" or "collection"');
    return undefined;
}

function normalizeLeafMapping(
    raw: Record<string, unknown>,
    path: string,
    base: {
        selectors: string[];
        ignoreDecoration?: boolean;
        decoration?: ResourcesDecoration;
    },
    walk: OptsNormalization,
): ResourcesMappingLeaf | undefined {
    const urlSources = normalizeUrlSources(raw.urlSources, `${path}.urlSources`, walk);
    if (urlSources == null) {
        return undefined;
    }

    let downloadMode: string | undefined;
    if (raw.downloadMode != null) {
        if (typeof raw.downloadMode === "string" && raw.downloadMode.trim().length > 0) {
            downloadMode = raw.downloadMode.trim();
        } else {
            walk.repair(`${path}.downloadMode`, "downloadMode must be a non-empty string");
            return undefined;
        }
    }

    return {
        type: "leaf",
        ...base,
        urlSources,
        ...(downloadMode != null ? { downloadMode } : {}),
    };
}

function normalizeCollectionMapping(
    raw: Record<string, unknown>,
    path: string,
    base: {
        selectors: string[];
        ignoreDecoration?: boolean;
        decoration?: ResourcesDecoration;
    },
    walk: OptsNormalization,
): ResourcesMappingCollection | undefined {
    if (!Array.isArray(raw.children) || raw.children.length === 0) {
        walk.repair(`${path}.children`, "children must be a non-empty string array");
        return undefined;
    }

    const children: string[] = [];
    for (const [index, child] of raw.children.entries()) {
        const trimmed = typeof child === "string" ? child.trim() : "";
        if (trimmed.length === 0) {
            walk.repair(
                `${path}.children[${index}]`,
                "must be a non-empty mapping key string",
            );
            continue;
        }
        children.push(trimmed);
    }

    if (children.length === 0) {
        walk.repair(`${path}.children`, "children must be a non-empty string array");
        return undefined;
    }

    return {
        type: "collection",
        ...base,
        children,
    };
}

function normalizeSelectors(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): string[] | undefined {
    if (!Array.isArray(raw)) {
        walk.repair(path, "must be a non-empty string array");
        return undefined;
    }

    const selectors = trimArray(raw);
    if (selectors.length === 0) {
        walk.repair(path, "must be a non-empty string array");
        return undefined;
    }

    if (selectors.length !== raw.length) {
        walk.repair(path, "ignored empty or non-string selectors");
    }

    return selectors;
}

function normalizeDecoration(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): ResourcesDecoration | undefined {
    if (raw == null) {
        return undefined;
    }

    if (!isPlainObject(raw)) {
        walk.repair(path, "decoration must be an object");
        return undefined;
    }

    const wrapClasses = readStringList(raw.wrapClasses, `${path}.wrapClasses`, walk, {
        label: "wrapClasses",
    });
    const closestSelectors = readStringList(
        raw.closestSelectors,
        `${path}.closestSelectors`,
        walk,
        { label: "closestSelectors" },
    );

    const useImmediateParent = raw.useImmediateParent === true;
    if (useImmediateParent && closestSelectors != null) {
        walk.repair(
            `${path}.closestSelectors`,
            "ignored closestSelectors because useImmediateParent takes precedence",
        );
    }

    return {
        ...(raw.wrapElement === true ? { wrapElement: true } : {}),
        ...(wrapClasses != null ? { wrapClasses } : {}),
        ...(raw.wrapCopyElementClasses === true ? { wrapCopyElementClasses: true } : {}),
        ...(useImmediateParent ? { useImmediateParent: true } : {}),
        ...(!useImmediateParent && closestSelectors != null ? { closestSelectors } : {}),
        ...(raw.overridePosition === true ? { overridePosition: true } : {}),
    };
}

function normalizeUrlSources(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): Array<string | ValueSource> | undefined {
    if (!Array.isArray(raw) || raw.length === 0) {
        walk.repair(path, "urlSources must be a non-empty array");
        return undefined;
    }

    const sources: Array<string | ValueSource> = [];
    for (const [index, entry] of raw.entries()) {
        const entryPath = `${path}[${index}]`;
        if (typeof entry === "string") {
            const trimmed = entry.trim();
            if (trimmed.length === 0) {
                walk.repair(entryPath, "ignored empty url source");
                continue;
            }
            sources.push(trimmed);
            continue;
        }

        const valueSource = normalizeValueSource(entry, entryPath, walk);
        if (valueSource != null) {
            sources.push(valueSource);
        }
    }

    if (sources.length === 0) {
        walk.repair(path, "urlSources must be a non-empty array");
        return undefined;
    }

    return sources;
}

function normalizeDownloadModes(
    raw: unknown,
    walk: OptsNormalization,
): DownloadMode[] | undefined {
    if (raw == null) {
        return undefined;
    }

    if (!Array.isArray(raw)) {
        walk.repair("downloadModes", "downloadModes must be an array");
        return undefined;
    }

    if (raw.length === 0) {
        return undefined;
    }

    const names = new Set<string>(BUILTIN_DOWNLOAD_MODES);
    const modes: DownloadMode[] = [];

    for (const [modeIndex, entry] of raw.entries()) {
        const path = `resourcesDownloader.downloadModes[${modeIndex}]`;
        if (!isPlainObject(entry)) {
            walk.repair(path, "mode must be an object");
            continue;
        }

        const name = trimToUndefined(entry.name);
        if (name == null) {
            walk.repair(path, "name is required");
            continue;
        }

        if (names.has(name)) {
            walk.repair(path, `duplicate mode name "${name}"`);
            continue;
        }

        const steps = normalizeDownloadSteps(entry.steps, `${path}.steps`, walk);
        if (steps == null) {
            continue;
        }

        names.add(name);
        modes.push({
            name,
            steps,
        });
    }

    return modes.length > 0 ? modes : undefined;
}

function normalizeDownloadSteps(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): DownloadStep[] | undefined {
    if (!Array.isArray(raw) || raw.length === 0) {
        walk.repair(path, "steps must be a non-empty array");
        return undefined;
    }

    const steps: DownloadStep[] = [];

    for (const [stepIndex, entry] of raw.entries()) {
        const stepPath = `${path}[${stepIndex}]`;
        if (!isPlainObject(entry)) {
            walk.repair(stepPath, "step must be an object");
            continue;
        }

        if (entry.mode === "download") {
            const downloadStep = normalizeFinalDownloadStep(entry, stepPath, walk);
            if (downloadStep != null) {
                steps.push(downloadStep);
            }
            continue;
        }

        if (entry.mode === "document") {
            const documentStep = normalizeDocumentStep(entry, stepPath, walk);
            if (documentStep != null) {
                steps.push(documentStep);
            }
            continue;
        }

        walk.repair(`${stepPath}.mode`, 'mode must be "document" or "download"');
    }

    if (steps.length === 0) {
        walk.repair(path, "steps must be a non-empty array");
        return undefined;
    }

    const midDownload = steps.some(
        (step, index) => step.mode === "download" && index !== steps.length - 1,
    );
    if (midDownload) {
        walk.repair(path, "download step is only allowed as the last step");
        return undefined;
    }

    if (steps[steps.length - 1]?.mode !== "download") {
        steps.push({ mode: "download" });
    }

    return steps;
}

function normalizeFinalDownloadStep(
    entry: Record<string, unknown>,
    stepPath: string,
    walk: OptsNormalization,
): FinalDownloadStep | undefined {
    const headers = normalizeStringRecord(entry.headers, `${stepPath}.headers`, walk);
    let timeout: number | undefined;
    if (entry.timeout != null) {
        if (typeof entry.timeout === "number" && Number.isFinite(entry.timeout)) {
            timeout = entry.timeout;
        } else {
            walk.repair(`${stepPath}.timeout`, "timeout must be a finite number");
            return undefined;
        }
    }

    return {
        mode: "download",
        ...(headers != null ? { headers } : {}),
        ...(timeout != null ? { timeout } : {}),
    };
}

function normalizeDocumentStep(
    entry: Record<string, unknown>,
    stepPath: string,
    walk: OptsNormalization,
): DocumentDownloadStep | undefined {
    const valueSource = normalizeValueSource(entry.valueSource, `${stepPath}.valueSource`, walk);
    if (valueSource == null) {
        walk.repair(`${stepPath}.valueSource`, "valueSource is required");
        return undefined;
    }

    if (!hasDocumentStepSelectors(valueSource)) {
        walk.repair(
            `${stepPath}.valueSource.selectors`,
            "document step valueSource requires at least one selector",
        );
        return undefined;
    }

    const method = trimToUndefined(entry.method);
    const headers = normalizeStringRecord(entry.headers, `${stepPath}.headers`, walk);
    const data = normalizeRequestData(entry.data, `${stepPath}.data`, walk);
    let timeout: number | undefined;
    if (entry.timeout != null) {
        if (typeof entry.timeout === "number" && Number.isFinite(entry.timeout)) {
            timeout = entry.timeout;
        } else {
            walk.repair(`${stepPath}.timeout`, "timeout must be a finite number");
            return undefined;
        }
    }

    return {
        mode: "document",
        valueSource,
        ...(method != null ? { method } : {}),
        ...(headers != null ? { headers } : {}),
        ...(data != null ? { data } : {}),
        ...(timeout != null ? { timeout } : {}),
    };
}

function hasDocumentStepSelectors(valueSource: ValueSource): boolean {
    if (valueSource.source === "query-param" || valueSource.source === "path") {
        return false;
    }

    return valueSource.selectors != null && valueSource.selectors.length > 0;
}

function normalizeStringRecord(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): Record<string, string> | undefined {
    if (raw == null) {
        return undefined;
    }

    if (!isPlainObject(raw)) {
        walk.repair(path, "must be an object");
        return undefined;
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value !== "string") {
            walk.repair(`${path}.${key}`, "must be a string");
            continue;
        }
        result[key] = value;
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeRequestData(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): DownloadRequestData | undefined {
    if (raw == null) {
        return undefined;
    }

    if (typeof raw === "string") {
        return raw;
    }

    if (!isPlainObject(raw)) {
        walk.repair(path, "must be a string or object");
        return undefined;
    }

    const result: Record<string, string | ValueSource> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string") {
            result[key] = value;
            continue;
        }

        const valueSource = normalizeValueSource(value, `${path}.${key}`, walk);
        if (valueSource != null) {
            result[key] = valueSource;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

function pruneUserMappings(
    userMappings: Record<string, ResourcesMapping>,
    downloadModeNames: ReadonlySet<string>,
    walk: OptsNormalization,
): Record<string, ResourcesMapping> {
    const kept: Record<string, ResourcesMapping> = {};

    for (const [key, mapping] of Object.entries(userMappings)) {
        if (mapping.type !== "leaf") {
            continue;
        }

        const path = `mappings.${key}`;
        const downloadMode = mapping.downloadMode ?? "download";
        if (!downloadModeNames.has(downloadMode)) {
            walk.repair(path, `unknown downloadMode "${downloadMode}"`);
            continue;
        }

        kept[key] = mapping;
    }

    let progress = true;
    while (progress) {
        progress = false;

        for (const [key, mapping] of Object.entries(userMappings)) {
            if (mapping.type !== "collection" || kept[key] != null) {
                continue;
            }

            const path = `mappings.${key}`;
            const children: string[] = [];
            let pendingChild = false;

            for (const [index, childKey] of mapping.children.entries()) {
                if (BUILTIN_RESOURCES_MAPPINGS[childKey] != null || kept[childKey] != null) {
                    children.push(childKey);
                    continue;
                }

                if (userMappings[childKey]?.type === "collection" && kept[childKey] == null) {
                    pendingChild = true;
                    break;
                }

                walk.repair(
                    `${path}.children[${index}]`,
                    `unknown mapping "${childKey}"`,
                );
            }

            if (pendingChild) {
                continue;
            }

            if (children.length === 0) {
                walk.repair(`${path}.children`, "children must be a non-empty string array");
                continue;
            }

            kept[key] = children.length === mapping.children.length
                ? mapping
                : { ...mapping, children };
            progress = true;
        }
    }

    for (const [key, mapping] of Object.entries(userMappings)) {
        if (mapping.type !== "collection" || kept[key] != null) {
            continue;
        }

        const path = `mappings.${key}`;
        walk.repair(path, "collection mapping dropped");
    }

    return kept;
}

function dropCyclicUserMappings(
    userMappings: Record<string, ResourcesMapping>,
    mappings: Record<string, ResourcesMapping>,
    walk: OptsNormalization,
): void {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const cyclic = new Set<string>();

    const visit = (key: string, path: string[]): void => {
        if (visiting.has(key)) {
            for (const cyclicKey of [...path, key]) {
                if (userMappings[cyclicKey] != null) {
                    cyclic.add(cyclicKey);
                }
            }
            walk.repair(
                "mappings",
                `mappings contain a cycle: ${[...path, key].join(" -> ")}`,
            );
            return;
        }

        if (visited.has(key)) {
            return;
        }

        const mapping = mappings[key];
        if (mapping == null || mapping.type !== "collection") {
            visited.add(key);
            return;
        }

        visiting.add(key);
        for (const childKey of mapping.children) {
            visit(childKey, [...path, key]);
        }
        visiting.delete(key);
        visited.add(key);
    };

    for (const key of Object.keys(mappings)) {
        visit(key, []);
    }

    for (const key of cyclic) {
        delete userMappings[key];
    }
}

function stripDanglingCollectionChildren(
    userMappings: Record<string, ResourcesMapping>,
    walk: OptsNormalization,
): void {
    let progress = true;
    while (progress) {
        progress = false;

        for (const [key, mapping] of Object.entries(userMappings)) {
            if (mapping.type !== "collection") {
                continue;
            }

            const path = `mappings.${key}`;
            const children = mapping.children.filter(
                (childKey) => BUILTIN_RESOURCES_MAPPINGS[childKey] != null || userMappings[childKey] != null,
            );

            if (children.length === mapping.children.length) {
                continue;
            }

            for (const [index, childKey] of mapping.children.entries()) {
                if (BUILTIN_RESOURCES_MAPPINGS[childKey] == null && userMappings[childKey] == null) {
                    walk.repair(
                        `${path}.children[${index}]`,
                        `unknown mapping "${childKey}"`,
                    );
                }
            }

            if (children.length === 0) {
                delete userMappings[key];
                walk.repair(`${path}.children`, "children must be a non-empty string array");
                progress = true;
                continue;
            }

            userMappings[key] = { ...mapping, children };
            progress = true;
        }
    }
}

function resolveEntryPoints(
    userMappingKeys: readonly string[],
    mappings: Record<string, ResourcesMapping>,
): string[] {
    const userKeys = new Set(userMappingKeys);
    const referenced = new Set<string>();

    for (const mapping of Object.values(mappings)) {
        if (mapping.type === "collection") {
            for (const childKey of mapping.children) {
                referenced.add(childKey);
            }
        }
    }

    return Object.keys(mappings)
        .filter((key) => userKeys.has(key) && !referenced.has(key))
        .sort((left, right) => {
            const leftRank = mappings[left]?.type === "collection" ? 0 : 1;
            const rightRank = mappings[right]?.type === "collection" ? 0 : 1;
            return leftRank - rightRank;
        });
}

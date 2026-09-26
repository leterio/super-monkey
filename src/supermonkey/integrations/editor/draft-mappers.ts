import {
    ContentManagerListing,
    ContentManagerListingCleanup,
    ContentManagerOpts,
    ContentManagerView,
    ScanMode,
} from "../../content-manager/metadata";
import { joinCsv, joinLines, splitCsv, splitLines } from "../../utils/string";
import { isPlainObject } from "../../utils/type";
import type { ValueMapper } from "../../utils/value-mappers";
import { ValueSource } from "../../utils/value-resolver";
import {
    IntegrationValidationIssue,
    parseOptsJson,
} from "../integration-validation";
import { Integration, IntegrationMappedPage, IntegrationModule } from "../metadata";
import { hydrateModuleOpts } from "./module-opts/apply-module-opts";
import { ModuleOptsFormRegistry } from "./module-opts/module-opts-form-registry";
import "./module-opts/register-builtin-opts-forms";

export type DraftMapStepType = "extract" | "replace" | "json_path" | "sort" | "pick";

export type DraftValueMapper = {
    type: DraftMapStepType;
    regexes: string;
    captureGroup: string;
    replacement: string;
    path: string;
    sortByKind: "path" | "area";
    sortPath: string;
    sortAreaWidth: string;
    sortAreaHeight: string;
    sortOrder: "asc" | "desc";
    pickAt: "first" | "last";
};

export type DraftValueSource = {
    source: ValueSource["source"];
    attributes: string;
    key: string;
    resolution: string;
    selectors: string;
    mapSteps: DraftValueMapper[];
};

export type DraftContentManagerView = {
    name: string;
    selectors: string;
    idSource: DraftValueSource;
    pageFilter: string;
};

export type DraftListingCleanupMode = "none" | "removeNonEntities" | "removeSelectors";

export type DraftContentManagerListing = {
    name: string;
    containerSelectors: string;
    entriesSelectors: string;
    entryIdSources: DraftValueSource[];
    entryContainerSelector: string;
    cleanupMode: DraftListingCleanupMode;
    cleanupRemoveSelectors: string;
    pageFilter: string;
};

export type DraftContentManagerGroup = {
    name: string;
    views: DraftContentManagerView[];
    listings: DraftContentManagerListing[];
};

export type DraftKeyboardNavigationOpts = {
    previousSelectors: string;
    nextSelectors: string;
};

export type DraftHistoryOpts = {
    group: string;
    newContentSelectors: string;
    recordFilter: string;
    decorateFilter: string;
    viewedStyles: string;
    listedStyles: string;
};

export type DraftCustomCssOption = {
    label: string;
    value: string;
};

export type DraftCustomCssRuleType = "boolean" | "number" | "options";

export type DraftCustomCssOnEventType =
    | ""
    | "contentLoaded"
    | "entityViewed"
    | "entitiesParsed"
    | "entitiesInjected";

export type DraftCustomCssRule = {
    type: DraftCustomCssRuleType;
    key: string;
    css: string;
    label: string;
    description: string;
    defaultValueBoolean: "true" | "false";
    defaultValueNumber: string;
    min: string;
    max: string;
    defaultValueOption: string;
    options: DraftCustomCssOption[];
    shadowRootSelectors: string;
    onEventType: DraftCustomCssOnEventType;
};

export type DraftCustomCssOpts = {
    staticCss: string;
    rules: DraftCustomCssRule[];
};

export type DraftJsSnippetListener =
    | "contentLoaded"
    | "beforeUnload"
    | "entityViewed"
    | "entitiesParsed"
    | "entitiesInjected";

export type DraftJsSnippetRule = {
    name: string;
    label: string;
    description: string;
    listener: DraftJsSnippetListener;
    code: string;
};

export type DraftJsSnippetsOpts = {
    rules: DraftJsSnippetRule[];
};

/** Binder fields for one Additional Pages Content Manager group entry. */
export type DraftAdditionalPagesGroup = {
    name: string;
} & DraftAdditionalPagesBinderFields;

/** Additional Pages binder fields shared by each Content Manager group entry. */
export type DraftAdditionalPagesBinderFields = {
    contextType: "dom" | "url";
    pagingType: "next-link" | "incremental" | "decremental";
    ignoreLastPage: "true" | "false";
    urlTemplateKind: "static" | "source";
    urlTemplate: string;
    urlTemplateSource: DraftValueSource;
    copyPageQueryParams: "true" | "false";
    rootContainers: string;
    previousSelectors: string;
    nextSelectors: string;
    currentSelectors: string;
    pageIndexes: string;
    urlAttributes: string;
    pageIndexUseImmediateParent: "true" | "false";
    pageIndexClosestSelectors: string;
    pageIndexLoadedPageClassNames: string;
    numberingStartsFromZero: "true" | "false";
    numberingLabelStartsFromZero: "true" | "false";
    pageRequestMethod: string;
    pageRequestHeadersJson: string;
};

export type DraftAdditionalPagesOpts = {
    groups: DraftAdditionalPagesGroup[];
};

export type DraftRdUrlSource = {
    kind: "attribute" | "value-source";
    attribute: string;
    valueSource: DraftValueSource;
};

export type DraftRdDecoration = {
    wrapElement: "true" | "false";
    wrapClasses: string;
    wrapCopyElementClasses: "true" | "false";
    useImmediateParent: "true" | "false";
    closestSelectors: string;
    overridePosition: "true" | "false";
};

export type DraftRdMapping = {
    key: string;
    type: "leaf" | "collection";
    selectors: string;
    pageFilter: string;
    ignoreDecoration: "true" | "false";
    decoration: DraftRdDecoration;
    urlSources: DraftRdUrlSource[];
    downloadMode: string;
    children: string;
};

export type DraftRdDownloadStep = {
    mode: "document" | "download";
    valueSource: DraftValueSource;
    method: string;
    headersJson: string;
    dataJson: string;
    timeout: string;
};

export type DraftRdDownloadMode = {
    name: string;
    steps: DraftRdDownloadStep[];
};

export type DraftResourcesDownloaderOpts = {
    mappings: DraftRdMapping[];
    downloadModes: DraftRdDownloadMode[];
};

export type DraftIntegrationModule = {
    instanceName: string;
    originalName?: string;
    module: string;
    optsText: string;
    keyboardNavigationOpts?: DraftKeyboardNavigationOpts;
    historyOpts?: DraftHistoryOpts;
    customCssOpts?: DraftCustomCssOpts;
    jsSnippetsOpts?: DraftJsSnippetsOpts;
    additionalPagesOpts?: DraftAdditionalPagesOpts;
    resourcesDownloaderOpts?: DraftResourcesDownloaderOpts;
};

export type DraftMappedPage = {
    name: string;
    paths: string;
};

export type DraftIntegration = {
    name: string;
    matchedDomains: string;
    mappedPages: DraftMappedPage[];
    contentManagerGroups: DraftContentManagerGroup[];
    scanMode: ScanMode;
    scanIntervalMs: string;
    modules: DraftIntegrationModule[];
    defaults?: Readonly<Record<string, unknown>>;
};

export type DraftToIntegrationResult =
    | { ok: true; value: Integration }
    | { ok: false; issues: IntegrationValidationIssue[] };

export function emptyMapStep(type: DraftMapStepType = "extract"): DraftValueMapper {
    return {
        type,
        regexes: "",
        captureGroup: "",
        replacement: "",
        path: "",
        sortByKind: "path",
        sortPath: "",
        sortAreaWidth: "",
        sortAreaHeight: "",
        sortOrder: "asc",
        pickAt: "first",
    };
}

export function emptyValueSource(): DraftValueSource {
    return {
        source: "attribute",
        attributes: "",
        key: "",
        resolution: "high",
        selectors: "",
        mapSteps: [],
    };
}

export function emptyView(): DraftContentManagerView {
    return {
        name: "",
        selectors: "",
        idSource: emptyValueSource(),
        pageFilter: "",
    };
}

export function emptyListing(): DraftContentManagerListing {
    return {
        name: "",
        containerSelectors: "",
        entriesSelectors: "",
        entryIdSources: [emptyValueSource()],
        entryContainerSelector: "",
        cleanupMode: "none",
        cleanupRemoveSelectors: "",
        pageFilter: "",
    };
}

export function emptyGroup(name = ""): DraftContentManagerGroup {
    return { name, views: [], listings: [] };
}

export function emptyMappedPage(): DraftMappedPage {
    return { name: "", paths: "" };
}

export function emptyDraft(name = ""): DraftIntegration {
    return {
        name,
        matchedDomains: "",
        mappedPages: [],
        contentManagerGroups: [],
        scanMode: ScanMode.ONLOAD,
        scanIntervalMs: "",
        modules: [],
    };
}

export function integrationToDraft(integration: Integration): DraftIntegration {
    const contentManager = integration.contentManager;
    return {
        name: integration.name,
        matchedDomains: joinCsv(integration.matchedDomains),
        mappedPages: (integration.mappedPages ?? []).map((page) => ({
            name: page.name,
            paths: joinCsv(page.paths),
        })),
        contentManagerGroups: Object.entries(contentManager?.groups ?? {}).map(([name, group]) => ({
            name,
            views: (group.views ?? []).map(viewToDraft),
            listings: (group.listings ?? []).map(listingToDraft),
        })),
        scanMode: contentManager?.scanMode ?? ScanMode.ONLOAD,
        scanIntervalMs: contentManager?.scanIntervalMs != null
            ? String(contentManager.scanIntervalMs)
            : "",
        modules: Object.entries(integration.modules ?? {}).map(([instanceName, module]) => {
            const draftModule: DraftIntegrationModule = {
                instanceName,
                originalName: instanceName,
                module: module.module,
                optsText: "",
            };
            hydrateModuleOpts(draftModule, module.opts);
            return draftModule;
        }),
        ...(integration.defaults != null
            ? { defaults: structuredClone(integration.defaults) }
            : {}),
    };
}

function viewToDraft(view: ContentManagerView): DraftContentManagerView {
    return {
        name: view.name ?? "",
        selectors: joinCsv(view.selectors),
        idSource: valueSourceToDraft(view.idSource),
        pageFilter: joinCsv(view.pageFilter),
    };
}

function listingToDraft(listing: ContentManagerListing): DraftContentManagerListing {
    const cleanup = listing.cleanup;
    let cleanupMode: DraftListingCleanupMode = "none";
    let cleanupRemoveSelectors = "";
    if (cleanup != null) {
        if ("removeNonEntities" in cleanup) {
            cleanupMode = "removeNonEntities";
        } else {
            cleanupMode = "removeSelectors";
            cleanupRemoveSelectors = joinCsv(cleanup.removeSelectors);
        }
    }

    return {
        name: listing.name ?? "",
        containerSelectors: joinCsv(listing.containerSelectors),
        entriesSelectors: joinCsv(listing.entriesSelectors),
        entryIdSources: listing.entryIdSource.map(valueSourceToDraft),
        entryContainerSelector: joinCsv(listing.entryContainerSelector),
        cleanupMode,
        cleanupRemoveSelectors,
        pageFilter: joinCsv(listing.pageFilter),
    };
}

export function valueSourceToDraft(source: ValueSource): DraftValueSource {
    const selectors = source.source === "attribute"
        || source.source === "text"
        || source.source === "srcset"
        ? source.selectors
        : undefined;
    return {
        ...emptyValueSource(),
        source: source.source,
        attributes: source.source === "attribute" || source.source === "srcset"
            ? joinCsv(source.attributes)
            : "",
        key: source.source === "query-param" ? source.key : "",
        resolution: source.source === "srcset" ? (source.resolution ?? "high") : "high",
        selectors: selectors != null ? joinCsv(selectors) : "",
        mapSteps: (source.map ?? []).map(valueMapperToDraft),
    };
}

function valueMapperToDraft(mapper: ValueMapper): DraftValueMapper {
    const draft = emptyMapStep(
        mapper.type === "extract"
            || mapper.type === "replace"
            || mapper.type === "json_path"
            || mapper.type === "sort"
            || mapper.type === "pick"
            ? mapper.type
            : "extract",
    );

    switch (mapper.type) {
        case "extract":
            draft.regexes = joinLines(mapper.regexes);
            draft.captureGroup = mapper.captureGroup != null ? String(mapper.captureGroup) : "";
            break;
        case "replace":
            draft.regexes = joinLines(mapper.regexes);
            draft.replacement = mapper.replacement;
            break;
        case "json_path":
            draft.path = mapper.path;
            break;
        case "sort":
            draft.sortOrder = mapper.order ?? "asc";
            if ("area" in mapper.by) {
                draft.sortByKind = "area";
                draft.sortAreaWidth = mapper.by.area.width;
                draft.sortAreaHeight = mapper.by.area.height;
            } else {
                draft.sortByKind = "path";
                draft.sortPath = mapper.by.path;
            }
            break;
        case "pick":
            draft.pickAt = mapper.at;
            break;
    }

    return draft;
}

export function draftToIntegration(draft: DraftIntegration): DraftToIntegrationResult {
    const issues: IntegrationValidationIssue[] = [];
    const modules: Record<string, IntegrationModule> = {};
    const mappedPages: IntegrationMappedPage[] = [];
    const mappedPageNames = new Set<string>();

    draft.mappedPages.forEach((page, index) => {
        const name = page.name.trim();
        const paths = splitCsv(page.paths);
        if (name.length === 0) {
            issues.push({ path: `mappedPages[${index}]`, message: "Mapped page name is required." });
            return;
        }
        if (mappedPageNames.has(name)) {
            issues.push({ path: `mappedPages.${name}`, message: "Mapped page name must be unique." });
            return;
        }
        mappedPageNames.add(name);
        mappedPages.push({ name, paths });
    });

    draft.modules.forEach((module, index) => {
        const instanceName = module.instanceName.trim();
        const modulePath = instanceName.length > 0 ? `modules.${instanceName}` : `modules[${index}]`;
        const optsResult = resolveModuleOpts(module, modulePath);
        if (!optsResult.ok) {
            issues.push(...optsResult.issues);
        }
        if (instanceName.length === 0) {
            issues.push({ path: `modules[${index}]`, message: "Module instance name is required." });
        } else if (modules[instanceName] != null) {
            issues.push({ path: `modules.${instanceName}`, message: "Module instance name must be unique." });
        } else if (optsResult.ok) {
            modules[instanceName] = {
                module: module.module.trim(),
                ...(optsResult.value != null ? { opts: optsResult.value } : {}),
            };
        }
    });

    const contentManager = draftToContentManager(draft, issues);
    if (issues.length > 0) {
        return { ok: false, issues };
    }

    return {
        ok: true,
        value: {
            name: draft.name.trim(),
            matchedDomains: splitCsv(draft.matchedDomains),
            ...(mappedPages.length > 0 ? { mappedPages } : {}),
            ...(contentManager != null ? { contentManager } : {}),
            ...(Object.keys(modules).length > 0 ? { modules } : {}),
            ...(draft.defaults != null ? { defaults: draft.defaults } : {}),
        },
    };
}

function draftToContentManager(
    draft: DraftIntegration,
    issues: IntegrationValidationIssue[],
): ContentManagerOpts | undefined {
    if (draft.contentManagerGroups.length === 0) {
        return undefined;
    }

    const groups: ContentManagerOpts["groups"] = {};
    draft.contentManagerGroups.forEach((group, groupIndex) => {
        const name = group.name.trim();
        if (name.length === 0) {
            issues.push({
                path: `contentManager.groups[${groupIndex}]`,
                message: "Group name is required.",
            });
            return;
        }
        if (groups[name] != null) {
            issues.push({ path: `contentManager.groups.${name}`, message: "Group name must be unique." });
            return;
        }

        groups[name] = {
            ...(group.views.length > 0 ? {
                views: group.views.map((view) => {
                    const selectors = splitCsv(view.selectors);
                    const pageFilter = splitCsv(view.pageFilter);
                    return {
                        name: view.name.trim(),
                        idSource: draftToValueSource(view.idSource),
                        ...(selectors.length > 0 ? { selectors } : {}),
                        ...(pageFilter.length > 0 ? { pageFilter } : {}),
                    };
                }),
            } : {}),
            ...(group.listings.length > 0 ? {
                listings: group.listings.map((listing) => {
                    const entryContainerSelector = splitCsv(listing.entryContainerSelector);
                    const cleanup = draftListingCleanup(listing);
                    const pageFilter = splitCsv(listing.pageFilter);
                    return {
                        name: listing.name.trim(),
                        containerSelectors: splitCsv(listing.containerSelectors),
                        entriesSelectors: splitCsv(listing.entriesSelectors),
                        entryIdSource: listing.entryIdSources.map(draftToValueSource),
                        ...(entryContainerSelector.length > 0 ? { entryContainerSelector } : {}),
                        ...(cleanup != null ? { cleanup } : {}),
                        ...(pageFilter.length > 0 ? { pageFilter } : {}),
                    };
                }),
            } : {}),
        };
    });

    const interval = Number.parseInt(draft.scanIntervalMs.trim(), 10);
    return {
        groups,
        ...(draft.scanMode === ScanMode.INTERVAL ? {
            scanMode: ScanMode.INTERVAL,
            ...(Number.isInteger(interval) ? { scanIntervalMs: interval } : {}),
        } : {}),
    };
}

function draftListingCleanup(
    listing: DraftContentManagerListing,
): ContentManagerListingCleanup | undefined {
    if (listing.cleanupMode === "removeNonEntities") {
        return { removeNonEntities: true };
    }

    if (listing.cleanupMode === "removeSelectors") {
        const removeSelectors = splitCsv(listing.cleanupRemoveSelectors);
        if (removeSelectors.length === 0) {
            return undefined;
        }
        return { removeSelectors };
    }

    return undefined;
}

export function draftToValueSource(draft: DraftValueSource): ValueSource {
    const map = draftMap(draft);
    const selectors = splitCsv(draft.selectors);
    const withSelectors = selectors.length > 0 ? { selectors } : {};
    switch (draft.source) {
        case "attribute":
            return {
                source: "attribute",
                attributes: splitCsv(draft.attributes),
                ...withSelectors,
                ...(map != null ? { map } : {}),
            };
        case "srcset":
            return {
                source: "srcset",
                attributes: splitCsv(draft.attributes),
                ...(draft.resolution.trim().length > 0
                    ? { resolution: draft.resolution.trim() }
                    : {}),
                ...withSelectors,
                ...(map != null ? { map } : {}),
            };
        case "query-param":
            return {
                source: "query-param",
                key: draft.key.trim(),
                ...(map != null ? { map } : {}),
            };
        case "path":
            return { source: "path", ...(map != null ? { map } : {}) };
        case "text":
            return { source: "text", ...withSelectors, ...(map != null ? { map } : {}) };
    }
}

function draftMap(draft: DraftValueSource): ValueSource["map"] {
    const mappers: ValueMapper[] = [];
    for (const step of draft.mapSteps) {
        const mapper = draftMapperToValue(step);
        if (mapper != null) {
            mappers.push(mapper);
        }
    }
    return mappers.length > 0 ? mappers : undefined;
}

function draftMapperToValue(step: DraftValueMapper): ValueMapper | undefined {
    switch (step.type) {
        case "extract": {
            const regexes = splitLines(step.regexes);
            if (regexes.length === 0) {
                return undefined;
            }
            const captureGroup = Number.parseInt(step.captureGroup.trim(), 10);
            return {
                type: "extract",
                regexes,
                ...(Number.isInteger(captureGroup) ? { captureGroup } : {}),
            };
        }
        case "replace": {
            const regexes = splitLines(step.regexes);
            if (regexes.length === 0) {
                return undefined;
            }
            return { type: "replace", regexes, replacement: step.replacement };
        }
        case "json_path": {
            const path = step.path.trim();
            if (path.length === 0) {
                return undefined;
            }
            return { type: "json_path", path };
        }
        case "sort": {
            if (step.sortByKind === "area") {
                const width = step.sortAreaWidth.trim();
                const height = step.sortAreaHeight.trim();
                if (width.length === 0 || height.length === 0) {
                    return undefined;
                }
                return {
                    type: "sort",
                    by: { area: { width, height } },
                    ...(step.sortOrder !== "asc" ? { order: step.sortOrder } : {}),
                };
            }
            const sortPath = step.sortPath.trim();
            if (sortPath.length === 0) {
                return undefined;
            }
            return {
                type: "sort",
                by: { path: sortPath },
                ...(step.sortOrder !== "asc" ? { order: step.sortOrder } : {}),
            };
        }
        case "pick":
            return { type: "pick", at: step.pickAt };
    }
}

export function unknownToDraft(raw: unknown): DraftIntegration {
    if (!isPlainObject(raw)) {
        return emptyDraft();
    }

    const contentManager = isPlainObject(raw.contentManager) ? raw.contentManager : undefined;
    return {
        name: typeof raw.name === "string" ? raw.name : "",
        matchedDomains: coerceMatchedDomains(raw.matchedDomains),
        mappedPages: coerceMappedPages(raw.mappedPages),
        contentManagerGroups: coerceContentManagerGroups(contentManager?.groups),
        scanMode: contentManager?.scanMode === ScanMode.INTERVAL
            ? ScanMode.INTERVAL
            : ScanMode.ONLOAD,
        scanIntervalMs: typeof contentManager?.scanIntervalMs === "number"
            || typeof contentManager?.scanIntervalMs === "string"
            ? String(contentManager.scanIntervalMs)
            : "",
        modules: coerceDraftModules(raw.modules),
        ...(isPlainObject(raw.defaults) ? { defaults: structuredClone(raw.defaults) } : {}),
    };
}

function coerceMappedPages(value: unknown): DraftMappedPage[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((entry) => {
        const page = isPlainObject(entry) ? entry : {};
        return {
            name: typeof page.name === "string" ? page.name : "",
            paths: joinCsv(coerceStrings(page.paths)),
        };
    });
}

function coerceContentManagerGroups(value: unknown): DraftContentManagerGroup[] {
    if (!isPlainObject(value)) {
        return [];
    }

    return Object.entries(value).map(([name, rawGroup]) => {
        const group = isPlainObject(rawGroup) ? rawGroup : {};
        return {
            name,
            views: Array.isArray(group.views)
                ? group.views.map(coerceView)
                : [],
            listings: Array.isArray(group.listings)
                ? group.listings.map(coerceListing)
                : [],
        };
    });
}

function coerceView(value: unknown): DraftContentManagerView {
    const view = isPlainObject(value) ? value : {};
    return {
        name: typeof view.name === "string" ? view.name : "",
        selectors: joinCsv(coerceStrings(view.selectors)),
        idSource: coerceValueSourceDraft(view.idSource),
        pageFilter: joinCsv(coerceStrings(view.pageFilter)),
    };
}

function coerceListing(value: unknown): DraftContentManagerListing {
    const listing = isPlainObject(value) ? value : {};
    const cleanup = isPlainObject(listing.cleanup) ? listing.cleanup : undefined;
    let cleanupMode: DraftListingCleanupMode = "none";
    let cleanupRemoveSelectors = "";
    if (cleanup != null) {
        if (cleanup.removeNonEntities === true) {
            cleanupMode = "removeNonEntities";
        } else if (cleanup.removeSelectors != null) {
            cleanupMode = "removeSelectors";
            cleanupRemoveSelectors = joinCsv(coerceStrings(cleanup.removeSelectors));
        }
    }

    return {
        name: typeof listing.name === "string" ? listing.name : "",
        containerSelectors: joinCsv(coerceStrings(listing.containerSelectors)),
        entriesSelectors: joinCsv(coerceStrings(listing.entriesSelectors)),
        entryIdSources: Array.isArray(listing.entryIdSource)
            ? listing.entryIdSource.map(coerceValueSourceDraft)
            : [],
        entryContainerSelector: joinCsv(coerceStrings(listing.entryContainerSelector)),
        cleanupMode,
        cleanupRemoveSelectors,
        pageFilter: joinCsv(coerceStrings(listing.pageFilter)),
    };
}

function coerceValueSourceDraft(value: unknown): DraftValueSource {
    const source = isPlainObject(value) ? value : {};
    const draft = emptyValueSource();
    if (source.source === "attribute"
        || source.source === "text"
        || source.source === "srcset"
        || source.source === "query-param"
        || source.source === "path") {
        draft.source = source.source;
    }
    draft.attributes = joinCsv(coerceStrings(source.attributes));
    draft.key = typeof source.key === "string" ? source.key : "";
    draft.resolution = typeof source.resolution === "string" && source.resolution.trim().length > 0
        ? source.resolution.trim()
        : "high";
    draft.selectors = joinCsv(coerceStrings(source.selectors));

    if (Array.isArray(source.map)) {
        draft.mapSteps = source.map
            .map(coerceMapStepDraft)
            .filter((step): step is DraftValueMapper => step != null);
    }

    return draft;
}

function coerceMapStepDraft(value: unknown): DraftValueMapper | undefined {
    if (!isPlainObject(value) || typeof value.type !== "string") {
        return undefined;
    }

    if (
        value.type !== "extract"
        && value.type !== "replace"
        && value.type !== "json_path"
        && value.type !== "sort"
        && value.type !== "pick"
    ) {
        return undefined;
    }

    const draft = emptyMapStep(value.type);
    draft.regexes = joinLines(coerceStrings(value.regexes));
    draft.captureGroup = value.captureGroup != null ? String(value.captureGroup) : "";
    draft.replacement = typeof value.replacement === "string" ? value.replacement : "";
    draft.path = typeof value.path === "string" ? value.path : "";
    draft.pickAt = value.at === "last" ? "last" : "first";
    draft.sortOrder = value.order === "desc" ? "desc" : "asc";

    if (isPlainObject(value.by)) {
        if (isPlainObject(value.by.area)) {
            draft.sortByKind = "area";
            draft.sortAreaWidth = typeof value.by.area.width === "string" ? value.by.area.width : "";
            draft.sortAreaHeight = typeof value.by.area.height === "string" ? value.by.area.height : "";
        } else if (typeof value.by.path === "string") {
            draft.sortByKind = "path";
            draft.sortPath = value.by.path;
        }
    }

    return draft;
}

function coerceDraftModules(value: unknown): DraftIntegrationModule[] {
    if (!isPlainObject(value)) {
        return [];
    }

    return Object.entries(value).map(([instanceName, rawModule]) => {
        const module = isPlainObject(rawModule) ? rawModule : {};
        const draftModule: DraftIntegrationModule = {
            instanceName,
            originalName: instanceName,
            module: typeof module.module === "string" ? module.module : "",
            optsText: "",
        };
        hydrateModuleOpts(draftModule, isPlainObject(module.opts) ? module.opts : undefined);
        return draftModule;
    });
}

function resolveModuleOpts(
    module: DraftIntegrationModule,
    modulePath: string,
):
    | { ok: true; value: Record<string, unknown> | undefined }
    | { ok: false; issues: IntegrationValidationIssue[] } {
    const form = ModuleOptsFormRegistry.get(module.module.trim());
    if (form != null) {
        const result = form.toOpts(module);
        if (!result.ok) {
            return {
                ok: false,
                issues: result.issues.map((issue) => ({
                    ...issue,
                    path: issue.path.startsWith("modules.")
                        ? issue.path
                        : `${modulePath}.opts${issue.path.length > 0 ? `.${issue.path}` : ""}`,
                })),
            };
        }
        return { ok: true, value: result.value };
    }

    const opts = parseOptsJson(module.optsText);
    if (!opts.ok) {
        return {
            ok: false,
            issues: [{ path: `${modulePath}.opts`, message: opts.message }],
        };
    }
    return { ok: true, value: opts.value };
}

function coerceMatchedDomains(raw: unknown): string {
    if (typeof raw === "string") {
        return raw;
    }
    if (Array.isArray(raw)) {
        return joinCsv(coerceStrings(raw));
    }
    return "";
}

function coerceStrings(value: unknown): string[] {
    if (typeof value === "string") {
        return [value];
    }
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
}

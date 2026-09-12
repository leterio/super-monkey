import { joinCsv, randomString, splitCsv } from "../../../utils/string";
import { isPlainObject } from "../../../utils/type";
import { injectSection } from "../../../utils/ui/ui-builder";
import type { ValueSource } from "../../../utils/value-resolver";
import type {
    DraftAdditionalPagesBinderFields,
    DraftAdditionalPagesGroup,
    DraftAdditionalPagesOpts,
    DraftIntegrationModule,
} from "../draft-mappers";
import {
    draftToValueSource,
    emptyValueSource,
    valueSourceToDraft,
} from "../draft-mappers";
import { mountValueSource } from "../value-source-fields";
import type { ModuleOptsForm, ModuleOptsFormContext } from "./module-opts-form";
import { ModuleOptsFormRegistry } from "./module-opts-form-registry";

const MODULE_KEY = "AdditionalPages";

const additionalPagesOptsForm: ModuleOptsForm = {
    moduleKey: MODULE_KEY,

    hydrate(module, opts) {
        const draft = emptyDraft();
        if (isPlainObject(opts) && isPlainObject(opts.groups)) {
            const groups = Object.entries(opts.groups).map(([name, rawBinder]) => {
                const group = emptyGroupBinder(name);
                if (isPlainObject(rawBinder)) {
                    hydrateContext(group, rawBinder.contextManager);
                    hydratePaging(group, rawBinder.pagingStrategy);
                    hydratePageRequest(group, rawBinder.pageRequestOpts);
                }
                return group;
            });
            if (groups.length > 0) {
                draft.groups = groups;
            }
        }
        module.additionalPagesOpts = draft;
        module.optsText = "";
    },

    mount(ctx) {
        const { module, host, ui, pathPrefix } = ctx;
        ensureDraft(module);
        const draft = module.additionalPagesOpts!;
        const id = `ap-opts-${module.instanceName || "new"}`;
        const groupsSection = injectSection(host, {
            title: "Groups",
            subtitle: "Bind Additional Pages behavior to Content Manager groups.",
            foldable: true,
            folded: false,
            button: {
                label: "Add group",
                onClick: () => {
                    const group = emptyGroupBinder();
                    draft.groups.push(group);
                    ui.focusBlock(
                        groupsSection,
                        mountGroup(groupsSection, group, draft.groups, id, pathPrefix, ui),
                    );
                },
            },
        });
        draft.groups.forEach((group) => {
            mountGroup(groupsSection, group, draft.groups, id, pathPrefix, ui);
        });
    },

    toOpts(module) {
        ensureDraft(module);
        const draft = module.additionalPagesOpts!;
        const groups: Record<string, unknown> = {};
        for (const [index, group] of draft.groups.entries()) {
            const name = group.name.trim();
            if (name.length === 0) {
                return {
                    ok: false,
                    issues: [{
                        path: `groups[${index}]`,
                        message: "Each Additional Pages group needs a Content Manager group name.",
                    }],
                };
            }
            if (Object.hasOwn(groups, name)) {
                return {
                    ok: false,
                    issues: [{
                        path: `groups.${name}`,
                        message: `Duplicate Additional Pages group name: ${name}`,
                    }],
                };
            }

            const pageRequestOpts = buildPageRequestOpts(group);
            groups[name] = {
                contextManager: buildContextManager(group),
                pagingStrategy: buildPagingStrategy(group),
                ...(pageRequestOpts != null ? { pageRequestOpts } : {}),
            };
        }
        return {
            ok: true,
            value: { groups },
        };
    },
};

function groupPath(
    group: DraftAdditionalPagesGroup,
    groups: DraftAdditionalPagesGroup[],
    pathPrefix: string,
): string {
    const name = group.name.trim();
    const index = groups.indexOf(group);
    return name.length > 0 ? `${pathPrefix}.groups.${name}` : `${pathPrefix}.groups[${index}]`;
}

function mountGroup(
    list: HTMLElement,
    group: DraftAdditionalPagesGroup,
    groups: DraftAdditionalPagesGroup[],
    prefix: string,
    pathPrefix: string,
    ui: ModuleOptsFormContext["ui"],
): HTMLElement {
    const indexOf = () => groups.indexOf(group);
    const titleEl = ui.namedBlockHeading("Group", indexOf(), group.name);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(groups, group, section);
        ui.syncNamedListHeadings(
            list,
            groups.map((entry) => entry.name),
            "Group",
        );
    }, true, true, groupPath(group, groups, pathPrefix));
    const fieldsStart = document.createComment("additional-pages-group");
    const fieldsEnd = document.createComment("/additional-pages-group");
    section.append(fieldsStart, fieldsEnd);

    const render = () => {
        const parent = fieldsStart.parentElement;
        if (parent == null || fieldsEnd.parentElement !== parent) {
            return;
        }
        while (fieldsStart.nextSibling !== fieldsEnd) {
            fieldsStart.nextSibling!.remove();
        }
        const staging = document.createElement("div");
        const id = `${prefix}-group-${randomString(8)}`;
        const base = groupPath(group, groups, pathPrefix);
        const nameInputId = `${id}-name`;
        ui.field(staging, nameInputId, "Content Manager group", ui.textInput(
            group.name,
            (value) => {
                group.name = value;
                ui.syncNamedBlockHeading(titleEl, "Group", indexOf(), value);
                ui.setPath(section, groupPath(group, groups, pathPrefix));
                ui.setFieldPath(section, nameInputId, groupPath(group, groups, pathPrefix));
            },
        ), {
            path: base,
            help: "Required. Must match a Content Manager group name.",
        });
        mountFields(staging, group, id, base, ui, render);
        while (staging.firstChild != null) {
            parent.insertBefore(staging.firstChild, fieldsEnd);
        }
    };
    render();
    return section;
}

function mountFields(
    host: HTMLElement,
    draft: DraftAdditionalPagesBinderFields,
    id: string,
    groupPath: string,
    ui: ModuleOptsFormContext["ui"],
    rerender: () => void,
): void {
    ui.field(host, `${id}-context-type`, "Context manager type", ui.select(
        ["dom", "url"],
        draft.contextType,
        (value) => {
            draft.contextType = value as DraftAdditionalPagesBinderFields["contextType"];
            if (value === "url" && draft.pagingType === "next-link") {
                draft.pagingType = "incremental";
            }
            rerender();
        },
        { dom: "DOM paginator", url: "URL only" },
    ), {
        path: `${groupPath}.contextManager.type`,
        help: "How the current page is discovered.",
    });

    ui.field(host, `${id}-paging-type`, "Paging strategy type", ui.select(
        draft.contextType === "url"
            ? ["incremental", "decremental"]
            : ["next-link", "incremental", "decremental"],
        draft.pagingType,
        (value) => {
            draft.pagingType = value as DraftAdditionalPagesBinderFields["pagingType"];
            rerender();
        },
        {
            "next-link": "Next link",
            incremental: "Incremental (numbered)",
            decremental: "Decremental (numbered)",
        },
    ), {
        path: `${groupPath}.pagingStrategy.type`,
        help: "Next link follows the paginator; numbered strategies substitute {{NUMBER}} in the URL template.",
    });

    const contextSection = injectSection(host, {
        title: "Context manager",
        subtitle: draft.contextType === "dom"
            ? "Paginator selectors, decoration, and optional URL template."
            : "URL template used to build additional page addresses.",
        foldable: true,
        folded: true,
    });
    mountContextManagerFields(contextSection, draft, id, groupPath, ui, rerender);

    if (draft.pagingType === "incremental" || draft.pagingType === "decremental") {
        const pagingSection = injectSection(host, {
            title: "Paging strategy",
            subtitle: "Numbering options for incremental and decremental strategies.",
            foldable: true,
            folded: true,
        });
        mountPagingStrategyFields(pagingSection, draft, id, groupPath, ui);
    }

    const pageRequestSection = injectSection(host, {
        title: "Page request",
        subtitle: "Optional HTTP overrides for fetched pages.",
        foldable: true,
        folded: true,
    });
    mountPageRequestFields(pageRequestSection, draft, id, groupPath, ui);
}

function mountContextManagerFields(
    host: HTMLElement,
    draft: DraftAdditionalPagesBinderFields,
    id: string,
    groupPath: string,
    ui: ModuleOptsFormContext["ui"],
    rerender: () => void,
): void {
    const contextPath = `${groupPath}.contextManager`;
    const paginatorPath = `${contextPath}.paginatorSelectors`;
    const urlTemplatePath = `${contextPath}.urlTemplate`;
    if (draft.contextType === "dom") {
        ui.field(host, `${id}-root`, "Root containers", ui.textInput(
            draft.rootContainers,
            (value) => {
                draft.rootContainers = value;
            },
        ), {
            path: `${paginatorPath}.rootContainers`,
            help: "Comma-separated CSS selectors. Required for DOM context.",
        });
        ui.field(host, `${id}-prev`, "Previous selectors", ui.textInput(
            draft.previousSelectors,
            (value) => {
                draft.previousSelectors = value;
            },
        ), {
            path: `${paginatorPath}.previousSelectors`,
            help: "Comma-separated CSS selectors, relative to each root.",
        });
        ui.field(host, `${id}-next`, "Next selectors", ui.textInput(
            draft.nextSelectors,
            (value) => {
                draft.nextSelectors = value;
            },
        ), {
            path: `${paginatorPath}.nextSelectors`,
            help: "Comma-separated CSS selectors. Required for Next link strategy.",
        });
        ui.field(host, `${id}-current`, "Current selectors", ui.textInput(
            draft.currentSelectors,
            (value) => {
                draft.currentSelectors = value;
            },
        ), {
            path: `${paginatorPath}.currentSelectors`,
            help: "Comma-separated CSS selectors. Marks the active page control in the paginator.",
        });
        ui.field(host, `${id}-indexes`, "Page index selectors", ui.textInput(
            draft.pageIndexes,
            (value) => {
                draft.pageIndexes = value;
            },
        ), {
            path: `${paginatorPath}.pageIndexes`,
            help: "Comma-separated CSS selectors. Page-number controls used for numbered strategies and loaded-state classes.",
        });
        ui.field(host, `${id}-url-attrs`, "URL attributes", ui.textInput(
            draft.urlAttributes,
            (value) => {
                draft.urlAttributes = value;
            },
        ), {
            path: `${paginatorPath}.urlAttributes`,
            help: "Comma-separated attribute names, tried before href when reading page URLs.",
        });
        ui.field(host, `${id}-index-immediate`, "Page index use immediate parent", ui.select(
            ["false", "true"],
            draft.pageIndexUseImmediateParent,
            (value) => {
                draft.pageIndexUseImmediateParent =
                    value as DraftAdditionalPagesBinderFields["pageIndexUseImmediateParent"];
            },
            { false: "No", true: "Yes" },
        ), {
            path: `${paginatorPath}.pageIndexDecoration.useImmediateParent`,
            help: "When Yes, apply status/classes on the page-index match's parent. Wins over Closest selectors.",
        });
        ui.field(host, `${id}-index-closest`, "Page index closest selectors", ui.textInput(
            draft.pageIndexClosestSelectors,
            (value) => {
                draft.pageIndexClosestSelectors = value;
            },
        ), {
            path: `${paginatorPath}.pageIndexDecoration.closestSelectors`,
            help: "Comma-separated CSS selectors for element.closest from each page-index match. First match wins.",
        });
        ui.field(host, `${id}-loaded-class`, "Loaded page class names", ui.textInput(
            draft.pageIndexLoadedPageClassNames,
            (value) => {
                draft.pageIndexLoadedPageClassNames = value;
            },
        ), {
            path: `${paginatorPath}.pageIndexDecoration.loadedPageClassNames`,
            help: "Comma-separated class names, applied to the page-index decoration target after load.",
        });
        ui.field(host, `${id}-ignore-last`, "Ignore last page", ui.select(
            ["false", "true"],
            draft.ignoreLastPage,
            (value) => {
                draft.ignoreLastPage = value as DraftAdditionalPagesBinderFields["ignoreLastPage"];
            },
            { false: "No", true: "Yes" },
        ), {
            path: `${contextPath}.ignoreLastPage`,
            help: "When Yes, skips treating the last paginator control as a loadable page.",
        });
    }

    if (draft.pagingType !== "next-link" || draft.contextType === "url") {
        ui.field(host, `${id}-url-kind`, "URL template kind", ui.select(
            ["static", "source"],
            draft.urlTemplateKind,
            (value) => {
                draft.urlTemplateKind =
                    value as DraftAdditionalPagesBinderFields["urlTemplateKind"];
                rerender();
            },
            { static: "Static template", source: "Value source" },
        ), {
            path: urlTemplatePath,
            help: "Static path/URL with {{NUMBER}}, or resolve a template string from the page.",
        });

        if (draft.urlTemplateKind === "static") {
            ui.field(host, `${id}-url-template`, "URL template", ui.textInput(
                draft.urlTemplate,
                (value) => {
                    draft.urlTemplate = value;
                },
            ), {
                path: urlTemplatePath,
                help: "Path or absolute URL containing {{NUMBER}}.",
            });
        } else {
            const sourceSection = injectSection(host, {
                title: "URL template source",
                subtitle: "Resolved string must include {{NUMBER}}. Same controls as Content Manager Value Source.",
                foldable: true,
                folded: false,
            });
            mountValueSource(
                sourceSection,
                draft.urlTemplateSource,
                `${id}-url-source`,
                ui,
                { pathPrefix: `${urlTemplatePath}.source` },
            );
        }

        ui.field(host, `${id}-copy-query`, "Copy page query params", ui.select(
            ["true", "false"],
            draft.copyPageQueryParams,
            (value) => {
                draft.copyPageQueryParams =
                    value as DraftAdditionalPagesBinderFields["copyPageQueryParams"];
            },
            { true: "Yes", false: "No" },
        ), {
            path: `${urlTemplatePath}.copyPageQueryParams`,
            help: "When Yes (default), copies the current tab query string onto built page URLs.",
        });
    }
}

function mountPagingStrategyFields(
    host: HTMLElement,
    draft: DraftAdditionalPagesBinderFields,
    id: string,
    groupPath: string,
    ui: ModuleOptsFormContext["ui"],
): void {
    const pagingPath = `${groupPath}.pagingStrategy`;
    ui.field(host, `${id}-num-zero`, "Numbering starts from zero", ui.select(
        ["false", "true"],
        draft.numberingStartsFromZero,
        (value) => {
            draft.numberingStartsFromZero =
                value as DraftAdditionalPagesBinderFields["numberingStartsFromZero"];
        },
        { false: "No", true: "Yes" },
    ), {
        path: `${pagingPath}.numberingStartsFromZero`,
        help: "When Yes, {{NUMBER}} in built URLs starts at 0. Default No starts at 1.",
    });
    ui.field(host, `${id}-label-zero`, "Label numbering starts from zero", ui.select(
        ["false", "true"],
        draft.numberingLabelStartsFromZero,
        (value) => {
            draft.numberingLabelStartsFromZero =
                value as DraftAdditionalPagesBinderFields["numberingLabelStartsFromZero"];
        },
        { false: "No", true: "Yes" },
    ), {
        path: `${pagingPath}.numberingLabelStartsFromZero`,
        help: "When Yes, progress UI labels use zero-based numbers. Defaults to Numbering starts from zero.",
    });
}

function mountPageRequestFields(
    host: HTMLElement,
    draft: DraftAdditionalPagesBinderFields,
    id: string,
    groupPath: string,
    ui: ModuleOptsFormContext["ui"],
): void {
    const requestPath = `${groupPath}.pageRequestOpts`;
    ui.field(host, `${id}-method`, "Page request method", ui.textInput(
        draft.pageRequestMethod,
        (value) => {
            draft.pageRequestMethod = value;
        },
    ), {
        path: `${requestPath}.method`,
        help: "Optional HTTP method override (for example GET).",
    });
    ui.field(host, `${id}-headers`, "Page request headers (JSON)", ui.textarea(
        draft.pageRequestHeadersJson,
        (value) => {
            draft.pageRequestHeadersJson = value;
        },
    ), {
        path: `${requestPath}.headers`,
        help: "Optional JSON object of string headers.",
        column: true,
    });
}

function hydrateContext(draft: DraftAdditionalPagesBinderFields, raw: unknown): void {
    if (!isPlainObject(raw)) {
        return;
    }
    if (raw.type === "url") {
        draft.contextType = "url";
        hydrateUrlTemplate(draft, raw.urlTemplate);
        return;
    }
    draft.contextType = "dom";
    draft.ignoreLastPage = raw.ignoreLastPage === true ? "true" : "false";
    hydrateUrlTemplate(draft, raw.urlTemplate);
    if (isPlainObject(raw.paginatorSelectors)) {
        const selectors = raw.paginatorSelectors;
        draft.rootContainers = stringListToCsv(selectors.rootContainers);
        draft.previousSelectors = stringListToCsv(selectors.previousSelectors);
        draft.nextSelectors = stringListToCsv(selectors.nextSelectors);
        draft.currentSelectors = stringListToCsv(selectors.currentSelectors);
        draft.pageIndexes = stringListToCsv(selectors.pageIndexes);
        draft.urlAttributes = stringListToCsv(selectors.urlAttributes);
        hydratePageIndexDecoration(draft, selectors);
    }
}

function hydratePageIndexDecoration(
    draft: DraftAdditionalPagesBinderFields,
    selectors: Record<string, unknown>,
): void {
    draft.pageIndexUseImmediateParent = "false";
    draft.pageIndexClosestSelectors = "";
    draft.pageIndexLoadedPageClassNames = "";

    if (isPlainObject(selectors.pageIndexDecoration)) {
        const decoration = selectors.pageIndexDecoration;
        draft.pageIndexUseImmediateParent =
            decoration.useImmediateParent === true ? "true" : "false";
        draft.pageIndexClosestSelectors = stringListToCsv(decoration.closestSelectors);
        draft.pageIndexLoadedPageClassNames = stringListToCsv(decoration.loadedPageClassNames);
    }

    if (
        draft.pageIndexLoadedPageClassNames.length === 0
        && selectors.loadedPageClassNames != null
    ) {
        draft.pageIndexLoadedPageClassNames = stringListToCsv(selectors.loadedPageClassNames);
    }
}

function hydrateUrlTemplate(draft: DraftAdditionalPagesBinderFields, raw: unknown): void {
    if (typeof raw === "string") {
        draft.urlTemplateKind = "static";
        draft.urlTemplate = raw;
        draft.copyPageQueryParams = "true";
        draft.urlTemplateSource = emptyValueSource();
        return;
    }
    if (!isPlainObject(raw)) {
        return;
    }
    draft.copyPageQueryParams = raw.copyPageQueryParams === false ? "false" : "true";
    if (typeof raw.template === "string") {
        draft.urlTemplateKind = "static";
        draft.urlTemplate = raw.template;
        draft.urlTemplateSource = emptyValueSource();
        return;
    }
    if (raw.source != null && isPlainObject(raw.source)) {
        draft.urlTemplateKind = "source";
        draft.urlTemplate = "";
        draft.urlTemplateSource = valueSourceToDraft(raw.source as ValueSource);
    }
}

function hydratePaging(draft: DraftAdditionalPagesBinderFields, raw: unknown): void {
    if (!isPlainObject(raw) || typeof raw.type !== "string") {
        return;
    }
    if (raw.type === "next-link" || raw.type === "incremental" || raw.type === "decremental") {
        draft.pagingType = raw.type;
    }
    draft.numberingStartsFromZero = raw.numberingStartsFromZero === true ? "true" : "false";
    if (raw.numberingLabelStartsFromZero === true) {
        draft.numberingLabelStartsFromZero = "true";
    } else if (raw.numberingLabelStartsFromZero === false) {
        draft.numberingLabelStartsFromZero = "false";
    } else {
        draft.numberingLabelStartsFromZero = draft.numberingStartsFromZero;
    }
}

function hydratePageRequest(draft: DraftAdditionalPagesBinderFields, raw: unknown): void {
    if (!isPlainObject(raw)) {
        return;
    }
    if (typeof raw.method === "string") {
        draft.pageRequestMethod = raw.method;
    }
    if (isPlainObject(raw.headers)) {
        draft.pageRequestHeadersJson = JSON.stringify(raw.headers, null, 2);
    }
}

function buildContextManager(draft: DraftAdditionalPagesBinderFields): Record<string, unknown> {
    const urlTemplate = buildUrlTemplate(draft);
    if (draft.contextType === "url") {
        return {
            type: "url",
            ...(urlTemplate != null ? { urlTemplate } : {}),
        };
    }

    const rootContainers = splitCsv(draft.rootContainers);
    const previousSelectors = splitCsv(draft.previousSelectors);
    const nextSelectors = splitCsv(draft.nextSelectors);
    const currentSelectors = splitCsv(draft.currentSelectors);
    const pageIndexes = splitCsv(draft.pageIndexes);
    const urlAttributes = splitCsv(draft.urlAttributes);
    const pageIndexDecoration = buildPageIndexDecoration(draft);

    return {
        type: "dom",
        paginatorSelectors: {
            rootContainers,
            ...(previousSelectors.length > 0 ? { previousSelectors } : {}),
            ...(nextSelectors.length > 0 ? { nextSelectors } : {}),
            ...(currentSelectors.length > 0 ? { currentSelectors } : {}),
            ...(pageIndexes.length > 0 ? { pageIndexes } : {}),
            ...(urlAttributes.length > 0 ? { urlAttributes } : {}),
            ...(pageIndexDecoration != null ? { pageIndexDecoration } : {}),
        },
        ...(urlTemplate != null ? { urlTemplate } : {}),
        ignoreLastPage: draft.ignoreLastPage === "true",
    };
}

function buildPageIndexDecoration(
    draft: DraftAdditionalPagesBinderFields,
): Record<string, unknown> | undefined {
    const useImmediateParent = draft.pageIndexUseImmediateParent === "true";
    const closestSelectors = splitCsv(draft.pageIndexClosestSelectors);
    const loadedPageClassNames = splitCsv(draft.pageIndexLoadedPageClassNames);

    if (
        !useImmediateParent
        && closestSelectors.length === 0
        && loadedPageClassNames.length === 0
    ) {
        return undefined;
    }

    return {
        ...(useImmediateParent ? { useImmediateParent: true } : {}),
        ...(!useImmediateParent && closestSelectors.length > 0 ? { closestSelectors } : {}),
        ...(loadedPageClassNames.length > 0 ? { loadedPageClassNames } : {}),
    };
}

function buildUrlTemplate(draft: DraftAdditionalPagesBinderFields): unknown {
    const copyPageQueryParams = draft.copyPageQueryParams === "true";

    if (draft.urlTemplateKind === "source") {
        return {
            source: draftToValueSource(draft.urlTemplateSource),
            copyPageQueryParams,
        };
    }

    const template = draft.urlTemplate.trim();
    if (template.length === 0) {
        return undefined;
    }
    // Default copyPageQueryParams is true — keep the string shorthand.
    if (copyPageQueryParams) {
        return template;
    }
    return {
        template,
        copyPageQueryParams: false,
    };
}

function buildPagingStrategy(draft: DraftAdditionalPagesBinderFields): Record<string, unknown> {
    if (draft.pagingType === "next-link") {
        return { type: "next-link" };
    }
    return {
        type: draft.pagingType,
        numberingStartsFromZero: draft.numberingStartsFromZero === "true",
        numberingLabelStartsFromZero: draft.numberingLabelStartsFromZero === "true",
    };
}

function buildPageRequestOpts(
    draft: DraftAdditionalPagesBinderFields,
): Record<string, unknown> | undefined {
    const method = draft.pageRequestMethod.trim();
    let headers: Record<string, string> | undefined;
    const headersText = draft.pageRequestHeadersJson.trim();
    if (headersText.length > 0) {
        try {
            const parsed: unknown = JSON.parse(headersText);
            if (isPlainObject(parsed)) {
                const cleaned: Record<string, string> = {};
                for (const [key, value] of Object.entries(parsed)) {
                    if (typeof value === "string") {
                        cleaned[key] = value;
                    }
                }
                if (Object.keys(cleaned).length > 0) {
                    headers = cleaned;
                }
            }
        } catch {
            // Leave invalid headers out; normalization/validation catches incomplete opts.
        }
    }
    if (method.length === 0 && headers == null) {
        return undefined;
    }
    return {
        ...(method.length > 0 ? { method } : {}),
        ...(headers != null ? { headers } : {}),
    };
}

function stringListToCsv(raw: unknown): string {
    if (!Array.isArray(raw)) {
        return "";
    }
    return joinCsv(raw.filter((entry): entry is string => typeof entry === "string"));
}

function emptyDraft(): DraftAdditionalPagesOpts {
    return { groups: [emptyGroupBinder()] };
}

function emptyGroupBinder(name = ""): DraftAdditionalPagesGroup {
    return {
        name,
        contextType: "dom",
        pagingType: "next-link",
        ignoreLastPage: "false",
        urlTemplateKind: "static",
        urlTemplate: "",
        urlTemplateSource: emptyValueSource(),
        copyPageQueryParams: "true",
        rootContainers: "",
        previousSelectors: "",
        nextSelectors: "",
        currentSelectors: "",
        pageIndexes: "",
        urlAttributes: "",
        pageIndexUseImmediateParent: "false",
        pageIndexClosestSelectors: "",
        pageIndexLoadedPageClassNames: "",
        numberingStartsFromZero: "false",
        numberingLabelStartsFromZero: "false",
        pageRequestMethod: "",
        pageRequestHeadersJson: "",
    };
}

function ensureDraft(module: DraftIntegrationModule): void {
    if (module.additionalPagesOpts == null) {
        module.additionalPagesOpts = emptyDraft();
    }
}

ModuleOptsFormRegistry.register(additionalPagesOptsForm);

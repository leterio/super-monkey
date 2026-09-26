import { joinCsv, joinLines, randomString, splitCsv, splitLines } from "../../../utils/string";
import { isPlainObject } from "../../../utils/type";
import { injectSection } from "../../../utils/ui/ui-builder";
import type { IntegrationValidationIssue } from "../../integration-validation";
import type { ValueSource } from "../../../utils/value-resolver";
import type {
    DraftIntegrationModule,
    DraftRdDecoration,
    DraftRdDownloadMode,
    DraftRdDownloadStep,
    DraftRdMapping,
    DraftRdUrlSource,
} from "../draft-mappers";
import {
    draftToValueSource,
    emptyValueSource,
    valueSourceToDraft,
} from "../draft-mappers";
import type { EditorUiHelpers } from "../editor-ui-helpers";
import { mountValueSource, mountValueSourceMapSteps } from "../value-source-fields";
import type { ModuleOptsForm } from "./module-opts-form";
import { ModuleOptsFormRegistry } from "./module-opts-form-registry";

const MODULE_KEY = "ResourcesDownloader";

const resourcesDownloaderOptsForm: ModuleOptsForm = {
    moduleKey: MODULE_KEY,

    hydrate(module, opts) {
        module.resourcesDownloaderOpts = {
            mappings: isPlainObject(opts) && isPlainObject(opts.mappings)
                ? Object.entries(opts.mappings).map(([key, raw]) => mappingToDraft(key, raw))
                : [],
            downloadModes: isPlainObject(opts) && Array.isArray(opts.downloadModes)
                ? opts.downloadModes
                    .map(downloadModeToDraft)
                    .filter((mode): mode is DraftRdDownloadMode => mode != null)
                : [],
        };
        module.optsText = "";
    },

    mount(ctx) {
        const { module, host, ui, pathPrefix } = ctx;
        ensureDraft(module);
        const draft = module.resourcesDownloaderOpts!;

        const mappingsSection = injectSection(host, {
            title: "Mappings",
            subtitle: "Leaf and collection mappings scanned inside Content Manager entries.",
            foldable: true,
            folded: false,
            button: {
                label: "Add mapping",
                onClick: () => {
                    const mapping = emptyMapping();
                    draft.mappings.push(mapping);
                    ui.focusBlock(
                        mappingsSection,
                        mountMapping(mappingsSection, mapping, draft.mappings, pathPrefix, ui),
                    );
                },
            },
        });
        draft.mappings.forEach((mapping) => {
            mountMapping(mappingsSection, mapping, draft.mappings, pathPrefix, ui);
        });

        const modesSection = injectSection(host, {
            title: "Download modes",
            subtitle: "Optional custom pipelines. Built-in mode \"download\" is always available.",
            foldable: true,
            folded: draft.downloadModes.length === 0,
            button: {
                label: "Add mode",
                onClick: () => {
                    const mode = emptyDownloadMode();
                    draft.downloadModes.push(mode);
                    ui.focusBlock(
                        modesSection,
                        mountDownloadMode(modesSection, mode, draft.downloadModes, pathPrefix, ui),
                    );
                },
            },
        });
        draft.downloadModes.forEach((mode) => {
            mountDownloadMode(modesSection, mode, draft.downloadModes, pathPrefix, ui);
        });
    },

    toOpts(module) {
        ensureDraft(module);
        const draft = module.resourcesDownloaderOpts!;
        const issues: IntegrationValidationIssue[] = [];
        const mappings: Record<string, unknown> = {};

        draft.mappings.forEach((mapping, index) => {
            if (isEmptyMapping(mapping)) {
                return;
            }
            const key = mapping.key.trim();
            const mappingPath = key.length > 0 ? `mappings.${key}` : `mappings[${index}]`;
            if (key.length === 0) {
                issues.push({ path: mappingPath, message: "Mapping key is required." });
                return;
            }
            if (Object.hasOwn(mappings, key)) {
                issues.push({ path: mappingPath, message: `Duplicate mapping key: ${key}` });
                return;
            }
            const built = draftMappingToOpts(mapping);
            if (built == null) {
                issues.push({ path: mappingPath, message: "Mapping is incomplete." });
                return;
            }
            mappings[key] = built;
        });

        const downloadModes: Record<string, unknown>[] = [];
        draft.downloadModes.forEach((mode, index) => {
            if (isEmptyDownloadMode(mode)) {
                return;
            }
            const modePath = `downloadModes[${index}]`;
            const built = draftDownloadModeToOpts(mode);
            if (built == null) {
                issues.push({ path: modePath, message: "Download mode is incomplete." });
                return;
            }
            downloadModes.push(built);
        });

        if (issues.length > 0) {
            return { ok: false, issues };
        }

        return {
            ok: true,
            value: {
                mappings,
                ...(downloadModes.length > 0 ? { downloadModes } : {}),
            },
        };
    },
};

function mappingPath(
    mapping: DraftRdMapping,
    mappings: DraftRdMapping[],
    pathPrefix: string,
): string {
    const key = mapping.key.trim();
    const index = mappings.indexOf(mapping);
    return key.length > 0 ? `${pathPrefix}.mappings.${key}` : `${pathPrefix}.mappings[${index}]`;
}

function mountMapping(
    list: HTMLElement,
    mapping: DraftRdMapping,
    mappings: DraftRdMapping[],
    pathPrefix: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => mappings.indexOf(mapping);
    const titleEl = ui.namedBlockHeading("Mapping", indexOf(), mapping.key);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(mappings, mapping, section);
        ui.syncNamedListHeadings(
            list,
            mappings.map((entry) => entry.key),
            "Mapping",
        );
    }, true, true, mappingPath(mapping, mappings, pathPrefix));
    const id = `rd-mapping-${randomString(8)}`;
    const fieldsStart = document.createComment("rd-mapping-fields");
    const fieldsEnd = document.createComment("/rd-mapping-fields");
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
        mountMappingFields(
            staging,
            mapping,
            id,
            mappingPath(mapping, mappings, pathPrefix),
            ui,
            titleEl,
            indexOf,
            render,
        );
        while (staging.firstChild != null) {
            parent.insertBefore(staging.firstChild, fieldsEnd);
        }
    };
    render();
    return section;
}

function mountMappingFields(
    host: HTMLElement,
    mapping: DraftRdMapping,
    id: string,
    basePath: string,
    ui: EditorUiHelpers,
    titleEl: HTMLHeadingElement,
    indexOf: () => number,
    rerender: () => void,
): void {
    const keyInputId = `${id}-key`;
    ui.field(host, keyInputId, "Key", ui.textInput(mapping.key, (value) => {
        mapping.key = value;
        ui.syncNamedBlockHeading(titleEl, "Mapping", indexOf(), value);
    }), {
        path: `${basePath}.key`,
        help: "Unique mapping key within this module instance.",
    });
    ui.field(host, `${id}-type`, "Type", ui.select(
        ["leaf", "collection"],
        mapping.type,
        (value) => {
            mapping.type = value as DraftRdMapping["type"];
            rerender();
        },
        { leaf: "Leaf", collection: "Collection" },
    ), {
        path: `${basePath}.type`,
        help: "Leaf resolves a download URL; Collection scans nested mapping keys.",
    });
    ui.field(host, `${id}-selectors`, "Selectors", ui.textInput(
        mapping.selectors,
        (value) => {
            mapping.selectors = value;
        },
    ), {
        path: `${basePath}.selectors`,
        help: "Comma-separated CSS selectors. Matched elements for this mapping.",
    });
    ui.field(host, `${id}-page-filter`, "Page filter", ui.textInput(
        mapping.pageFilter,
        (value) => {
            mapping.pageFilter = value;
        },
    ), {
        path: `${basePath}.pageFilter`,
        help: "Optional. Comma-separated mapped page names. Prefix exclusions with !!. Empty = all pages.",
    });
    ui.field(host, `${id}-ignore-decoration`, "Ignore decoration", ui.select(
        ["false", "true"],
        mapping.ignoreDecoration,
        (value) => {
            mapping.ignoreDecoration = value as DraftRdMapping["ignoreDecoration"];
        },
        { false: "No", true: "Yes" },
    ), {
        path: `${basePath}.ignoreDecoration`,
        help: "When Yes, skip attaching a download control for this mapping.",
    });

    if (mapping.type === "leaf") {
        ui.field(host, `${id}-download-mode`, "Download mode", ui.textInput(
            mapping.downloadMode,
            (value) => {
                mapping.downloadMode = value;
            },
        ), {
            path: `${basePath}.downloadMode`,
            help: "Mode name. Empty uses built-in \"download\".",
        });
    }

    mountDecorationFields(host, mapping.decoration, `${id}-decoration`, `${basePath}.decoration`, ui);

    if (mapping.type === "leaf") {
        const sourcesSection = injectSection(host, {
            title: "URL sources",
            subtitle: "Tried in order; first non-empty value on the live element wins.",
            foldable: true,
            folded: false,
            button: {
                label: "Add URL source",
                onClick: () => {
                    const source = emptyUrlSource();
                    mapping.urlSources.push(source);
                    ui.focusBlock(
                        sourcesSection,
                        mountUrlSource(
                            sourcesSection,
                            source,
                            mapping.urlSources,
                            `${basePath}.urlSources`,
                            ui,
                        ),
                    );
                },
            },
        });
        mapping.urlSources.forEach((source) => {
            mountUrlSource(sourcesSection, source, mapping.urlSources, `${basePath}.urlSources`, ui);
        });
    } else {
        ui.field(host, `${id}-children`, "Children", ui.textarea(
            mapping.children,
            (value) => {
                mapping.children = value;
            },
        ), {
            path: `${basePath}.children`,
            help: "One mapping key per line to scan inside each matched container.",
            column: true,
        });
    }
}

function mountDecorationFields(
    host: HTMLElement,
    decoration: DraftRdDecoration,
    id: string,
    basePath: string,
    ui: EditorUiHelpers,
): void {
    const section = injectSection(host, {
        title: "Decoration",
        subtitle: "Optional download-button placement. Empty fields are omitted on Save.",
        foldable: true,
        folded: true,
    });
    ui.field(section, `${id}-wrap`, "Wrap element", ui.select(
        ["false", "true"],
        decoration.wrapElement,
        (value) => {
            decoration.wrapElement = value as DraftRdDecoration["wrapElement"];
        },
        { false: "No", true: "Yes" },
    ), {
        path: `${basePath}.wrapElement`,
        help: "When Yes, wrap the target in a container before attaching the button.",
    });
    ui.field(section, `${id}-wrap-classes`, "Wrap classes", ui.textarea(
        decoration.wrapClasses,
        (value) => {
            decoration.wrapClasses = value;
        },
    ), {
        path: `${basePath}.wrapClasses`,
        help: "One class name per line. Applied to the wrap before copied or built-in classes.",
        column: true,
    });
    ui.field(section, `${id}-wrap-copy`, "Wrap copy element classes", ui.select(
        ["false", "true"],
        decoration.wrapCopyElementClasses,
        (value) => {
            decoration.wrapCopyElementClasses = value as DraftRdDecoration["wrapCopyElementClasses"];
        },
        { false: "No", true: "Yes" },
    ), {
        path: `${basePath}.wrapCopyElementClasses`,
        help: "When Yes, copy the target's classes onto the wrap.",
    });
    ui.field(section, `${id}-immediate`, "Use immediate parent", ui.select(
        ["false", "true"],
        decoration.useImmediateParent,
        (value) => {
            decoration.useImmediateParent = value as DraftRdDecoration["useImmediateParent"];
        },
        { false: "No", true: "Yes" },
    ), {
        path: `${basePath}.useImmediateParent`,
        help: "When Yes, decorate the target's parent. Wins over Closest selectors.",
    });
    ui.field(section, `${id}-closest`, "Closest selectors", ui.textInput(
        decoration.closestSelectors,
        (value) => {
            decoration.closestSelectors = value;
        },
    ), {
        path: `${basePath}.closestSelectors`,
        help: "Comma-separated CSS selectors for element.closest. First match wins.",
    });
    ui.field(section, `${id}-override-pos`, "Override position", ui.select(
        ["false", "true"],
        decoration.overridePosition,
        (value) => {
            decoration.overridePosition = value as DraftRdDecoration["overridePosition"];
        },
        { false: "No", true: "Yes" },
    ), {
        path: `${basePath}.overridePosition`,
        help: "When Yes, set position: relative on the decoration container.",
    });
}

function mountUrlSource(
    list: HTMLElement,
    source: DraftRdUrlSource,
    sources: DraftRdUrlSource[],
    sourcesPath: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => sources.indexOf(source);
    const sourcePath = () => `${sourcesPath}[${indexOf()}]`;
    const label = source.kind === "attribute"
        ? (source.attribute.trim() || "attribute")
        : "value source";
    const titleEl = ui.namedBlockHeading("URL source", indexOf(), label);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(sources, source, section);
        ui.syncNamedListHeadings(
            list,
            sources.map((entry) => entry.kind === "attribute"
                ? (entry.attribute.trim() || "attribute")
                : "value source"),
            "URL source",
        );
    }, true, true, sourcePath());
    const id = `rd-url-source-${randomString(8)}`;
    const fieldsStart = document.createComment("rd-url-source-fields");
    const fieldsEnd = document.createComment("/rd-url-source-fields");
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
        const base = sourcePath();
        ui.field(staging, `${id}-kind`, "Kind", ui.select(
            ["attribute", "value-source"],
            source.kind,
            (value) => {
                source.kind = value as DraftRdUrlSource["kind"];
                ui.syncNamedBlockHeading(
                    titleEl,
                    "URL source",
                    indexOf(),
                    value === "attribute"
                        ? (source.attribute.trim() || "attribute")
                        : "value source",
                );
                render();
            },
            { attribute: "Attribute name", "value-source": "Value source" },
        ), {
            path: base,
            help: "",
        });
        if (source.kind === "attribute") {
            ui.field(staging, `${id}-attr`, "Attribute", ui.textInput(
                source.attribute,
                (value) => {
                    source.attribute = value;
                    ui.syncNamedBlockHeading(
                        titleEl,
                        "URL source",
                        indexOf(),
                        value.trim() || "attribute",
                    );
                },
            ), {
                path: base,
                help: "Attribute name on the matched element (for example src).",
            });
        } else {
            mountValueSource(staging, source.valueSource, `${id}-vs`, ui, { pathPrefix: base });
        }
        while (staging.firstChild != null) {
            parent.insertBefore(staging.firstChild, fieldsEnd);
        }
    };
    render();
    return section;
}

function mountDownloadMode(
    list: HTMLElement,
    mode: DraftRdDownloadMode,
    modes: DraftRdDownloadMode[],
    pathPrefix: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => modes.indexOf(mode);
    const modePath = () => `${pathPrefix}.downloadModes[${indexOf()}]`;
    const titleEl = ui.namedBlockHeading("Mode", indexOf(), mode.name);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(modes, mode, section);
        ui.syncNamedListHeadings(
            list,
            modes.map((entry) => entry.name),
            "Mode",
        );
    }, true, true, modePath());
    const id = `rd-mode-${randomString(8)}`;
    const nameInputId = `${id}-name`;
    ui.field(section, nameInputId, "Name", ui.textInput(mode.name, (value) => {
        mode.name = value;
        ui.syncNamedBlockHeading(titleEl, "Mode", indexOf(), value);
        ui.setPath(section, modePath());
        ui.setFieldPath(section, nameInputId, `${modePath()}.name`);
    }), {
        path: `${modePath()}.name`,
        help: "Referenced by leaf downloadMode. Must not be \"download\".",
    });

    const stepsSection = injectSection(section, {
        title: "Steps",
        subtitle: "Last step must be download. Document steps may fetch before the final save.",
        foldable: true,
        folded: false,
        button: {
            label: "Add step",
            onClick: () => {
                const step = emptyDownloadStep("document");
                mode.steps.push(step);
                ui.focusBlock(
                    stepsSection,
                    mountDownloadStep(stepsSection, step, mode.steps, modePath, ui),
                );
            },
        },
    });
    mode.steps.forEach((step) => mountDownloadStep(stepsSection, step, mode.steps, modePath, ui));
    return section;
}

function mountDownloadStep(
    list: HTMLElement,
    step: DraftRdDownloadStep,
    steps: DraftRdDownloadStep[],
    modePath: () => string,
    ui: EditorUiHelpers,
): HTMLElement {
    const stepIndex = () => steps.indexOf(step);
    const stepPath = () => `${modePath()}.steps[${stepIndex()}]`;
    const section = ui.removableSection(
        list,
        "Step",
        () => ui.remove(steps, step, section),
        true,
        true,
        stepPath(),
    );
    const id = `rd-step-${randomString(8)}`;
    const fieldsStart = document.createComment("rd-step-fields");
    const fieldsEnd = document.createComment("/rd-step-fields");
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
        const base = stepPath();
        ui.field(staging, `${id}-mode`, "Step mode", ui.select(
            ["document", "download"],
            step.mode,
            (value) => {
                step.mode = value as DraftRdDownloadStep["mode"];
                render();
            },
            { document: "Document", download: "Download" },
        ), {
            path: `${base}.mode`,
            help: "Document fetches and resolves a value; Download saves the final resource. Last step must be Download.",
        });
        if (step.mode === "document") {
            mountValueSource(staging, step.valueSource, `${id}-vs`, ui, {
                elementSourcesOnly: true,
                omitMapSteps: true,
                pathPrefix: `${base}.valueSource`,
            });
            ui.field(staging, `${id}-method`, "Method", ui.textInput(step.method, (value) => {
                step.method = value;
            }), {
                path: `${base}.method`,
                help: "Optional HTTP method for the document request (for example GET or POST).",
            });
        }
        ui.field(staging, `${id}-headers`, "Headers (JSON)", ui.textarea(
            step.headersJson,
            (value) => {
                step.headersJson = value;
            },
        ), {
            path: `${base}.headers`,
            help: "Optional JSON object of string headers.",
            column: true,
        });
        ui.field(staging, `${id}-timeout`, "Timeout (ms)", ui.textInput(
            step.timeout,
            (value) => {
                step.timeout = value;
            },
        ), {
            path: `${base}.timeout`,
            help: "Optional request timeout in milliseconds.",
        });
        if (step.mode === "document") {
            ui.field(staging, `${id}-data`, "Data (JSON)", ui.textarea(
                step.dataJson,
                (value) => {
                    step.dataJson = value;
                },
            ), {
                path: `${base}.data`,
                help: "Optional string or object of string/ValueSource fields for the request body.",
                column: true,
            });
            mountValueSourceMapSteps(staging, step.valueSource, `${id}-vs`, ui, `${base}.valueSource`);
        }
        ui.setPath(section, base);
        while (staging.firstChild != null) {
            parent.insertBefore(staging.firstChild, fieldsEnd);
        }
    };
    render();
    return section;
}

function mappingToDraft(key: string, raw: unknown): DraftRdMapping {
    const draft = emptyMapping();
    draft.key = key;
    if (!isPlainObject(raw)) {
        return draft;
    }
    draft.type = raw.type === "collection" ? "collection" : "leaf";
    draft.selectors = Array.isArray(raw.selectors)
        ? joinCsv(raw.selectors.filter((entry): entry is string => typeof entry === "string"))
        : "";
    draft.pageFilter = Array.isArray(raw.pageFilter)
        ? joinCsv(raw.pageFilter.filter((entry): entry is string => typeof entry === "string"))
        : "";
    draft.ignoreDecoration = raw.ignoreDecoration === true ? "true" : "false";
    draft.decoration = decorationToDraft(raw.decoration);
    draft.downloadMode = typeof raw.downloadMode === "string" ? raw.downloadMode : "";
    draft.children = Array.isArray(raw.children)
        ? joinLines(raw.children.filter((entry): entry is string => typeof entry === "string"))
        : "";
    draft.urlSources = Array.isArray(raw.urlSources)
        ? raw.urlSources.map(urlSourceToDraft).filter((entry): entry is DraftRdUrlSource => entry != null)
        : [];
    return draft;
}

function decorationToDraft(raw: unknown): DraftRdDecoration {
    const draft = emptyDecoration();
    if (!isPlainObject(raw)) {
        return draft;
    }
    draft.wrapElement = raw.wrapElement === true ? "true" : "false";
    draft.wrapCopyElementClasses = raw.wrapCopyElementClasses === true ? "true" : "false";
    draft.useImmediateParent = raw.useImmediateParent === true ? "true" : "false";
    draft.overridePosition = raw.overridePosition === true ? "true" : "false";
    draft.wrapClasses = Array.isArray(raw.wrapClasses)
        ? joinLines(raw.wrapClasses.filter((entry): entry is string => typeof entry === "string"))
        : "";
    draft.closestSelectors = Array.isArray(raw.closestSelectors)
        ? joinCsv(raw.closestSelectors.filter((entry): entry is string => typeof entry === "string"))
        : "";
    return draft;
}

function urlSourceToDraft(raw: unknown): DraftRdUrlSource | undefined {
    if (typeof raw === "string") {
        return { kind: "attribute", attribute: raw, valueSource: emptyValueSource() };
    }
    if (isPlainObject(raw) && typeof raw.source === "string") {
        return {
            kind: "value-source",
            attribute: "",
            valueSource: valueSourceToDraft(raw as ValueSource),
        };
    }
    return undefined;
}

function downloadModeToDraft(raw: unknown): DraftRdDownloadMode | undefined {
    if (!isPlainObject(raw) || typeof raw.name !== "string") {
        return undefined;
    }
    const steps = Array.isArray(raw.steps)
        ? raw.steps.map(downloadStepToDraft).filter((step): step is DraftRdDownloadStep => step != null)
        : [];
    return { name: raw.name, steps };
}

function downloadStepToDraft(raw: unknown): DraftRdDownloadStep | undefined {
    if (!isPlainObject(raw)) {
        return undefined;
    }
    const mode = raw.mode === "download" ? "download" : raw.mode === "document" ? "document" : null;
    if (mode == null) {
        return undefined;
    }
    const step = emptyDownloadStep(mode);
    if (mode === "document" && isPlainObject(raw.valueSource)) {
        step.valueSource = valueSourceToDraft(raw.valueSource as ValueSource);
    }
    step.method = typeof raw.method === "string" ? raw.method : "";
    step.timeout = typeof raw.timeout === "number" && Number.isFinite(raw.timeout)
        ? String(raw.timeout)
        : "";
    if (isPlainObject(raw.headers)) {
        step.headersJson = JSON.stringify(raw.headers, null, 2);
    }
    if (raw.data != null) {
        step.dataJson = typeof raw.data === "string"
            ? JSON.stringify(raw.data)
            : JSON.stringify(raw.data, null, 2);
    }
    return step;
}

function draftMappingToOpts(mapping: DraftRdMapping): Record<string, unknown> | undefined {
    const selectors = splitCsv(mapping.selectors);
    if (selectors.length === 0) {
        return undefined;
    }
    const decoration = draftDecorationToOpts(mapping.decoration);
    const pageFilter = splitCsv(mapping.pageFilter);
    const base: Record<string, unknown> = {
        type: mapping.type,
        selectors,
        ...(pageFilter.length > 0 ? { pageFilter } : {}),
        ...(mapping.ignoreDecoration === "true" ? { ignoreDecoration: true } : {}),
        ...(decoration != null ? { decoration } : {}),
    };
    if (mapping.type === "collection") {
        const children = splitLines(mapping.children);
        if (children.length === 0) {
            return undefined;
        }
        return { ...base, children };
    }
    const urlSources = mapping.urlSources
        .map(draftUrlSourceToOpts)
        .filter((entry): entry is string | ValueSource => entry != null);
    if (urlSources.length === 0) {
        return undefined;
    }
    const downloadMode = mapping.downloadMode.trim();
    return {
        ...base,
        urlSources,
        ...(downloadMode.length > 0 ? { downloadMode } : {}),
    };
}

function draftDecorationToOpts(decoration: DraftRdDecoration): Record<string, unknown> | undefined {
    const wrapClasses = splitLines(decoration.wrapClasses);
    const closestSelectors = splitCsv(decoration.closestSelectors);
    const value: Record<string, unknown> = {
        ...(decoration.wrapElement === "true" ? { wrapElement: true } : {}),
        ...(wrapClasses.length > 0 ? { wrapClasses } : {}),
        ...(decoration.wrapCopyElementClasses === "true" ? { wrapCopyElementClasses: true } : {}),
        ...(decoration.useImmediateParent === "true" ? { useImmediateParent: true } : {}),
        ...(decoration.useImmediateParent !== "true" && closestSelectors.length > 0
            ? { closestSelectors }
            : {}),
        ...(decoration.overridePosition === "true" ? { overridePosition: true } : {}),
    };
    return Object.keys(value).length > 0 ? value : undefined;
}

function draftUrlSourceToOpts(source: DraftRdUrlSource): string | ValueSource | undefined {
    if (source.kind === "attribute") {
        const attribute = source.attribute.trim();
        return attribute.length > 0 ? attribute : undefined;
    }
    return draftToValueSource(source.valueSource);
}

function draftDownloadModeToOpts(mode: DraftRdDownloadMode): Record<string, unknown> | undefined {
    const name = mode.name.trim();
    if (name.length === 0) {
        return undefined;
    }
    const steps = mode.steps
        .map(draftDownloadStepToOpts)
        .filter((step): step is Record<string, unknown> => step != null);
    if (steps.length === 0) {
        return undefined;
    }
    return { name, steps };
}

function draftDownloadStepToOpts(step: DraftRdDownloadStep): Record<string, unknown> | undefined {
    const headers = parseHeadersJson(step.headersJson);
    const timeout = parseOptionalTimeout(step.timeout);
    if (step.mode === "download") {
        return {
            mode: "download",
            ...(headers != null ? { headers } : {}),
            ...(timeout != null ? { timeout } : {}),
        };
    }
    const data = parseDataJson(step.dataJson);
    const method = step.method.trim();
    return {
        mode: "document",
        valueSource: draftToValueSource(step.valueSource),
        ...(method.length > 0 ? { method } : {}),
        ...(headers != null ? { headers } : {}),
        ...(data != null ? { data } : {}),
        ...(timeout != null ? { timeout } : {}),
    };
}

function parseHeadersJson(raw: string): Record<string, string> | undefined {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (!isPlainObject(parsed)) {
            return undefined;
        }
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "string") {
                headers[key] = value;
            }
        }
        return Object.keys(headers).length > 0 ? headers : undefined;
    } catch {
        return undefined;
    }
}

function parseDataJson(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return trimmed;
    }
}

function parseOptionalTimeout(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : undefined;
}

function emptyMapping(): DraftRdMapping {
    return {
        key: "",
        type: "leaf",
        selectors: "",
        pageFilter: "",
        ignoreDecoration: "false",
        decoration: emptyDecoration(),
        urlSources: [emptyUrlSource()],
        downloadMode: "",
        children: "",
    };
}

function emptyDecoration(): DraftRdDecoration {
    return {
        wrapElement: "false",
        wrapClasses: "",
        wrapCopyElementClasses: "false",
        useImmediateParent: "false",
        closestSelectors: "",
        overridePosition: "false",
    };
}

function emptyUrlSource(): DraftRdUrlSource {
    return { kind: "attribute", attribute: "", valueSource: emptyValueSource() };
}

function emptyDownloadMode(): DraftRdDownloadMode {
    return {
        name: "",
        steps: [emptyDownloadStep("download")],
    };
}

function emptyDownloadStep(mode: "document" | "download"): DraftRdDownloadStep {
    return {
        mode,
        valueSource: emptyValueSource(),
        method: "",
        headersJson: "",
        dataJson: "",
        timeout: "",
    };
}

function ensureDraft(module: DraftIntegrationModule): void {
    if (module.resourcesDownloaderOpts == null) {
        module.resourcesDownloaderOpts = { mappings: [], downloadModes: [] };
    }
}

function isEmptyMapping(mapping: DraftRdMapping): boolean {
    return mapping.key.trim().length === 0
        && mapping.selectors.trim().length === 0
        && mapping.downloadMode.trim().length === 0
        && mapping.children.trim().length === 0
        && mapping.ignoreDecoration === "false"
        && mapping.urlSources.every((source) => source.kind === "attribute" && source.attribute.trim().length === 0);
}

function isEmptyDownloadMode(mode: DraftRdDownloadMode): boolean {
    return mode.name.trim().length === 0
        && mode.steps.every((step) =>
            step.method.trim().length === 0
            && step.headersJson.trim().length === 0
            && step.dataJson.trim().length === 0
            && step.timeout.trim().length === 0
            && step.mode === "download");
}

ModuleOptsFormRegistry.register(resourcesDownloaderOptsForm);

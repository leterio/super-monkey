import { randomString } from "../../utils/string";
import { injectSection } from "../../utils/ui/ui-builder";
import {
    DraftMapStepType,
    DraftValueMapper,
    DraftValueSource,
    emptyMapStep,
} from "./draft-mappers";
import type { EditorUiHelpers } from "./editor-ui-helpers";

export type MountValueSourceOptions = {
    /**
     * When true, only element sources (`attribute`, `text`, `srcset`) appear.
     * Use for Resources Downloader document steps, which reject URL sources.
     */
    readonly elementSourcesOnly?: boolean;
    /**
     * When true, skips Map steps so the caller can mount them with
     * {@link mountValueSourceMapSteps} (for example after sibling fields).
     */
    readonly omitMapSteps?: boolean;
    /** Base validation path for annotated fields (for example `…idSource`). */
    readonly pathPrefix?: string;
};

function fieldPath(pathPrefix: string | undefined, suffix: string): string | undefined {
    if (pathPrefix == null || pathPrefix.length === 0) {
        return undefined;
    }
    return `${pathPrefix}.${suffix}`;
}

function fieldOptions(pathPrefix: string | undefined, suffix: string, help: string): {
    path?: string;
    help: string;
} {
    const path = fieldPath(pathPrefix, suffix);
    return path != null ? { path, help } : { help };
}

/**
 * Mounts Value Source fields (source kind, attributes, selectors, map steps) into `parent`.
 * Markers survive host remounts; remount uses the markers' live parent.
 */
export function mountValueSource(
    parent: HTMLElement,
    source: DraftValueSource,
    id: string,
    ui: EditorUiHelpers,
    options: MountValueSourceOptions = {},
): void {
    const start = document.createComment("value-source");
    const end = document.createComment("/value-source");
    parent.append(start, end);

    const render = () => {
        const host = start.parentElement;
        if (host == null || end.parentElement !== host) {
            return;
        }
        while (start.nextSibling !== end) {
            start.nextSibling!.remove();
        }

        const staging = document.createElement("div");
        const sourceKinds = options.elementSourcesOnly
            ? (["attribute", "text", "srcset"] as const)
            : (["attribute", "text", "srcset", "query-param", "path"] as const);
        const sourceLabels: Readonly<Record<string, string>> = options.elementSourcesOnly
            ? { attribute: "Attribute", text: "Text", srcset: "Srcset" }
            : {
                attribute: "Attribute",
                text: "Text",
                srcset: "Srcset",
                "query-param": "Query parameter",
                path: "URL path",
            };
        if (
            options.elementSourcesOnly
            && (source.source === "query-param" || source.source === "path")
        ) {
            source.source = "attribute";
        }
        ui.field(staging, `${id}-type`, "Source", ui.select(
            [...sourceKinds],
            source.source,
            (value) => {
                source.source = value as DraftValueSource["source"];
                render();
            },
            sourceLabels,
        ), fieldOptions(
            options.pathPrefix,
            "source",
            "Where the raw value is read from before optional map steps.",
        ));
        const isElementSource = source.source === "attribute"
            || source.source === "text"
            || source.source === "srcset";
        if (isElementSource) {
            ui.field(staging, `${id}-selectors`, "Selectors", ui.textInput(
                source.selectors,
                (value) => {
                    source.selectors = value;
                },
            ), fieldOptions(
                options.pathPrefix,
                "selectors",
                options.elementSourcesOnly
                    ? "Comma-separated CSS selectors. Required: matches elements inside the fetched document."
                    : "Comma-separated CSS selectors. Optional: query under a base element or document. Empty uses the caller element.",
            ));
        }
        if (source.source === "attribute" || source.source === "srcset") {
            ui.field(staging, `${id}-attributes`, "Attributes", ui.textInput(
                source.attributes,
                (value) => {
                    source.attributes = value;
                },
            ), fieldOptions(
                options.pathPrefix,
                "attributes",
                "Comma-separated attribute names, tried in order.",
            ));
        }
        if (source.source === "srcset") {
            ui.field(staging, `${id}-resolution`, "Srcset resolution", ui.textInput(
                source.resolution,
                (value) => {
                    source.resolution = value;
                },
            ), fieldOptions(
                options.pathPrefix,
                "resolution",
                'Use "high", "low", or an exact descriptor such as "2x".',
            ));
        } else if (source.source === "query-param") {
            ui.field(staging, `${id}-key`, "Query key", ui.textInput(source.key, (value) => {
                source.key = value;
            }), fieldOptions(
                options.pathPrefix,
                "key",
                "Query parameter name read from the page URL.",
            ));
        }

        if (!options.omitMapSteps) {
            mountValueSourceMapSteps(staging, source, id, ui, options.pathPrefix);
        }

        while (staging.firstChild != null) {
            host.insertBefore(staging.firstChild, end);
        }
    };
    render();
}

/**
 * Mounts the optional Map steps section for a Value Source draft.
 */
export function mountValueSourceMapSteps(
    parent: HTMLElement,
    source: DraftValueSource,
    id: string,
    ui: EditorUiHelpers,
    pathPrefix?: string,
): HTMLElement {
    const mapsSection = injectSection(parent, {
        title: "Map steps",
        subtitle: "Optional post-processing chain, applied in order.",
        foldable: true,
        folded: true,
        button: {
            label: "Add step",
            onClick: () => {
                const step = emptyMapStep("extract");
                source.mapSteps.push(step);
                ui.focusBlock(
                    mapsSection,
                    mountMapStep(mapsSection, source, step, id, ui, pathPrefix),
                );
            },
        },
    });
    source.mapSteps.forEach((step) => {
        mountMapStep(mapsSection, source, step, id, ui, pathPrefix);
    });
    return mapsSection;
}

function mountMapStep(
    list: HTMLElement,
    source: DraftValueSource,
    step: DraftValueMapper,
    prefix: string,
    ui: EditorUiHelpers,
    pathPrefix?: string,
): HTMLElement {
    const stepIndex = () => source.mapSteps.indexOf(step);
    const stepPath = () => {
        const mapBase = pathPrefix != null && pathPrefix.length > 0
            ? `${pathPrefix}.map[${stepIndex()}]`
            : `map[${stepIndex()}]`;
        return mapBase;
    };
    const section = ui.removableSection(
        list,
        "Map step",
        () => ui.remove(source.mapSteps, step, section),
        true,
        true,
        stepPath(),
    );
    const id = `${prefix}-map-${randomString(8)}`;
    const start = document.createComment("map-step-fields");
    const end = document.createComment("/map-step-fields");
    section.append(start, end);

    const render = () => {
        while (start.nextSibling !== end) {
            start.nextSibling!.remove();
        }

        const staging = document.createElement("div");
        const base = stepPath();
        ui.field(staging, `${id}-type`, "Step type", ui.select(
            ["extract", "replace", "json_path", "sort", "pick"],
            step.type,
            (value) => {
                step.type = value as DraftMapStepType;
                render();
            },
            {
                extract: "Extract (regex)",
                replace: "Replace (regex)",
                json_path: "JSON path",
                sort: "Sort",
                pick: "Pick",
            },
        ), fieldOptions(base, "type", ""));

        if (step.type === "extract" || step.type === "replace") {
            ui.field(staging, `${id}-regexes`, "Regexes", ui.textarea(
                step.regexes,
                (value) => {
                    step.regexes = value;
                },
            ), { ...fieldOptions(base, "regexes", "One pattern per line."), column: true });
            if (step.type === "extract") {
                ui.field(staging, `${id}-capture`, "Capture group", ui.textInput(
                    step.captureGroup,
                    (value) => {
                        step.captureGroup = value;
                    },
                ), fieldOptions(
                    base,
                    "captureGroup",
                    "Capture group index or name. Empty uses the full match.",
                ));
            } else {
                ui.field(staging, `${id}-replacement`, "Replacement", ui.textInput(
                    step.replacement,
                    (value) => {
                        step.replacement = value;
                    },
                ), fieldOptions(
                    base,
                    "replacement",
                    "Replacement string. May reference capture groups.",
                ));
            }
        } else if (step.type === "json_path") {
            ui.field(staging, `${id}-path`, "Path", ui.textInput(
                step.path,
                (value) => {
                    step.path = value;
                },
            ), fieldOptions(base, "path", "Dotted path, for example playbackMp4s.permutations."));
        } else if (step.type === "sort") {
            ui.field(staging, `${id}-order`, "Order", ui.select(
                ["asc", "desc"],
                step.sortOrder,
                (value) => {
                    step.sortOrder = value as "asc" | "desc";
                },
                { asc: "Ascending", desc: "Descending" },
            ), fieldOptions(
                base,
                "order",
                "Sort direction applied to the array before later steps.",
            ));
            ui.field(staging, `${id}-by-kind`, "Sort by", ui.select(
                ["path", "area"],
                step.sortByKind,
                (value) => {
                    step.sortByKind = value as "path" | "area";
                    render();
                },
                { path: "Field path", area: "Area (width × height)" },
            ), fieldOptions(
                base,
                "by",
                "Compare items by a field path or by width × height area.",
            ));
            if (step.sortByKind === "path") {
                ui.field(staging, `${id}-sort-path`, "Field path", ui.textInput(
                    step.sortPath,
                    (value) => {
                        step.sortPath = value;
                    },
                ), fieldOptions(base, "by.path", "Dotted path on each array item."));
            } else {
                ui.field(staging, `${id}-width`, "Width path", ui.textInput(
                    step.sortAreaWidth,
                    (value) => {
                        step.sortAreaWidth = value;
                    },
                ), fieldOptions(base, "by.area.width", "Dotted path for the width field on each array item."));
                ui.field(staging, `${id}-height`, "Height path", ui.textInput(
                    step.sortAreaHeight,
                    (value) => {
                        step.sortAreaHeight = value;
                    },
                ), fieldOptions(base, "by.area.height", "Dotted path for the height field on each array item."));
            }
        } else {
            ui.field(staging, `${id}-at`, "Pick", ui.select(
                ["first", "last"],
                step.pickAt,
                (value) => {
                    step.pickAt = value as "first" | "last";
                },
                { first: "First", last: "Last" },
            ), fieldOptions(base, "at", "Which array entry to keep after earlier map steps."));
        }

        ui.setPath(section, base);

        while (staging.firstChild != null) {
            section.insertBefore(staging.firstChild, end);
        }
    };
    render();
    return section;
}

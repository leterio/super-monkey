import { joinCsv, randomString, splitCsv } from "../../../utils/string";
import { isPlainObject } from "../../../utils/type";
import { injectSection } from "../../../utils/ui/ui-builder";
import type { IntegrationValidationIssue } from "../../integration-validation";
import type {
    DraftCustomCssOnEventType,
    DraftCustomCssOption,
    DraftCustomCssOpts,
    DraftCustomCssRule,
    DraftCustomCssRuleType,
    DraftIntegrationModule,
} from "../draft-mappers";
import type { EditorUiHelpers } from "../editor-ui-helpers";
import type { ModuleOptsForm } from "./module-opts-form";
import { ModuleOptsFormRegistry } from "./module-opts-form-registry";

const MODULE_KEY = "CustomCss";

const ON_EVENT_VALUES: DraftCustomCssOnEventType[] = [
    "",
    "contentLoaded",
    "entityViewed",
    "entitiesParsed",
    "entitiesInjected",
];

const ON_EVENT_LABELS: Record<DraftCustomCssOnEventType, string> = {
    "": "None (page CSS only)",
    contentLoaded: "contentLoaded (document)",
    entityViewed: "entityViewed (viewed entity)",
    entitiesParsed: "entitiesParsed (each listed entity)",
    entitiesInjected: "entitiesInjected (each injected entity)",
};


const customCssOptsForm: ModuleOptsForm = {
    moduleKey: MODULE_KEY,

    hydrate(module, opts) {
        module.customCssOpts = {
            staticCss: isPlainObject(opts) && typeof opts.static === "string" ? opts.static : "",
            rules: isPlainObject(opts) && Array.isArray(opts.rules)
                ? opts.rules.map(ruleToDraft).filter((rule): rule is DraftCustomCssRule => rule != null)
                : [],
        };
        module.optsText = "";
    },

    mount(ctx) {
        const { module, host, ui, pathPrefix } = ctx;
        ensureDraft(module);
        const draft = module.customCssOpts!;
        const id = `custom-css-opts-${module.instanceName || "new"}`;

        ui.field(
            host,
            `${id}-static`,
            "Static CSS",
            ui.textarea(draft.staticCss, (value) => {
                draft.staticCss = value;
            }),
            {
                path: `${pathPrefix}.static`,
                help: "Always-on CSS injected at construction. Optional when at least one rule is present.",
                column: true,
            },
        );

        const rulesSection = injectSection(host, {
            title: "Rules",
            subtitle: "Optional Configuration Menu controls that inject CSS from preferences.",
            foldable: true,
            folded: draft.rules.length === 0,
            button: {
                label: "Add rule",
                onClick: () => {
                    const rule = emptyRule();
                    draft.rules.push(rule);
                    ui.focusBlock(
                        rulesSection,
                        mountRule(rulesSection, rule, draft.rules, pathPrefix, ui),
                    );
                },
            },
        });
        draft.rules.forEach((rule) => mountRule(rulesSection, rule, draft.rules, pathPrefix, ui));
    },

    toOpts(module) {
        ensureDraft(module);
        const draft = module.customCssOpts!;
        const staticCss = draft.staticCss.trim();
        const issues: IntegrationValidationIssue[] = [];
        const rules: Record<string, unknown>[] = [];

        draft.rules.forEach((rule, index) => {
            if (isEmptyRule(rule)) {
                return;
            }
            const built = draftRuleToOpts(rule);
            if (built.ok) {
                rules.push(built.value);
                return;
            }
            if (built.issue != null) {
                issues.push({
                    ...built.issue,
                    path: `rules[${index}]${built.issue.path.length > 0 ? `.${built.issue.path}` : ""}`,
                });
            }
        });

        if (issues.length > 0) {
            return { ok: false, issues };
        }

        return {
            ok: true,
            value: {
                ...(staticCss.length > 0 ? { static: staticCss } : {}),
                ...(rules.length > 0 ? { rules } : {}),
            },
        };
    },
};

function mountRule(
    list: HTMLElement,
    rule: DraftCustomCssRule,
    rules: DraftCustomCssRule[],
    pathPrefix: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => rules.indexOf(rule);
    const rulePath = () => `${pathPrefix}.rules[${indexOf()}]`;
    const titleEl = ui.namedBlockHeading("Rule", indexOf(), rule.key || rule.label);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(rules, rule, section);
        ui.syncNamedListHeadings(
            list,
            rules.map((entry) => entry.key || entry.label),
            "Rule",
        );
    }, true, true, rulePath());
    const id = `custom-css-rule-${randomString(8)}`;

    const fieldsStart = document.createComment("custom-css-rule-fields");
    const fieldsEnd = document.createComment("/custom-css-rule-fields");
    section.append(fieldsStart, fieldsEnd);

    const renderFields = () => {
        while (fieldsStart.nextSibling !== fieldsEnd) {
            fieldsStart.nextSibling!.remove();
        }
        const staging = document.createElement("div");
        mountRuleFields(staging, rule, id, rulePath, ui, titleEl, indexOf, renderFields);
        while (staging.firstChild != null) {
            section.insertBefore(staging.firstChild, fieldsEnd);
        }
        ui.setPath(section, rulePath());
    };
    renderFields();
    return section;
}

function mountRuleFields(
    host: HTMLElement,
    rule: DraftCustomCssRule,
    id: string,
    rulePath: () => string,
    ui: EditorUiHelpers,
    titleEl: HTMLHeadingElement,
    indexOf: () => number,
    rerender: () => void,
): void {
    const base = rulePath();
    const keyInputId = `${id}-key`;
    ui.field(host, `${id}-type`, "Rule type", ui.select(
        ["boolean", "number", "options"],
        rule.type,
        (value) => {
            rule.type = value as DraftCustomCssRuleType;
            rerender();
        },
        {
            boolean: "Boolean",
            number: "Number",
            options: "Options",
        },
    ), {
        path: `${base}.type`,
        help: "Preference control shown in the Configuration Menu.",
    });
    ui.field(host, keyInputId, "Key", ui.textInput(rule.key, (value) => {
        rule.key = value;
        ui.syncNamedBlockHeading(titleEl, "Rule", indexOf(), value || rule.label);
    }), {
        path: `${base}.key`,
        help: "Valid id segment. Unique within this Custom CSS instance.",
    });
    ui.field(host, `${id}-label`, "Label", ui.textInput(rule.label, (value) => {
        rule.label = value;
        ui.syncNamedBlockHeading(titleEl, "Rule", indexOf(), rule.key || value);
    }), {
        path: `${base}.label`,
        help: "Configuration Menu label. Defaults to the key when empty.",
    });
    ui.field(host, `${id}-description`, "Description", ui.textInput(rule.description, (value) => {
        rule.description = value;
    }), {
        path: `${base}.description`,
        help: "Optional help text in the Configuration Menu.",
    });

    if (rule.type === "boolean") {
        ui.field(host, `${id}-default-bool`, "Default", ui.select(
            ["true", "false"],
            rule.defaultValueBoolean,
            (value) => {
                rule.defaultValueBoolean = value as DraftCustomCssRule["defaultValueBoolean"];
            },
            { true: "On", false: "Off" },
        ), {
            path: `${base}.defaultValue`,
            help: "Initial preference when the user has not chosen a value.",
        });
    } else if (rule.type === "number") {
        ui.field(host, `${id}-default-num`, "Default", ui.textInput(
            rule.defaultValueNumber,
            (value) => {
                rule.defaultValueNumber = value;
            },
        ), {
            path: `${base}.defaultValue`,
            help: "Initial number when the user has not chosen a value.",
        });
        ui.field(host, `${id}-min`, "Min", ui.textInput(rule.min, (value) => {
            rule.min = value;
        }), {
            path: `${base}.min`,
            help: "Optional inclusive lower bound.",
        });
        ui.field(host, `${id}-max`, "Max", ui.textInput(rule.max, (value) => {
            rule.max = value;
        }), {
            path: `${base}.max`,
            help: "Optional inclusive upper bound.",
        });
    } else {
        ui.field(host, `${id}-default-opt`, "Default value", ui.textInput(
            rule.defaultValueOption,
            (value) => {
                rule.defaultValueOption = value;
            },
        ), {
            path: `${base}.defaultValue`,
            help: "Must match an option value when set.",
        });

        const optionsSection = injectSection(host, {
            title: "Options",
            subtitle: "Select choices shown in the Configuration Menu.",
            foldable: true,
            folded: rule.options.length === 0,
            button: {
                label: "Add option",
                onClick: () => {
                    const option = emptyOption();
                    rule.options.push(option);
                    ui.focusBlock(
                        optionsSection,
                        mountOption(optionsSection, option, rule.options, base, ui),
                    );
                },
            },
        });
        rule.options.forEach((option) => mountOption(optionsSection, option, rule.options, base, ui));
    }

    ui.field(host, `${id}-shadow-selectors`, "Shadow root selectors", ui.textInput(
        rule.shadowRootSelectors,
        (value) => {
            rule.shadowRootSelectors = value;
        },
    ), {
        path: `${base}.shadowRootSelectors`,
        help: "Optional. Comma-separated host chains ending with :shadowRoot (example: media-host:shadowRoot). When set, the same CSS is also adopted into those open shadows; page (document) injection still runs.",
    });
    ui.field(host, `${id}-on-event`, "On event", ui.select(
        ON_EVENT_VALUES,
        rule.onEventType,
        (value) => {
            rule.onEventType = value as DraftCustomCssOnEventType;
        },
        ON_EVENT_LABELS,
    ), {
        path: `${base}.onEventType`,
        help: "Required when Shadow root selectors are set. None = page CSS only. contentLoaded queries document; entityViewed uses the viewed element (or document); entitiesParsed / entitiesInjected use each entity element.",
    });
    ui.field(host, `${id}-css`, "CSS", ui.textarea(rule.css, (value) => {
        rule.css = value;
    }), {
        path: `${base}.css`,
        help: "CSS injected into the document when the preference is active, and also into matching shadow roots when shadow selectors are set. Number/options may use {{VALUE}}.",
        column: true,
    });
}

function mountOption(
    list: HTMLElement,
    option: DraftCustomCssOption,
    options: DraftCustomCssOption[],
    rulePath: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => options.indexOf(option);
    const optionPath = () => `${rulePath}.options[${indexOf()}]`;
    const titleEl = ui.namedBlockHeading("Option", indexOf(), option.label || option.value);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(options, option, section);
        ui.syncNamedListHeadings(
            list,
            options.map((entry) => entry.label || entry.value),
            "Option",
        );
    }, true, true, optionPath());
    const id = `custom-css-option-${randomString(8)}`;
    ui.field(section, `${id}-label`, "Label", ui.textInput(option.label, (value) => {
        option.label = value;
        ui.syncNamedBlockHeading(titleEl, "Option", indexOf(), value || option.value);
    }), {
        path: `${optionPath()}.label`,
        help: "Text shown in the Configuration Menu select.",
    });
    ui.field(section, `${id}-value`, "Value", ui.textInput(option.value, (value) => {
        option.value = value;
        ui.syncNamedBlockHeading(titleEl, "Option", indexOf(), option.label || value);
    }), {
        path: `${optionPath()}.value`,
        help: "Stored preference value. Must be unique among options on this rule.",
    });
    return section;
}

function ruleToDraft(raw: unknown): DraftCustomCssRule | undefined {
    if (!isPlainObject(raw)) {
        return undefined;
    }
    const type = raw.type;
    if (type !== "boolean" && type !== "number" && type !== "options") {
        return undefined;
    }
    const draft = emptyRule(type);
    draft.key = typeof raw.key === "string" ? raw.key : "";
    draft.css = typeof raw.css === "string" ? raw.css : "";
    draft.label = typeof raw.label === "string" ? raw.label : "";
    draft.description = typeof raw.description === "string" ? raw.description : "";

    if (type === "boolean") {
        draft.defaultValueBoolean = raw.defaultValue === false ? "false" : "true";
    } else if (type === "number") {
        draft.defaultValueNumber = typeof raw.defaultValue === "number" && Number.isFinite(raw.defaultValue)
            ? String(raw.defaultValue)
            : "0";
        draft.min = typeof raw.min === "number" && Number.isFinite(raw.min) ? String(raw.min) : "";
        draft.max = typeof raw.max === "number" && Number.isFinite(raw.max) ? String(raw.max) : "";
    } else {
        draft.defaultValueOption = typeof raw.defaultValue === "string" ? raw.defaultValue : "";
        draft.options = Array.isArray(raw.options)
            ? raw.options
                .filter(isPlainObject)
                .map((entry) => ({
                    label: typeof entry.label === "string" ? entry.label : "",
                    value: typeof entry.value === "string" ? entry.value : "",
                }))
            : [];
    }

    draft.shadowRootSelectors = Array.isArray(raw.shadowRootSelectors)
        ? joinCsv(raw.shadowRootSelectors.filter((entry): entry is string => typeof entry === "string"))
        : "";
    draft.onEventType = isOnEventType(raw.onEventType) ? raw.onEventType : "";

    return draft;
}

function isEmptyRule(rule: DraftCustomCssRule): boolean {
    return rule.key.trim().length === 0
        && rule.label.trim().length === 0
        && rule.description.trim().length === 0
        && rule.css.trim().length === 0
        && rule.shadowRootSelectors.trim().length === 0
        && rule.onEventType === ""
        && rule.options.every((option) => option.label.trim().length === 0 && option.value.trim().length === 0);
}

function draftRuleToOpts(rule: DraftCustomCssRule):
    | { ok: true; value: Record<string, unknown> }
    | { ok: false; issue: IntegrationValidationIssue } {
    const key = rule.key.trim();
    const css = rule.css.trim();
    if (key.length === 0) {
        return { ok: false, issue: { path: "key", message: "Rule key is required." } };
    }
    if (css.length === 0) {
        return { ok: false, issue: { path: "css", message: "Rule CSS is required." } };
    }

    const label = rule.label.trim();
    const description = rule.description.trim();
    const shadowRootSelectors = splitCsv(rule.shadowRootSelectors);
    const onEventType = rule.onEventType;
    if (shadowRootSelectors.length > 0 && onEventType === "") {
        return {
            ok: false,
            issue: {
                path: "onEventType",
                message: "On event is required when shadow root selectors are set.",
            },
        };
    }

    const base: Record<string, unknown> = {
        type: rule.type,
        key,
        css: rule.css,
        ...(label.length > 0 ? { label } : {}),
        ...(description.length > 0 ? { description } : {}),
        ...(shadowRootSelectors.length > 0
            ? { shadowRootSelectors, onEventType }
            : {}),
    };

    if (rule.type === "boolean") {
        base.defaultValue = rule.defaultValueBoolean === "true";
        return { ok: true, value: base };
    }

    if (rule.type === "number") {
        const defaultValue = parseOptionalNumber(rule.defaultValueNumber) ?? 0;
        const min = parseOptionalNumber(rule.min);
        const max = parseOptionalNumber(rule.max);
        return {
            ok: true,
            value: {
                ...base,
                defaultValue,
                ...(min != null ? { min } : {}),
                ...(max != null ? { max } : {}),
            },
        };
    }

    const options = rule.options
        .map((option, index) => {
            const optionLabel = option.label.trim();
            const optionValue = option.value.trim();
            if (optionLabel.length === 0 && optionValue.length === 0) {
                return null;
            }
            if (optionLabel.length === 0 || optionValue.length === 0) {
                return {
                    incomplete: true as const,
                    index,
                };
            }
            return { label: optionLabel, value: optionValue };
        });

    const incompleteOption = options.find((entry) => entry != null && "incomplete" in entry);
    if (incompleteOption != null && "incomplete" in incompleteOption) {
        return {
            ok: false,
            issue: {
                path: `options[${incompleteOption.index}]`,
                message: "Each option needs a label and value.",
            },
        };
    }

    const cleanedOptions = options.filter(
        (entry): entry is { label: string; value: string } => entry != null && !("incomplete" in entry),
    );
    if (cleanedOptions.length === 0) {
        return {
            ok: false,
            issue: { path: "options", message: "At least one option is required for an options rule." },
        };
    }

    const defaultValue = rule.defaultValueOption.trim();
    return {
        ok: true,
        value: {
            ...base,
            options: cleanedOptions,
            ...(defaultValue.length > 0 ? { defaultValue } : {}),
        },
    };
}

function parseOptionalNumber(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : undefined;
}

function emptyRule(type: DraftCustomCssRuleType = "boolean"): DraftCustomCssRule {
    return {
        type,
        key: "",
        css: "",
        label: "",
        description: "",
        defaultValueBoolean: "true",
        defaultValueNumber: "0",
        min: "",
        max: "",
        defaultValueOption: "",
        options: [],
        shadowRootSelectors: "",
        onEventType: "",
    };
}

function isOnEventType(value: unknown): value is Exclude<DraftCustomCssOnEventType, ""> {
    return value === "contentLoaded"
        || value === "entityViewed"
        || value === "entitiesParsed"
        || value === "entitiesInjected";
}

function emptyOption(): DraftCustomCssOption {
    return { label: "", value: "" };
}

function ensureDraft(module: DraftIntegrationModule): void {
    if (module.customCssOpts == null) {
        module.customCssOpts = emptyCustomCssOpts();
    }
}

function emptyCustomCssOpts(): DraftCustomCssOpts {
    return { staticCss: "", rules: [] };
}

ModuleOptsFormRegistry.register(customCssOptsForm);

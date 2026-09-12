import { randomString } from "../../../utils/string";
import { isPlainObject } from "../../../utils/type";
import { injectSection } from "../../../utils/ui/ui-builder";
import type { IntegrationValidationIssue } from "../../integration-validation";
import type {
    DraftIntegrationModule,
    DraftJsSnippetListener,
    DraftJsSnippetRule,
    DraftJsSnippetsOpts,
} from "../draft-mappers";
import type { EditorUiHelpers } from "../editor-ui-helpers";
import type { ModuleOptsForm } from "./module-opts-form";
import { ModuleOptsFormRegistry } from "./module-opts-form-registry";

const MODULE_KEY = "JsSnippets";

const LISTENER_VALUES: DraftJsSnippetListener[] = [
    "contentLoaded",
    "beforeUnload",
    "entityViewed",
    "entitiesParsed",
    "entitiesInjected",
];

const LISTENER_LABELS: Record<DraftJsSnippetListener, string> = {
    contentLoaded: "onContentLoaded (no args)",
    beforeUnload: "onBeforeUnload (event)",
    entityViewed: "onEntityViewed (event)",
    entitiesParsed: "onEntitiesParsed (event)",
    entitiesInjected: "onEntitiesInjected (event)",
};

const jsSnippetsOptsForm: ModuleOptsForm = {
    moduleKey: MODULE_KEY,

    hydrate(module, opts) {
        module.jsSnippetsOpts = {
            rules: isPlainObject(opts) && Array.isArray(opts.rules)
                ? opts.rules.map(ruleToDraft).filter((rule): rule is DraftJsSnippetRule => rule != null)
                : [],
        };
        module.optsText = "";
    },

    mount(ctx) {
        const { module, host, ui, pathPrefix } = ctx;
        ensureDraft(module);
        const draft = module.jsSnippetsOpts!;

        const rulesSection = injectSection(host, {
            title: "Rules",
            subtitle:
                "Each rule is an opt-in Configuration Menu toggle (default off) that runs the code on the selected listener.",
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
        const draft = module.jsSnippetsOpts!;
        const issues: IntegrationValidationIssue[] = [];
        const rules: Record<string, unknown>[] = [];

        draft.rules.forEach((rule, index) => {
            if (isEmptyRule(rule)) {
                return;
            }
            const name = rule.name.trim();
            const label = rule.label.trim();
            const code = rule.code.trim();
            const rulePath = `rules[${index}]`;
            if (name.length === 0) {
                issues.push({ path: `${rulePath}.name`, message: "Rule name is required." });
                return;
            }
            if (label.length === 0) {
                issues.push({ path: `${rulePath}.label`, message: "Rule label is required." });
                return;
            }
            if (code.length === 0) {
                issues.push({ path: `${rulePath}.code`, message: "Rule code is required." });
                return;
            }
            const description = rule.description.trim();
            rules.push({
                name,
                label,
                listener: rule.listener,
                code: rule.code,
                ...(description.length > 0 ? { description } : {}),
            });
        });

        if (issues.length > 0) {
            return { ok: false, issues };
        }

        return {
            ok: true,
            value: {
                ...(rules.length > 0 ? { rules } : {}),
            },
        };
    },
};

function mountRule(
    list: HTMLElement,
    rule: DraftJsSnippetRule,
    rules: DraftJsSnippetRule[],
    pathPrefix: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => rules.indexOf(rule);
    const rulePath = () => `${pathPrefix}.rules[${indexOf()}]`;
    const titleEl = ui.namedBlockHeading("Rule", indexOf(), rule.name || rule.label);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(rules, rule, section);
        ui.syncNamedListHeadings(
            list,
            rules.map((entry) => entry.name || entry.label),
            "Rule",
        );
    }, true, true, rulePath());
    const id = `js-snippets-rule-${randomString(8)}`;
    const nameInputId = `${id}-name`;

    ui.field(section, nameInputId, "Name", ui.textInput(rule.name, (value) => {
        rule.name = value;
        ui.syncNamedBlockHeading(titleEl, "Rule", indexOf(), value || rule.label);
        ui.setPath(section, rulePath());
        ui.setFieldPath(section, nameInputId, `${rulePath()}.name`);
    }), {
        path: `${rulePath()}.name`,
        help: "Valid id segment. Unique within this JS Snippets instance. Used as the Configuration storage key.",
    });
    ui.field(section, `${id}-label`, "Label", ui.textInput(rule.label, (value) => {
        rule.label = value;
        ui.syncNamedBlockHeading(titleEl, "Rule", indexOf(), rule.name || value);
    }), {
        path: `${rulePath()}.label`,
        help: "Configuration Menu label.",
    });
    ui.field(section, `${id}-description`, "Description", ui.textInput(rule.description, (value) => {
        rule.description = value;
    }), {
        path: `${rulePath()}.description`,
        help: "Optional Configuration Menu description.",
    });
    ui.field(
        section,
        `${id}-listener`,
        "Listener",
        ui.select(LISTENER_VALUES, rule.listener, (value) => {
            rule.listener = value as DraftJsSnippetListener;
        }, LISTENER_LABELS),
        {
            path: `${rulePath()}.listener`,
            help: "Hook that runs the snippet when the toggle is on.",
        },
    );
    ui.field(section, `${id}-code`, "Code", ui.textarea(rule.code, (value) => {
        rule.code = value;
    }), {
        path: `${rulePath()}.code`,
        help: "JavaScript body. contentLoaded has no parameters; other listeners receive event.",
        column: true,
    });

    return section;
}

function isEmptyRule(rule: DraftJsSnippetRule): boolean {
    return rule.name.trim().length === 0
        && rule.label.trim().length === 0
        && rule.description.trim().length === 0
        && rule.code.trim().length === 0;
}

function ruleToDraft(raw: unknown): DraftJsSnippetRule | undefined {
    if (!isPlainObject(raw)) {
        return undefined;
    }

    const listener = typeof raw.listener === "string" && isListener(raw.listener)
        ? raw.listener
        : "contentLoaded";

    return {
        name: typeof raw.name === "string" ? raw.name : "",
        label: typeof raw.label === "string" ? raw.label : "",
        description: typeof raw.description === "string" ? raw.description : "",
        listener,
        code: typeof raw.code === "string" ? raw.code : "",
    };
}

function emptyRule(): DraftJsSnippetRule {
    return {
        name: "",
        label: "",
        description: "",
        listener: "contentLoaded",
        code: "",
    };
}

function ensureDraft(module: DraftIntegrationModule): void {
    if (module.jsSnippetsOpts == null) {
        module.jsSnippetsOpts = emptyJsSnippetsOpts();
    }
}

function emptyJsSnippetsOpts(): DraftJsSnippetsOpts {
    return { rules: [] };
}

function isListener(value: string): value is DraftJsSnippetListener {
    return (LISTENER_VALUES as readonly string[]).includes(value);
}

ModuleOptsFormRegistry.register(jsSnippetsOptsForm);

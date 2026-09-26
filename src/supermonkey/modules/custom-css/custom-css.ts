import type {
    EntitiesInjectedEventPayload,
    EntitiesParsedEventPayload,
    EntityViewedEventPayload,
} from "../../content-manager/events";
import type { ContentLoadedEventPayload } from "../../lifecycle/events";
import { injectStyle } from "../../utils/dom/style";
import { fillTokens } from "../../utils/string";
import {
    AbstractConfiguration,
    type Configuration,
} from "../configuration/configuration";
import { BooleanStyleConfiguration } from "../configuration/impl/boolean";
import { NumberStyleConfiguration } from "../configuration/impl/number";
import { StringSelectStyleConfiguration } from "../configuration/impl/string-select";
import { Module } from "../module";
import type {
    CustomCssOnEventType,
    CustomCssOpts,
    CustomCssRule,
} from "./custom-css-opts";
import { queryShadowRoots } from "./shadow-root-query";

const LABEL = "Custom CSS";
const DESCRIPTION = "Applies integration-authored CSS to the page, with optional runtime rules.";

type ShadowBinder = {
    readonly rule: CustomCssRule;
    readonly configuration: AbstractConfiguration<any>;
    readonly installed: Array<{ root: ShadowRoot; sheet: CSSStyleSheet }>;
};

/** Injects static page CSS and optional runtime style rules from integration opts. */
export class CustomCss extends Module<CustomCssOpts> {
    private readonly ruleConfigurations: Configuration[];
    private readonly shadowBinders: readonly ShadowBinder[];

    constructor(name: string, opts: CustomCssOpts) {
        super(name, opts);

        if (opts.static != null && opts.static.length > 0) {
            injectStyle(opts.static);
        }

        const configurations: Configuration[] = [];
        const shadowBinders: ShadowBinder[] = [];

        for (const rule of opts.rules ?? []) {
            const configuration = this.createDocumentRuleConfiguration(name, rule);
            configurations.push(configuration);

            if (this.isShadowRule(rule) && configuration instanceof AbstractConfiguration) {
                shadowBinders.push(this.createShadowBinder(rule, configuration));
            }
        }

        this.ruleConfigurations = configurations;
        this.shadowBinders = shadowBinders;
    }

    override get title(): string {
        return LABEL;
    }

    override get description(): string | undefined {
        return DESCRIPTION;
    }

    override get configurations(): Configuration[] {
        return this.ruleConfigurations;
    }

    protected override async onContentLoaded(_data: ContentLoadedEventPayload): Promise<void> {
        this.runShadowEvent("contentLoaded", [document]);
    }

    protected override async onEntityViewed(data: EntityViewedEventPayload): Promise<void> {
        const base = data.entity.element ?? document;
        this.runShadowEvent("entityViewed", [base]);
    }

    protected override async onEntitiesParsed(data: EntitiesParsedEventPayload): Promise<void> {
        this.runShadowEvent("entitiesParsed", this.collectEntityElements(data.entities));
    }

    protected override async onEntitiesInjected(data: EntitiesInjectedEventPayload): Promise<void> {
        this.runShadowEvent("entitiesInjected", this.collectEntityElements(data.entities));
    }

    private runShadowEvent(eventType: CustomCssOnEventType, bases: ParentNode[]): void {
        for (const binder of this.shadowBinders) {
            if (binder.rule.onEventType !== eventType) {
                continue;
            }
            this.applyShadowBinder(binder, bases);
        }
    }

    private createDocumentRuleConfiguration(moduleName: string, rule: CustomCssRule): Configuration {
        const label = rule.label ?? rule.key;

        switch (rule.type) {
            case "boolean":
                return new BooleanStyleConfiguration(
                    moduleName,
                    rule.key,
                    rule.defaultValue ?? true,
                    {
                        label,
                        description: rule.description,
                        css: (enabled) => (enabled === true ? rule.css : null),
                    },
                );
            case "number":
                return new NumberStyleConfiguration(
                    moduleName,
                    rule.key,
                    rule.defaultValue ?? 0,
                    {
                        label,
                        description: rule.description,
                        min: rule.min,
                        max: rule.max,
                        css: (value) => fillTokens(rule.css, { VALUE: String(value) }),
                    },
                );
            case "options": {
                const values = rule.options.map((option) => option.value);
                const optionsLabels: Record<string, string> = {};
                for (const option of rule.options) {
                    optionsLabels[option.value] = option.label;
                }

                return new StringSelectStyleConfiguration(
                    moduleName,
                    rule.key,
                    rule.defaultValue ?? values[0]!,
                    {
                        label,
                        description: rule.description,
                        options: values,
                        optionsLabels,
                        invalidEmptyString: true,
                        css: (value) => fillTokens(rule.css, { VALUE: value }),
                    },
                );
            }
        }
    }

    private createShadowBinder(
        rule: CustomCssRule,
        configuration: AbstractConfiguration<any>,
    ): ShadowBinder {
        const binder: ShadowBinder = {
            rule,
            configuration,
            installed: [],
        };

        configuration.watch(() => {
            const css = this.resolveShadowCss(binder);
            if (css == null) {
                this.clearShadowBinder(binder);
                return;
            }

            if (rule.onEventType === "contentLoaded") {
                this.applyShadowBinder(binder, [document]);
            }
        });

        return binder;
    }

    private isShadowRule(rule: CustomCssRule): boolean {
        return rule.shadowRootSelectors != null
            && rule.shadowRootSelectors.length > 0
            && rule.onEventType != null;
    }

    private collectEntityElements(
        entities: ReadonlyMap<string, readonly { readonly element: HTMLElement }[]>,
    ): ParentNode[] {
        const bases: ParentNode[] = [];
        for (const list of entities.values()) {
            for (const entity of list) {
                bases.push(entity.element);
            }
        }
        return bases;
    }

    private resolveShadowCss(binder: ShadowBinder): string | null {
        const { rule, configuration } = binder;
        const value = configuration.value;

        switch (rule.type) {
            case "boolean":
                return value === true ? rule.css : null;
            case "number":
                if (typeof value !== "number" || !Number.isFinite(value)) {
                    return null;
                }
                return fillTokens(rule.css, { VALUE: String(value) });
            case "options":
                if (typeof value !== "string" || value.length === 0) {
                    return null;
                }
                return fillTokens(rule.css, { VALUE: value });
        }
    }

    private applyShadowBinder(binder: ShadowBinder, bases: readonly ParentNode[]): void {
        this.log.debug("Applying shadow binder", binder.rule.key);
        const css = this.resolveShadowCss(binder);
        if (css == null) {
            this.clearShadowBinder(binder);
            return;
        }

        const selectors = binder.rule.shadowRootSelectors ?? [];
        for (const base of bases) {
            for (const selector of selectors) {
                for (const root of queryShadowRoots(selector, base)) {
                    this.adoptSheet(binder, root, css);
                }
            }
        }
    }

    private adoptSheet(binder: ShadowBinder, root: ShadowRoot, css: string): void {
        const existing = binder.installed.find((entry) => entry.root === root);
        if (existing != null) {
            existing.sheet.replaceSync(css);
            return;
        }

        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        binder.installed.push({ root, sheet });
    }

    private clearShadowBinder(binder: ShadowBinder): void {
        for (const { root, sheet } of binder.installed) {
            root.adoptedStyleSheets = root.adoptedStyleSheets.filter((entry) => entry !== sheet);
        }
        binder.installed.length = 0;
    }
}

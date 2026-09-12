import { injectStyle } from "../../utils/dom/style";
import { fillTokens } from "../../utils/string";
import type { Configuration } from "../configuration/configuration";
import { BooleanStyleConfiguration } from "../configuration/impl/boolean";
import { NumberStyleConfiguration } from "../configuration/impl/number";
import { StringSelectStyleConfiguration } from "../configuration/impl/string-select";
import { Module } from "../module";
import type { CustomCssOpts, CustomCssRule } from "./custom-css-opts";

const LABEL = "Custom CSS";
const DESCRIPTION = "Applies integration-authored CSS to the page, with optional runtime rules.";

/** Injects static page CSS and optional runtime style rules from integration opts. */
export class CustomCss extends Module<CustomCssOpts> {
    private readonly ruleConfigurations: Configuration[];

    constructor(name: string, opts: CustomCssOpts) {
        super(name, opts);

        if (opts.static != null && opts.static.length > 0) {
            injectStyle(opts.static);
        }

        this.ruleConfigurations = (opts.rules ?? []).map((rule) =>
            CustomCss.createRuleConfiguration(this, rule)
        );
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

    private static createRuleConfiguration(module: CustomCss, rule: CustomCssRule): Configuration {
        const label = rule.label ?? rule.key;

        switch (rule.type) {
            case "boolean":
                return new BooleanStyleConfiguration(
                    module.name,
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
                    module.name,
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
                    module.name,
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
}

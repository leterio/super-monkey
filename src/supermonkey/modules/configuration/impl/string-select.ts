import { StyleConfiguration, type StyleConfigurationOpts } from "../style-configuration";
import { StringConfiguration, type StringConfigurationOpts } from "./string";

export type StringSelectConfigurationOpts = StringConfigurationOpts & {
    readonly options: string[];
    readonly optionsLabels?: Record<string, string>;
};

export class StringSelectConfiguration extends StringConfiguration {
    readonly options: readonly string[];
    readonly optionsLabels: Readonly<Record<string, string>>;

    constructor(
        moduleName: string,
        key: string,
        defaultValue: string,
        opts: StringSelectConfigurationOpts,
    ) {
        StringSelectConfiguration.assertOptions(opts.options);

        super(moduleName, key, defaultValue, opts);

        this.options = Object.freeze([...opts.options]);
        this.optionsLabels = Object.freeze({ ...(opts.optionsLabels ?? {}) });
    }

    getOptionLabel(value: string): string {
        return this.getOptionsLabels()[value] ?? value;
    }

    override isValid(value: string | null): boolean {
        if (!super.isValid(value)) {
            return false;
        }

        if (value === "") {
            return true;
        }

        return this.getOptions().includes(value!);
    }

    private getOptions(): readonly string[] {
        return this.options
            ?? (this.opts as StringSelectConfigurationOpts | undefined)?.options
            ?? [];
    }

    private getOptionsLabels(): Readonly<Record<string, string>> {
        return this.optionsLabels
            ?? (this.opts as StringSelectConfigurationOpts | undefined)?.optionsLabels
            ?? {};
    }

    private static assertOptions(options: string[] | undefined): void {
        if (!Array.isArray(options) || options.length === 0) {
            throw new Error("String select configuration must define at least one option");
        }

        if (options.some((option) => typeof option !== "string" || option.length === 0)) {
            throw new Error("Options must contain only non-empty strings");
        }
    }
}

export class StringSelectStyleConfiguration extends StyleConfiguration<
    string,
    typeof StringSelectConfiguration
>(StringSelectConfiguration) {
    constructor(
        moduleName: string,
        key: string,
        defaultValue: string,
        opts: StringSelectConfigurationOpts & StyleConfigurationOpts<string>,
    ) {
        super(moduleName, key, defaultValue, opts);
    }
}

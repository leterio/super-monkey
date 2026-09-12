import { AbstractConfiguration, type ConfigurationOpts } from "../configuration";
import { StyleConfiguration, type StyleConfigurationOpts } from "../style-configuration";

export type StringConfigurationOpts = ConfigurationOpts & {
    readonly invalidEmptyString?: boolean;
};

export class StringConfiguration extends AbstractConfiguration<string> {
    readonly invalidEmptyString: boolean;

    constructor(
        moduleName: string,
        key: string,
        defaultValue: string,
        opts?: StringConfigurationOpts,
    ) {
        super(moduleName, key, defaultValue, opts);
        this.invalidEmptyString = opts?.invalidEmptyString ?? false;
        this.assertValidDefault();
    }

    override isValid(value: string | null): boolean {
        if (typeof value !== "string") {
            return false;
        }

        if (this.invalidEmptyString && value.length === 0) {
            return false;
        }

        return true;
    }
}

export class StringStyleConfiguration extends StyleConfiguration<
    string,
    typeof StringConfiguration
>(StringConfiguration) {
    constructor(
        moduleName: string,
        key: string,
        defaultValue: string,
        opts: StringConfigurationOpts & StyleConfigurationOpts<string>,
    ) {
        super(moduleName, key, defaultValue, opts);
    }
}

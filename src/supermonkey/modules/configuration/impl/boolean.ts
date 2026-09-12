import { AbstractConfiguration, type ConfigurationOpts } from "../configuration";
import { StyleConfiguration, type StyleConfigurationOpts } from "../style-configuration";

export class BooleanConfiguration extends AbstractConfiguration<boolean> {
    constructor(
        moduleName: string,
        key: string,
        defaultValue: boolean,
        opts?: ConfigurationOpts,
    ) {
        super(moduleName, key, defaultValue, opts);
        this.assertValidDefault();
    }

    override isValid(value: boolean | null): boolean {
        return value != null && typeof value === "boolean";
    }
}

export class BooleanStyleConfiguration extends StyleConfiguration<
    boolean,
    typeof BooleanConfiguration
>(BooleanConfiguration) {
    constructor(
        moduleName: string,
        key: string,
        defaultValue: boolean,
        opts: ConfigurationOpts & StyleConfigurationOpts<boolean>,
    ) {
        super(moduleName, key, defaultValue, opts);
    }

    override apply(value: boolean): void {
        if (value === false) {
            this.styleElement.textContent = "";
        } else {
            super.apply(value);
        }
    }
}

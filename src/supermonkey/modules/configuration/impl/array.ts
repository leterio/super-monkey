import { AbstractConfiguration, type ConfigurationOpts } from "../configuration";

export class ArrayConfiguration<TYPE> extends AbstractConfiguration<TYPE[]> {
    constructor(
        moduleName: string,
        key: string,
        defaultValue: TYPE[],
        opts?: ConfigurationOpts,
    ) {
        super(moduleName, key, defaultValue, opts);
        this.assertValidDefault();
    }

    override isValid(value: TYPE[] | null): boolean {
        return value != null && Array.isArray(value);
    }
}

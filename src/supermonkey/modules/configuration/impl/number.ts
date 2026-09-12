import { AbstractConfiguration, type ConfigurationOpts } from "../configuration";
import { StyleConfiguration, type StyleConfigurationOpts } from "../style-configuration";

export type NumberConfigurationOpts = ConfigurationOpts & {
    readonly min?: number;
    readonly max?: number;
    readonly allowDecimals?: boolean;
    readonly inputSteps?: number;
};

export class NumberConfiguration extends AbstractConfiguration<number> {
    readonly min?: number;
    readonly max?: number;
    readonly allowDecimals: boolean;
    readonly inputSteps?: number;

    constructor(
        moduleName: string,
        key: string,
        defaultValue: number,
        opts?: NumberConfigurationOpts,
    ) {
        super(moduleName, key, defaultValue, opts);

        this.min = opts?.min;
        this.max = opts?.max;
        this.allowDecimals = opts?.allowDecimals ?? false;
        this.inputSteps = opts?.inputSteps;

        this.assertValidDefault();
    }

    override get value(): number {
        return super.value;
    }

    override set value(value: number | null) {
        if (value == null) {
            super.value = null;
            return;
        }

        super.value = this.normalize(value);
    }

    override isValid(value: number | null): boolean {
        if (value == null || typeof value !== "number" || !Number.isFinite(value)) {
            return false;
        }

        if (!this.allowDecimals && !Number.isInteger(value)) {
            return false;
        }

        if (this.min != null && value < this.min) {
            return false;
        }

        if (this.max != null && value > this.max) {
            return false;
        }

        return true;
    }

    private normalize(value: number): number {
        if (!this.allowDecimals) {
            return Math.round(value);
        }

        return value;
    }
}

export class NumberStyleConfiguration extends StyleConfiguration<
    number,
    typeof NumberConfiguration
>(NumberConfiguration) {
    constructor(
        moduleName: string,
        key: string,
        defaultValue: number,
        opts: NumberConfigurationOpts & StyleConfigurationOpts<number>,
    ) {
        super(moduleName, key, defaultValue, opts);
    }
}

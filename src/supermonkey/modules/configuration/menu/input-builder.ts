import { createElement } from "../../../utils/dom/elements";
import { UICSSMap } from "../../../utils/ui/ui-builder";
import { Action } from "../action";
import type { Configuration } from "../configuration";
import { BooleanConfiguration } from "../impl/boolean";
import { NumberConfiguration } from "../impl/number";
import { StringConfiguration } from "../impl/string";
import { StringSelectConfiguration } from "../impl/string-select";

export type ConfigurationInput = {
    readonly input: HTMLElement;
    readonly help?: string;
};

export function buildConfigurationInput(configuration: Configuration): ConfigurationInput {
    if (configuration instanceof NumberConfiguration) {
        return buildNumberInput(configuration);
    }

    if (configuration instanceof BooleanConfiguration) {
        return buildBooleanInput(configuration);
    }

    if (configuration instanceof StringSelectConfiguration) {
        return buildStringSelectInput(configuration);
    }

    if (configuration instanceof StringConfiguration) {
        return buildStringInput(configuration);
    }

    if (configuration instanceof Action) {
        return buildActionInput(configuration);
    }

    throw new Error(`Unsupported configuration type: ${configuration.constructor.name}`);
}

function buildBooleanInput(configuration: BooleanConfiguration): ConfigurationInput {
    const input = createElement("input", {
        type: "checkbox",
        checked: configuration.value,
    });

    input.addEventListener("change", () => {
        configuration.value = input.checked;
    });

    configuration.watch((_oldValue, newValue) => {
        input.checked = newValue;
    });

    return {
        input,
        help: buildHelp(configuration, undefined),
    };
}

function buildNumberInput(configuration: NumberConfiguration): ConfigurationInput {
    const input = createElement("input", {
        type: "number",
        value: String(configuration.value),
        step: String(configuration.inputSteps ?? 1),
    });

    if (typeof configuration.min === "number") {
        input.min = String(configuration.min);
    }

    if (typeof configuration.max === "number") {
        input.max = String(configuration.max);
    }

    input.addEventListener("blur", () => {
        const newValue = Number(input.value);

        if (Number.isNaN(newValue)) {
            input.value = String(configuration.value);
            return;
        }

        try {
            configuration.value = newValue;
        } catch {
            input.value = String(configuration.value);
        }
    });

    configuration.watch((_oldValue, newValue) => {
        input.value = String(newValue);
    });

    return {
        input,
        help: buildHelp(configuration, buildNumberHelp(configuration)),
    };
}

function buildNumberHelp(configuration: NumberConfiguration): string | undefined {
    const { min, max } = configuration;

    if (min != null && max != null) {
        return `Allowed range: ${min} to ${max}.`;
    }

    if (min != null) {
        return `Minimum value: ${min}.`;
    }

    if (max != null) {
        return `Maximum value: ${max}.`;
    }

    return undefined;
}

function buildStringInput(configuration: StringConfiguration): ConfigurationInput {
    const input = createElement("input", {
        type: "text",
        value: configuration.value,
    });

    input.addEventListener("blur", () => {
        try {
            configuration.value = input.value;
        } catch {
            input.value = configuration.value;
        }
    });

    configuration.watch((_oldValue, newValue) => {
        input.value = newValue;
    });

    return {
        input,
        help: buildHelp(configuration, undefined),
    };
}

function buildStringSelectInput(configuration: StringSelectConfiguration): ConfigurationInput {
    const optionValues = [...configuration.options];

    if (!configuration.invalidEmptyString) {
        optionValues.push("");
    }

    const selectElement = createElement("select", {
        children: optionValues.map((value) =>
            createElement("option", {
                value,
                innerText: configuration.getOptionLabel(value),
            }),
        ),
    });

    selectElement.value = configuration.value;

    selectElement.addEventListener("change", () => {
        try {
            configuration.value = selectElement.value;
        } catch {
            selectElement.value = configuration.value;
        }
    });

    configuration.watch((_oldValue, newValue) => {
        selectElement.value = newValue;
    });

    return {
        input: selectElement,
        help: buildHelp(configuration, undefined),
    };
}

function buildActionInput(action: Action): ConfigurationInput {
    const input = createElement("button", {
        type: "button",
        classList: [UICSSMap.BUTTON_CLASS],
        innerText: action.opts.label ?? action.key,
    });

    input.addEventListener("click", () => {
        void action.handler();
    });

    return { input };
}

function buildHelp(configuration: Configuration, help: string | undefined): string | undefined {
    const descriptionParts = [
        configuration instanceof Action ? configuration.opts.description : configuration.opts?.description,
        help,
    ].filter((part): part is string => part != null && part.length > 0);

    if (descriptionParts.length === 0) {
        return undefined;
    }

    return descriptionParts.join(". ");
}

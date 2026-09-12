import { joinCsv, splitCsv } from "../../../utils/string";
import { isPlainObject } from "../../../utils/type";
import type { DraftIntegrationModule } from "../draft-mappers";
import type { ModuleOptsForm } from "./module-opts-form";
import { ModuleOptsFormRegistry } from "./module-opts-form-registry";

const MODULE_KEY = "KeyboardNavigation";

const keyboardNavigationOptsForm: ModuleOptsForm = {
    moduleKey: MODULE_KEY,

    hydrate(module, opts) {
        const previousSelectors = isPlainObject(opts) && Array.isArray(opts.previousSelectors)
            ? joinCsv(opts.previousSelectors.filter((entry): entry is string => typeof entry === "string"))
            : "";
        const nextSelectors = isPlainObject(opts) && Array.isArray(opts.nextSelectors)
            ? joinCsv(opts.nextSelectors.filter((entry): entry is string => typeof entry === "string"))
            : "";
        module.keyboardNavigationOpts = { previousSelectors, nextSelectors };
        module.optsText = "";
    },

    mount(ctx) {
        const { module, host, ui, pathPrefix } = ctx;
        ensureDraft(module);
        const draft = module.keyboardNavigationOpts!;
        const id = `kn-opts-${module.instanceName || "new"}`;

        ui.field(
            host,
            `${id}-previous`,
            "Previous selectors",
            ui.textInput(draft.previousSelectors, (value) => {
                draft.previousSelectors = value;
            }),
            {
                path: `${pathPrefix}.previousSelectors`,
                help: "Comma-separated CSS selectors. Tried in order for the previous control.",
            },
        );
        ui.field(
            host,
            `${id}-next`,
            "Next selectors",
            ui.textInput(draft.nextSelectors, (value) => {
                draft.nextSelectors = value;
            }),
            {
                path: `${pathPrefix}.nextSelectors`,
                help: "Comma-separated CSS selectors. Tried in order for the next control.",
            },
        );
    },

    toOpts(module) {
        ensureDraft(module);
        const draft = module.keyboardNavigationOpts!;
        return {
            ok: true,
            value: {
                previousSelectors: splitCsv(draft.previousSelectors),
                nextSelectors: splitCsv(draft.nextSelectors),
            },
        };
    },
};

function ensureDraft(module: DraftIntegrationModule): void {
    if (module.keyboardNavigationOpts == null) {
        module.keyboardNavigationOpts = {
            previousSelectors: "",
            nextSelectors: "",
        };
    }
}

ModuleOptsFormRegistry.register(keyboardNavigationOptsForm);

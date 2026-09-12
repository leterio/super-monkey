import { isPlainObject } from "../../../utils/type";
import type { DraftIntegrationModule } from "../draft-mappers";
import { ModuleOptsFormRegistry } from "./module-opts-form-registry";
import "./register-builtin-opts-forms";

/**
 * Clears typed opts drafts and fills fields for the current module key.
 */
export function hydrateModuleOpts(
    module: DraftIntegrationModule,
    opts: unknown | undefined,
): void {
    delete module.keyboardNavigationOpts;
    delete module.historyOpts;
    delete module.customCssOpts;
    delete module.jsSnippetsOpts;
    delete module.additionalPagesOpts;
    delete module.resourcesDownloaderOpts;
    module.optsText = "";

    const form = ModuleOptsFormRegistry.get(module.module);
    if (form != null) {
        form.hydrate(module, opts);
        return;
    }

    if (opts != null && isPlainObject(opts)) {
        module.optsText = JSON.stringify(opts, null, 2);
    }
}

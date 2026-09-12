import type { IntegrationValidationIssue } from "../../integration-validation";
import type { DraftIntegrationModule } from "../draft-mappers";
import type { EditorUiHelpers } from "../editor-ui-helpers";

/**
 * Context for mounting a typed module-opts form in the Modules section.
 */
export type ModuleOptsFormContext = {
    readonly module: DraftIntegrationModule;
    readonly host: HTMLElement;
    readonly ui: EditorUiHelpers;
    /** Validation path prefix for opts fields (for example `modules.foo.opts`). */
    readonly pathPrefix: string;
    requestRerender(): void;
};

/**
 * Typed opts UI for one ModuleLoader key.
 * Unregistered keys keep the Options (JSON) textarea.
 */
export type ModuleOptsForm = {
    readonly moduleKey: string;
    /**
     * Fills typed draft fields from Integration opts (or empty defaults).
     */
    hydrate(module: DraftIntegrationModule, opts: unknown | undefined): void;
    mount(ctx: ModuleOptsFormContext): void;
    /**
     * Builds the Integration `opts` object for Save/Import.
     */
    toOpts(module: DraftIntegrationModule):
        | { ok: true; value: Record<string, unknown> }
        | { ok: false; issues: IntegrationValidationIssue[] };
};
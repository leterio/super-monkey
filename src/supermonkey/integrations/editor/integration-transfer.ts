import { pickTextFile, saveJson } from "../../utils/file";
import { Logger } from "../../utils/logger";
import {
    IntegrationValidationIssue,
    validateIntegration,
} from "../integration-validation";
import { IntegrationsRegistry } from "../integrations-registry";
import { Integration } from "../metadata";
import {
    DraftIntegration,
    draftToIntegration,
    emptyDraft,
    unknownToDraft,
} from "./draft-mappers";
import {
    confirmBeforeKeyCleanup,
    moduleInstanceNames,
    planModuleConfigPurge,
    purgeRemovedModuleConfigs,
} from "./integration-config-cleanup";
import { IntegrationEditorModal } from "./integration-editor-modal";

export class IntegrationTransfer {
    private static readonly log: Logger = new Logger("IntegrationTransfer");

    private constructor() { }

    static export(integration: Integration): void {
        saveJson(integration, `${integration.name}-sm-integration.json`);
        this.log.info("Exported integration", integration.name);
        alert("Integration exported.");
    }

    static async import(): Promise<void> {
        const rawText = await pickTextFile();
        if (rawText == null) {
            alert("Invalid integration file.");
            return;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            IntegrationEditorModal.openCreateFromImport(emptyDraft(), [{
                path: "",
                message: "File content is not valid JSON.",
            }]);
            return;
        }

        const draft = unknownToDraft(parsed);
        const outcome = this.validateDraft(draft);

        if (!outcome.ok) {
            IntegrationEditorModal.openCreateFromImport(draft, outcome.issues);
            return;
        }

        const existing = IntegrationsRegistry.getByName(outcome.value.name);
        if (existing != null) {
            const { modulesToPurge } = planModuleConfigPurge(
                outcome.value.name,
                moduleInstanceNames(existing),
                moduleInstanceNames(outcome.value),
            );

            if (!confirmBeforeKeyCleanup(
                outcome.value.name,
                {
                    modulesToPurge,
                    purgeAllIntegrationConfigs: false,
                },
                `An integration named "${outcome.value.name}" already exists. Replace it?`,
            )) {
                this.log.debug("Import cancelled; replace / key cleanup declined");
                return;
            }

            IntegrationsRegistry.upsertStored(outcome.value);
            purgeRemovedModuleConfigs(outcome.value.name, modulesToPurge);
        } else {
            IntegrationsRegistry.upsertStored(outcome.value);
        }

        this.log.info("Imported integration", outcome.value.name);
        IntegrationEditorModal.closeOpen();
        alert("Reload the page to apply the changes.");
    }

    private static validateDraft(draft: DraftIntegration):
        | { ok: true; value: Integration }
        | { ok: false; issues: IntegrationValidationIssue[] } {
        const built = draftToIntegration(draft);
        if (!built.ok) {
            return built;
        }

        const existingNames = new Set(
            IntegrationsRegistry.getEffective().map((integration) => integration.name),
        );
        const mode = existingNames.has(built.value.name) ? "edit" : "create";
        const result = validateIntegration(built.value, { mode, existingNames });
        if (!result.valid || result.value == null) {
            return { ok: false, issues: result.issues };
        }

        return { ok: true, value: result.value };
    }
}

import {
    deleteIntegrationConfigKeys,
    deleteModuleConfigKeys,
    integrationConfigKeyPrefix,
    listKeysWithPrefix,
    moduleConfigKeyPrefix,
    renameModuleConfigKeys,
} from "../../utils/value";
import { Integration } from "../metadata";
import { DraftIntegrationModule } from "./draft-mappers";

export type ModuleConfigRename = {
    readonly from: string;
    readonly to: string;
};

export type KeyCleanupScope = {
    readonly modulesToPurge: readonly string[];
    readonly purgeAllIntegrationConfigs: boolean;
};

export function moduleInstanceNames(integration: Integration | undefined): Set<string> {
    if (integration?.modules == null) {
        return new Set();
    }
    return new Set(Object.keys(integration.modules));
}

export function collectModuleConfigRenames(
    modules: readonly DraftIntegrationModule[],
): ModuleConfigRename[] {
    const renames: ModuleConfigRename[] = [];
    for (const module of modules) {
        const from = module.originalName?.trim() ?? "";
        const to = module.instanceName.trim();
        if (from.length === 0 || to.length === 0 || from === to) {
            continue;
        }
        renames.push({ from, to });
    }
    return renames;
}

export function collectRemovedOriginalModuleNames(
    previousModuleNames: ReadonlySet<string>,
    modules: readonly DraftIntegrationModule[],
): string[] {
    const survivingOriginals = new Set(
        modules
            .map((module) => module.originalName?.trim() ?? "")
            .filter((name) => name.length > 0),
    );
    return [...previousModuleNames]
        .filter((name) => !survivingOriginals.has(name))
        .sort();
}

export function modulesWithOrphanConfigKeys(
    integrationName: string,
    moduleNames: readonly string[],
): string[] {
    return moduleNames.filter((moduleName) => {
        try {
            return listKeysWithPrefix(moduleConfigKeyPrefix(integrationName, moduleName)).length > 0;
        } catch {
            return false;
        }
    });
}

export function integrationHasConfigKeys(integrationName: string): boolean {
    try {
        return listKeysWithPrefix(integrationConfigKeyPrefix(integrationName)).length > 0;
    } catch {
        return false;
    }
}

export function keyCleanupRequired(scope: KeyCleanupScope): boolean {
    return scope.purgeAllIntegrationConfigs || scope.modulesToPurge.length > 0;
}

/**
 * Single confirm for any flow that will delete configuration keys.
 * Merges optional action context (replace / restore / delete) so callers avoid stacked dialogs.
 * Returns true when there is nothing to confirm, or the user accepts.
 */
export function confirmBeforeKeyCleanup(
    integrationName: string,
    scope: KeyCleanupScope,
    actionSummary?: string,
): boolean {
    const needsCleanup = keyCleanupRequired(scope);
    if (!needsCleanup) {
        if (actionSummary == null || actionSummary.length === 0) {
            return true;
        }
        return window.confirm(`${actionSummary}\n\nContinue?`);
    }

    const sections: string[] = [];
    if (actionSummary != null && actionSummary.length > 0) {
        sections.push(actionSummary);
    }

    if (scope.purgeAllIntegrationConfigs) {
        sections.push(
            `All related configuration values for "${integrationName}" will be permanently deleted and cannot be recovered.`,
        );
    } else {
        const listed = scope.modulesToPurge.map((name) => `• ${name}`).join("\n");
        sections.push(
            `Configuration values for the following module instance(s) on "${integrationName}" will be permanently deleted and cannot be recovered:\n\n${listed}`,
        );
    }

    sections.push(
        `Before continuing, close every other browser tab that is running Super Monkey for this integration ("${integrationName}").`,
        "Tabs left open may keep writing under the old keys and recreate orphan configuration data after cleanup.",
        "Close those tabs now, then choose OK to proceed with key cleanup (Cancel aborts).",
    );

    return window.confirm(sections.join("\n\n"));
}

export function applyModuleConfigRenames(
    integrationName: string,
    renames: readonly ModuleConfigRename[],
): void {
    for (const rename of renames) {
        renameModuleConfigKeys(integrationName, rename.from, rename.to);
    }
}

export function purgeRemovedModuleConfigs(
    integrationName: string,
    moduleNames: readonly string[],
): void {
    for (const moduleName of moduleNames) {
        deleteModuleConfigKeys(integrationName, moduleName);
    }
}

export function planEditorModuleConfigChanges(
    integrationName: string,
    previousModules: ReadonlySet<string>,
    draftModules: readonly DraftIntegrationModule[],
): { renames: ModuleConfigRename[]; modulesToPurge: string[] } {
    const renames = collectModuleConfigRenames(draftModules);
    const removed = collectRemovedOriginalModuleNames(previousModules, draftModules);
    const modulesToPurge = modulesWithOrphanConfigKeys(integrationName, removed);
    return { renames, modulesToPurge };
}

export function planModuleConfigPurge(
    integrationName: string,
    previousModules: ReadonlySet<string>,
    nextModules: ReadonlySet<string>,
): { modulesToPurge: string[] } {
    const removed = [...previousModules].filter((name) => !nextModules.has(name)).sort();
    return {
        modulesToPurge: modulesWithOrphanConfigKeys(integrationName, removed),
    };
}

export function purgeAllIntegrationConfigs(integrationName: string): void {
    deleteIntegrationConfigKeys(integrationName);
}

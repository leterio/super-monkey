import { Logger } from "../utils/logger";
import { formatOptsFinding } from "../utils/opts/normalization";
import { BuiltinIntegrations } from "./builtin/builtin";
import { Integration } from "./metadata";
import { normalizeStoredIntegration } from "./store/normalize-stored-integration";
import { UserIntegrationsStore } from "./store/user-integrations-store";

/** How an effective integration name entered the registry. */
export type IntegrationProvenance = "builtin" | "user" | "override";

/**
 * Merged view of built-in and user-stored integrations.
 * Stored entries override built-ins with the same name.
 */
export class IntegrationsRegistry {
    private static readonly log: Logger = new Logger("IntegrationsRegistry");

    private constructor() { }

    /** Built-in integrations in declaration order (normalized; rejects skipped). */
    static getBuiltins(): Integration[] {
        const integrations: Integration[] = [];
        for (const integration of BuiltinIntegrations.getIntegrations()) {
            const normalized = normalizeStoredIntegration(integration, integration.name);
            if (normalized.value == null) {
                this.log.warn(
                    "Skipping built-in integration:",
                    integration.name,
                    normalized.findings.map(formatOptsFinding).join(""),
                );
                continue;
            }
            if (normalized.findings.length > 0) {
                this.log.warn(
                    "Built-in integration repaired:",
                    normalized.value.name,
                    normalized.findings.map(formatOptsFinding).join(""),
                );
            }
            integrations.push(normalized.value);
        }
        return integrations;
    }

    /** Normalized user-stored integrations keyed by integration name. */
    static getStoredMap(): Record<string, Integration> {
        const integrations: Record<string, Integration> = {};
        for (const [mapKey, stored] of Object.entries(UserIntegrationsStore.loadAll())) {
            const normalized = normalizeStoredIntegration(stored, mapKey);
            if (normalized.value != null) {
                integrations[normalized.value.name] = normalized.value;
            }
        }
        return integrations;
    }

    /** Built-ins plus user storage, keyed by integration name. */
    static getEffective(): Integration[] {
        const byName = new Map<string, Integration>();

        for (const integration of this.getBuiltins()) {
            byName.set(integration.name, integration);
        }

        for (const [mapKey, stored] of Object.entries(UserIntegrationsStore.loadAll())) {
            const normalized = normalizeStoredIntegration(stored, mapKey);
            if (normalized.value == null) {
                this.log.warn(
                    "Skipping stored integration:",
                    mapKey,
                    normalized.findings.map(formatOptsFinding).join(""),
                );
                continue;
            }

            if (normalized.findings.length > 0) {
                this.log.warn(
                    "Stored integration repaired:",
                    normalized.value.name,
                    normalized.findings.map(formatOptsFinding).join(""),
                );
            }

            byName.set(normalized.value.name, normalized.value);
        }

        return Array.from(byName.values());
    }

    /** Effective integration with the given name, if any. */
    static getByName(name: string): Integration | undefined {
        return this.getEffective().find((integration) => integration.name === name);
    }

    /**
     * Provenance of `name` from built-ins and storage (on-demand; no prior {@link getEffective} required).
     */
    static getProvenance(name: string): IntegrationProvenance | undefined {
        const hasBuiltin = BuiltinIntegrations.getIntegrations().some(
            (integration) => integration.name === name,
        );
        const hasStored = UserIntegrationsStore.has(name);

        if (hasBuiltin && hasStored) {
            return "override";
        }
        if (hasBuiltin) {
            return "builtin";
        }
        if (hasStored) {
            return "user";
        }
        return undefined;
    }

    /** Persists or replaces a user-stored integration. */
    static upsertStored(integration: Integration): void {
        UserIntegrationsStore.put(integration);
    }

    /** Removes a user-stored integration by name. */
    static removeStored(name: string): boolean {
        return UserIntegrationsStore.remove(name);
    }
}

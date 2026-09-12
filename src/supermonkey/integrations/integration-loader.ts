import { Logger } from "../utils/logger";
import { isValidId } from "../utils/string";
import { hostnameMatchesDomains } from "../utils/urls";
import { IntegrationsRegistry } from "./integrations-registry";
import { Integration } from "./metadata";

/**
 * Resolves the active integration for the current page hostname.
 */
export class IntegrationLoader {
    private static readonly log: Logger = new Logger("IntegrationLoader");

    /**
     * Matches the hostname against the effective registry and returns the first match.
     * When several integrations match, the first registry entry wins and a warning is logged.
     * @returns The matched integration, or `undefined` when none match or `hostname` is missing.
     * @throws When the matched integration `name` is not a valid id segment
     */
    static load(hostname: string | undefined): Integration | undefined {
        if (hostname == null) {
            this.log.warn("No hostname provided. Skipping integration loading.");
            return undefined;
        }

        this.log.debug("Finding matching integration");

        const integration = this.pickMatchingIntegration(hostname);

        if (integration == null) {
            this.log.warn("No integrations matched the current page. Feel free to create a new one!");
            return undefined;
        }

        if (!isValidId(integration.name)) {
            throw new Error(
                `Invalid integration name: "${integration.name}". `
                + "Name must be a single id segment ([A-Za-z0-9_-]+) and cannot be sanitized.",
            );
        }

        this.log.info("Matched integration:", integration.name);
        return integration;
    }

    private static pickMatchingIntegration(hostname: string): Integration | undefined {
        const matching = this.findMatchingIntegrations(hostname);
        if (matching.length > 1) {
            this.log.warn(
                "Multiple integrations matched the hostname; using the first one.",
                ...matching.map((integration) => `"${integration.name}"`),
            );
        }

        return matching[0];
    }

    private static findMatchingIntegrations(hostname: string): Integration[] {
        return IntegrationsRegistry.getEffective().filter((integration) =>
            hostnameMatchesDomains(hostname, integration.matchedDomains),
        );
    }
}

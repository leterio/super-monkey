import { Logger } from "../utils/logger";
import { formatOptsFinding } from "../utils/opts/normalization";
import { ContentManager } from "./content-manager";
import { normalizeContentManagerOpts } from "./content-manager-opts";

/**
 * Loads at most one {@link ContentManager} per tab from integration options.
 */
export class ContentManagerLoader {
    private static readonly log: Logger = new Logger("ContentManagerLoader");

    private static loaded: boolean = false;
    private static instance: ContentManager | undefined;

    private constructor() { }

    static load(contentManagerOpts: unknown): ContentManager | undefined {
        if (this.loaded == true) {
            this.log.error("Content manager already loaded; Not attempting to load again.");
            return this.instance;
        }
        this.loaded = true;

        try {
            this.loadFromOpts(contentManagerOpts);
        } catch (error) {
            this.failLoad(error);
        }

        return this.instance;
    }

    private static loadFromOpts(contentManagerOpts: unknown): void {
        if (contentManagerOpts == null) {
            this.instance = undefined;
            this.log.debug("Content manager not configured; Skipping content manager load.");
            return;
        }

        const normalized = normalizeContentManagerOpts(contentManagerOpts);
        if (normalized.value == null) {
            this.failLoad(
                new Error(
                    `Content manager options were rejected.${normalized.findings.map(formatOptsFinding).join("")}`,
                ),
            );
            return;
        }

        if (normalized.findings.length > 0) {
            this.log.warn(
                "Content manager options were repaired:",
                normalized.findings.map(formatOptsFinding).join(""),
            );
        }

        this.instance = new ContentManager(normalized.value);
        this.log.debug("Content manager successfully loaded");
    }

    private static failLoad(error: unknown): void {
        this.instance = undefined;
        this.log.fatal(
            "Failed to load content manager",
            error,
            "Please check the integration configuration and content manager options.",
        );
    }
}

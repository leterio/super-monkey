import { SCRIPT_FULL_NAME } from "./constants";
import { ContentManagerLoader } from "./content-manager/content-manager-loader";
import { EventBus } from "./event-bus/event-bus";
import { createGetActivePages } from "./integrations/mapped-pages";
import { IntegrationLoader } from "./integrations/integration-loader";
import { IntegrationsMenu } from "./integrations/menu/integrations-menu";
import { LoadedIntegration } from "./integrations/metadata";
import { BeforeUnloadEventPayload, IntegrationLoadedEventPayload, LifecycleAwareEvent } from "./lifecycle/events";
import { ModuleLoader } from "./modules/module-loader";
import { Logger } from "./utils/logger";
import { trimToUndefined } from "./utils/string";

/**
 * Script entry orchestrator: resolves the integration, loads Content Manager and modules,
 * then publishes lifecycle events for the tab.
 */
export class SuperMonkey {
    private static readonly log: Logger = new Logger(SCRIPT_FULL_NAME);
    private static initialized: boolean = false;
    private static _loadedIntegration: LoadedIntegration | undefined;

    /** Active integration for this tab, or `undefined` when no hostname matched. */
    static get loadedIntegration(): LoadedIntegration | undefined {
        return this._loadedIntegration;
    }

    /**
     * Boots the userscript once per tab.
     * Registers the integrations menu command, then resolves the integration.
     * Returns when already initialized or when no hostname matches.
     */
    static async run(): Promise<void> {
        if (this.initialized) {
            this.log.error(`${SCRIPT_FULL_NAME} already initialized; Not attempting to run again.`);
            return;
        }
        this.initialized = true;

        try {
            this.log.info(`Starting ${SCRIPT_FULL_NAME} ...`);
            this.log.trace("Initialization stage: 1");

            IntegrationsMenu.registerMenuCommands();

            const integration = IntegrationLoader.load(this.getTabUrlHostname());
            if (integration == null) {
                this.log.trace("Initialization aborted on stage 1: No matching integration found.");
                return;
            }
            this._loadedIntegration = {
                name: integration.name,
                getActivePages: createGetActivePages(integration.mappedPages),
            };

            this.log.trace("Initialization stage: 2");
            const contentManager = ContentManagerLoader.load(integration.contentManager);
            this._loadedIntegration = { ...this._loadedIntegration, contentManager };

            this.log.trace("Initialization stage: 3");
            const modules = ModuleLoader.load(integration);
            this._loadedIntegration = { ...this._loadedIntegration, modules };

            this.log.trace("Initialization stage: 4");
            this.log.debug("Waiting for page to load ...");
            await this.awaitForIntegrationLoaded();

            this.log.trace("Initialization stage: 6");
            this.bindBeforeUnload();

            this.log.trace("Initialization stage: 7");
            this.log.debug(`${SCRIPT_FULL_NAME} initialized successfully`);
        } catch (error) {
            this.log.error(`Failed to init ${SCRIPT_FULL_NAME}.`, error instanceof Error ? error.message : String(error));
        }
    }

    private static awaitForIntegrationLoaded(): Promise<void> {
        return new Promise((resolve) => {
            if (document.readyState !== "loading") {
                this.log.trace("Initialization stage: 5");
                this.dispatchIntegrationLoaded();
                resolve();
            } else {
                document.addEventListener("DOMContentLoaded", async () => {
                    this.log.trace("Initialization stage: 5");
                    this.dispatchIntegrationLoaded();
                    resolve();
                });
            }
        });
    }

    private static dispatchIntegrationLoaded(): void {
        this.log.debug("Page ready; Dispatching integration loaded event ...");

        EventBus.publish<IntegrationLoadedEventPayload>(LifecycleAwareEvent.INTEGRATION_LOADED, {
            document: window.document,
        });
    }

    private static bindBeforeUnload(): void {
        this.log.debug("Binding before unload event ...");
        window.addEventListener("beforeunload", async (event: BeforeUnloadEvent) => {
            this.log.debug("Before unload event triggered; Dispatching before unload event ...");
            await EventBus.publish<BeforeUnloadEventPayload>(LifecycleAwareEvent.BEFORE_UNLOAD, {
                notifyPendingOperations: () => {
                    this.log.debug("Notifying pending operations ...");
                    event.preventDefault();
                },
            });
        });
    }

    private static getTabUrlHostname(): string | undefined {
        const hostname = window.location.hostname;
        return trimToUndefined(hostname);
    }
}

import { EventBus } from "../event-bus/event-bus";
import { Logger } from "../utils/logger";
import { trimToUndefined } from "../utils/string";
import {
    BeforeUnloadEventPayload,
    ContentLoadedEventPayload,
    IntegrationLoadedEventPayload,
    LifecycleAwareEvent,
} from "./events";

/**
 * Base class for components that need to subscribe to lifecycle events.
 * Construction registers {@link LifecycleAwareEvent} handlers that forward to the hooks below.
 */
export class Component {
    /** Logger scoped to this component name. */
    protected readonly log: Logger;

    /** Component name. */
    readonly name: string;

    /**
     * @param name - Component name.
     * @throws When `name` is null or empty.
     */
    constructor(name: string) {
        const trimmedName = trimToUndefined(name);
        if (trimmedName == null) {
            throw new Error("Component name is required");
        }

        this.name = trimmedName;
        this.log = new Logger(this.name);

        EventBus.subscribe<IntegrationLoadedEventPayload>(
            LifecycleAwareEvent.INTEGRATION_LOADED,
            async (event) => {
                if (event.data != null) {
                    await this.onIntegrationLoaded(event.data);
                }
            });
        EventBus.subscribe<ContentLoadedEventPayload>(
            LifecycleAwareEvent.CONTENT_LOADED,
            async (event) => {
                if (event.data != null) {
                    await this.onContentLoaded(event.data);
                }
            });
        EventBus.subscribe<BeforeUnloadEventPayload>(
            LifecycleAwareEvent.BEFORE_UNLOAD,
            async (event) => {
                if (event.data != null) {
                    await this.onBeforeUnload(event.data);
                }
            });
    }

    /**
     * Runs after {@link LifecycleAwareEvent.INTEGRATION_LOADED}.
     * Use for DOM chrome and other work that does not depend on Content Manager.
     */
    //@ts-ignore
    protected async onIntegrationLoaded(data: IntegrationLoadedEventPayload): Promise<void> { }

    /**
     * Runs after {@link LifecycleAwareEvent.CONTENT_LOADED}.
     * Use for content-dependent work. Content Manager owns and publishes this event.
     */
    //@ts-ignore
    protected async onContentLoaded(data: ContentLoadedEventPayload): Promise<void> { }

    /** Runs after {@link LifecycleAwareEvent.BEFORE_UNLOAD}. */
    //@ts-ignore
    protected async onBeforeUnload(data: BeforeUnloadEventPayload): Promise<void> { }
}

import { ContentManagerEvents, EntitiesInjectedEventPayload, EntitiesParsedEventPayload, EntityViewedEventPayload } from "../content-manager/events";
import { EventBus } from "../event-bus/event-bus";
import { Component } from "../lifecycle/component";
import { isValidComposedId } from "../utils/string";
import type { Configuration } from "./configuration/configuration";
import type { NotificationEntry } from "./notification-bar/entries/notification-entry";

/**
 * Feature-specific options passed to a {@link Module} constructor.
 * Title and description live on {@link Module#title} / {@link Module#description}.
 */
export type ModuleOpts = {};

/**
 * Base class for feature modules loaded by {@link ModuleLoader}.
 *
 * Each integration instance receives a composed `name` (`{integration}::{instance}`)
 * and typed `opts`. Override lifecycle and content-pipeline hooks as needed; default
 * implementations are no-ops. The constructor registers EventBus subscriptions for those hooks.
 *
 * @template OPTS - Module options shape; defaults to {@link ModuleOpts}.
 */
export class Module<OPTS extends ModuleOpts = ModuleOpts> extends Component {
    /**
     * @param name - Composed instance id (`{integration}::{instance}`).
     * @param opts - Feature options from the integration entry (plus any subclass defaults).
     * @throws When `name` is not a valid composed id.
     */
    constructor(
        name: string,
        readonly opts: OPTS,
    ) {
        super(name);

        if (!isValidComposedId(this.name)) {
            throw new Error(`Invalid module name: "${name}"`);
        }

        EventBus.subscribe<EntityViewedEventPayload>(
            ContentManagerEvents.ENTITY_VIEWED,
            async (event) => {
                if (event.data != null) {
                    await this.onEntityViewed(event.data);
                }
            });
        EventBus.subscribe<EntitiesParsedEventPayload>(
            ContentManagerEvents.ENTITIES_PARSED,
            async (event) => {
                if (event.data != null) {
                    await this.onEntitiesParsed(event.data);
                }
            });
        EventBus.subscribe<EntitiesInjectedEventPayload>(
            ContentManagerEvents.ENTITIES_INJECTED,
            async (event) => {
                if (event.data != null) {
                    await this.onEntitiesInjected(event.data);
                }
            });
    }

    /**
     * Stored preferences and actions exposed by this module.
     * Override to return {@link Configuration} instances constructed with `this.name`.
     */
    get configurations(): Configuration[] {
        return [];
    }

    /**
     * Notification Bar entries exposed by this module.
     * Override to return {@link NotificationEntry} instances.
     */
    get notifications(): NotificationEntry[] {
        return [];
    }

    /**
     * Module section title.
     */
    get title(): string {
        return this.name;
    }

    /**
     * Module section description.
     */
    get description(): string | undefined {
        return undefined;
    }

    /** Runs after {@link ContentManagerEvents.ENTITY_VIEWED}. */
    //@ts-ignore
    protected async onEntityViewed(data: EntityViewedEventPayload): Promise<void> { }

    /** Runs after {@link ContentManagerEvents.ENTITIES_PARSED}. */
    //@ts-ignore
    protected async onEntitiesParsed(data: EntitiesParsedEventPayload): Promise<void> { }

    /** Runs after {@link ContentManagerEvents.ENTITIES_INJECTED}. */
    //@ts-ignore
    protected async onEntitiesInjected(data: EntitiesInjectedEventPayload): Promise<void> { }
}

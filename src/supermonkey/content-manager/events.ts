/**
 * Content Manager event type strings published on {@link EventBus}.
 */
export enum ContentManagerEvents {
    /** A view config resolved a content id on the current page. */
    ENTITY_VIEWED = "entity-viewed",
    /** Listed entities were discovered, before DOM changes from Content Manager. */
    ENTITIES_PARSED = "entities-parsed",
    /** Listed entities that remain on the page after parsing and apply. */
    ENTITIES_INJECTED = "entities-injected",
}

/**
 * Stable identity of a mapped content item within a Content Manager group.
 */
export type Entity = {
    /** Stable id within the Content Manager group. */
    readonly id: string;
    /** Content Manager group key that owns this entity. */
    readonly group: string;
    /** Name of the view or listing config that produced this entity. */
    readonly name: string;
    /** Managed DOM node when available. */
    readonly element?: HTMLElement;
};

/**
 * A listed entity during the parse pass.
 * Handlers for {@link ContentManagerEvents.ENTITIES_PARSED} may set `hide` to drop the node afterward.
*/
export type ListedEntity = Entity & {
    /** When `true` after {@link ContentManagerEvents.ENTITIES_PARSED}, the node is dropped. */
    hide?: boolean;
    readonly element: HTMLElement;
};

/** Payload for {@link ContentManagerEvents.ENTITY_VIEWED}. */
export type EntityViewedEventPayload = {
    readonly entity: Entity;
};

/** Payload for {@link ContentManagerEvents.ENTITIES_PARSED}. Keys are Content Manager group names. */
export type EntitiesParsedEventPayload = {
    readonly entities: Map<string, ListedEntity[]>;
};

/**
 * Payload for {@link ContentManagerEvents.ENTITIES_INJECTED}.
 * Keys are Content Manager group names. Entities that remain on the page after apply, with their managed element.
 */
export type EntitiesInjectedEventPayload = {
    readonly entities: Map<string, ListedEntity[]>;
};

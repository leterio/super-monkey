/**
 * Payload for {@link LifecycleAwareEvent.INTEGRATION_LOADED}.
 */
export type IntegrationLoadedEventPayload = {
    /** Live tab document, ready for DOM chrome. */
    readonly document: Document;
};

/**
 * Payload for {@link LifecycleAwareEvent.CONTENT_LOADED}.
 * Published by Content Manager when a content document is ready to scan.
 */
export type ContentLoadedEventPayload = {
    /** Document that finished loading (live tab or a fetched page). */
    readonly document: Document;
};

/**
 * Payload for {@link LifecycleAwareEvent.BEFORE_UNLOAD}.
 */
export type BeforeUnloadEventPayload = {
    /**
     * Signals pending work to the browser unload dialog.
     * Call synchronously from the handler; deferred calls may be ignored.
     */
    readonly notifyPendingOperations: () => void;
};

/** Lifecycle event type strings published on {@link EventBus}. */
export enum LifecycleAwareEvent {
    /** Fired once when the integration is loaded and the tab document is ready for chrome. */
    INTEGRATION_LOADED = "integration-loaded",
    /**
     * Fired when a content document is ready.
     * Owned by Content Manager; emitted only when Content Manager is loaded.
     */
    CONTENT_LOADED = "content-loaded",
    /** Fired when the tab is about to unload. */
    BEFORE_UNLOAD = "before-unload",
}

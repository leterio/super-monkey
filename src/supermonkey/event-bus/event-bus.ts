import { Logger } from "../utils/logger";

/**
 * Payload delivered to event handlers.
 * @template T - Optional event data type
 */
export type EventBusEvent<T = unknown> = {
    readonly type: string;
    readonly data?: T;
};

/**
 * Async handler invoked when a matching event is published.
 * @template T - Optional event data type
 */
export type EventBusEventHandler<T = unknown> = (event: EventBusEvent<T>) => Promise<void>;

/**
 * Process-wide pub/sub bus. Use the static API only; event type strings are
 * trimmed and lowercased before subscribe and publish match.
 */
export class EventBus {
    private static readonly log: Logger = new Logger("EventBus");
    private static readonly handlers = new Map<string, Set<EventBusEventHandler<unknown>>>();

    private constructor() { }

    /**
     * Registers a handler for an event type. Ignores invalid types and non-function handlers.
     * @template T - Event payload type
     */
    static subscribe<T>(type: string, handler: EventBusEventHandler<T>): void {
        const normalizedType = EventBus.normalizeType(type);

        if (!normalizedType) {
            EventBus.log.warn("subscribe ignored: invalid event type", type);
            return;
        }

        if (typeof handler !== "function") {
            EventBus.log.warn("subscribe ignored: handler is not a function", normalizedType);
            return;
        }

        let typeHandlers = EventBus.handlers.get(normalizedType);

        if (!typeHandlers) {
            typeHandlers = new Set();
            EventBus.handlers.set(normalizedType, typeHandlers);
        }

        typeHandlers.add(handler as EventBusEventHandler<unknown>);
    }

    /**
     * Delivers an event to all handlers for the type in parallel.
     * Handler failures are logged and do not reject the publish.
     * @template T - Event payload type
     */
    static async publish<T>(type: string, data?: T): Promise<void> {
        const normalizedType = EventBus.normalizeType(type);
        if (!normalizedType) {
            EventBus.log.warn("publish ignored: invalid event type", type);
            return;
        }

        const typeHandlers = EventBus.handlers.get(normalizedType);

        EventBus.log.debug(
            "Publishing event",
            normalizedType,
            `(${typeHandlers?.size ?? 0} handler(s))`,
        );

        if (typeHandlers == null || typeHandlers.size === 0) {
            return;
        }

        if (Logger.isTraceEnabled() && data !== undefined) {
            EventBus.log.trace("Event payload:", normalizedType, data as object);
        }

        const event: EventBusEvent<T> = { type: normalizedType, data };

        await Promise.all(
            [...typeHandlers].map((handler) => EventBus.invokeHandler(handler, event, normalizedType))
        );
    }

    private static async invokeHandler<T>(
        handler: EventBusEventHandler<unknown>,
        event: EventBusEvent<T>,
        type: string
    ): Promise<void> {
        try {
            await handler(event);
        } catch (error) {
            EventBus.log.error("handler threw", type, error instanceof Error ? error.message : String(error));
        }
    }

    private static normalizeType(type: string): string | null {
        if (type == null || typeof type !== "string") {
            return null;
        }

        const normalized = type.trim().toLowerCase();
        return normalized.length > 0 ? normalized : null;
    }
}

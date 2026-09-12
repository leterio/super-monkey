/** Lifecycle state for a downloadable or processable item. */
export enum ItemState {
    PENDING = "pending",
    PROGRESS = "progress",
    DONE = "done",
    ERROR = "error",
    SKIPPED = "skipped",
    CANCELLED = "cancelled",
}

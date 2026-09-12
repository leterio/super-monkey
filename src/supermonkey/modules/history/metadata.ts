/** Per-entry history state written to {@link HISTORY_METADATA_KEY}. */
export const enum HistoryState {
    VIEWED = "viewed",
    LISTED = "listed",
    UNREAD = "unread",
}

/** DOM attribute carrying {@link HistoryState} on managed entry elements. */
export const HISTORY_METADATA_KEY = "data-sm-history";

/**
 * Marker set when new-content selectors match an entry.
 * Hide rules can spare the entry while this attribute is `"true"`.
 */
export const HAS_NEW_CONTENT_METADATA_KEY = "data-sm-has-new-content";

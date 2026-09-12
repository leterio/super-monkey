import { ItemState } from "../item-state";

/**
 * Sets or clears `data-state` on `element` from an {@link ItemState}.
 * `PENDING` removes the attribute.
 */
export function applyDataState(
    element: HTMLElement | null | undefined,
    state: ItemState,
): void {
    if (element == null) {
        return;
    }

    if (state === ItemState.PENDING) {
        element.removeAttribute("data-state");
        return;
    }

    element.setAttribute("data-state", state);
}

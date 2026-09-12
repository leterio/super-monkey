import { injectPanel, injectSection, UICSSMap } from "../../../../utils/ui/ui-builder";
import { applyDataState } from "../../../../utils/ui/ui-state";
import { debounce } from "../../../../utils/debouncer";
import { injectElement } from "../../../../utils/dom/elements";
import { randomString } from "../../../../utils/string";
import { ItemState } from "../../../../utils/item-state";
import { NotificationEntry, NotificationEntryOpts } from "../notification-entry";
import { ProgressItemHandle } from "./progress-item";
import css from "./progress-menu.css?raw";

export enum CSSMap {
    ROOT_CLASS = "sm-pgmenu",

    BUTTONS_CONTAINER_CLASS = `${ROOT_CLASS}-buttons`,

    ITEM_CLASS = `${ROOT_CLASS}-item`,
    ITEM_LABEL_CLASS = "item-label",
    ITEM_STATUS_CLASS = "item-status",
    ITEM_RETRY_CLASS = "retry",
    ITEM_CANCEL_CLASS = "cancel",
    ITEM_PROGRESS_CSS_VAR = `--${ITEM_CLASS}-progress`,
}

type ProgressMenuItem = {
    state: ItemState;
    readonly element: HTMLElement;
    readonly labelElement: HTMLElement;
    readonly statusElement: HTMLElement;
    cancelElement?: HTMLElement;
    retryElement?: HTMLElement;
    progressPercent: number;
    destroyed: boolean;
    readonly onRetry?: () => void;
    readonly onCancel?: () => void;
};

export type ProgressMenuAdditionalButton = {
    readonly label: string;
    readonly onClick: () => void;
    readonly title?: string;
};

export type ProgressMenuEntryOpts = NotificationEntryOpts & {
    additionalButtons?: readonly ProgressMenuAdditionalButton[];
};

export type ProgressMenuMapItemOpts = {
    onRetry?: () => void;
    onCancel?: () => void;
};

export class ProgressMenuEntry extends NotificationEntry<ProgressMenuEntryOpts> {
    private readonly items: Set<ProgressMenuItem> = new Set();
    private itemsContainer?: HTMLElement;

    constructor(
        iconSvgRaw: string,
        private readonly title: string,
        opts?: ProgressMenuEntryOpts,
    ) {
        super(iconSvgRaw, {
            ...opts,
            css: [css, ...(opts?.css ?? [])],
        });
    }

    protected override buildMenuContainer(): HTMLElement | null {
        const panel = injectPanel(document.body, {
            title: this.title,
        });

        if (this.opts?.additionalButtons != null && this.opts.additionalButtons.length > 0) {
            const buttonsSection = injectSection(panel, { classes: [UICSSMap.ROW_CLASS, CSSMap.BUTTONS_CONTAINER_CLASS] });

            for (const button of this.opts.additionalButtons) {
                const buttonDebounceId = randomString(8);

                injectElement(buttonsSection, "button", {
                    type: "button",
                    classList: [UICSSMap.BUTTON_CLASS],
                    innerText: button.label,
                    title: button.title,
                }, {
                    click: (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        debounce(buttonDebounceId, () => {
                            button.onClick();
                        }, 250);
                    },
                });
            }
        }

        this.itemsContainer = injectSection(panel);

        return panel;
    }

    mapItem(label: string, opts?: ProgressMenuMapItemOpts): ProgressItemHandle {
        void this.menuContainer;

        const container = this.itemsContainer;
        if (container == null) {
            return {
                setStatus: () => { },
                setProgress: () => { },
                setLabel: () => { },
                destroy: () => { },
            };
        }

        const element = injectElement(container, "div", {
            classList: [CSSMap.ITEM_CLASS],
        });

        const labelElement = injectElement(element, "span", {
            classList: [CSSMap.ITEM_LABEL_CLASS],
            innerText: label,
        });

        const statusElement = injectElement(element, "span", {
            classList: [CSSMap.ITEM_STATUS_CLASS],
            innerText: "0%",
        });

        const item: ProgressMenuItem = {
            state: ItemState.PENDING,
            element,
            labelElement,
            statusElement,
            progressPercent: 0,
            destroyed: false,
            onRetry: opts?.onRetry,
            onCancel: opts?.onCancel,
        };

        if (opts?.onCancel != null) {
            this.ensureCancelElement(item);
        }

        if (opts?.onRetry != null) {
            this.ensureRetryElement(item);
        }

        this.applyProgressFill(item, 0);
        this.items.add(item);

        return this.createHandle(item);
    }

    private createHandle(item: ProgressMenuItem): ProgressItemHandle {
        return {
            setStatus: (state) => this.setItemStatus(item, state),
            setProgress: (progress, statusText) => this.setItemProgress(item, progress, statusText),
            setLabel: (label) => this.setItemLabel(item, label),
            destroy: () => this.destroyItem(item),
        };
    }

    private setItemStatus(item: ProgressMenuItem, state: ItemState): void {
        if (item.destroyed) {
            return;
        }

        item.state = state;
        applyDataState(item.element, item.state);

        if (state !== ItemState.ERROR) {
            this.renderProgress(item, item.progressPercent);
        }
    }

    private setItemProgress(item: ProgressMenuItem, progress: number, statusText?: string): void {
        if (item.destroyed || item.state === ItemState.ERROR) {
            return;
        }

        this.renderProgress(item, progress, statusText);
    }

    private setItemLabel(item: ProgressMenuItem, label: string): void {
        if (item.destroyed) {
            return;
        }

        item.labelElement.innerText = label;
    }

    private destroyItem(item: ProgressMenuItem): void {
        if (item.destroyed) {
            return;
        }

        item.destroyed = true;
        item.element.remove();
        this.items.delete(item);
    }

    private ensureCancelElement(item: ProgressMenuItem): void {
        if (item.cancelElement != null && item.element.contains(item.cancelElement)) {
            return;
        }

        const itemDebounceId = randomString(8);
        item.cancelElement = injectElement(item.element, "a", {
            classList: [CSSMap.ITEM_CANCEL_CLASS],
            innerText: "Cancel",
            href: "#",
        }, {
            click: (event) => {
                event.preventDefault();
                event.stopPropagation();
                debounce(itemDebounceId, () => {
                    item.onCancel?.();
                }, 100);
            },
        });
    }

    private ensureRetryElement(item: ProgressMenuItem): void {
        if (item.retryElement != null && item.element.contains(item.retryElement)) {
            return;
        }

        const itemDebounceId = randomString(8);
        item.retryElement = injectElement(item.element, "a", {
            classList: [CSSMap.ITEM_RETRY_CLASS],
            innerText: "Retry",
            href: "#",
        }, {
            click: (event) => {
                event.preventDefault();
                event.stopPropagation();
                debounce(itemDebounceId, () => {
                    item.onRetry?.();
                }, 100);
            },
        });
    }

    private renderProgress(item: ProgressMenuItem, progress: number, statusText?: string): void {
        const percent = Math.min(100, Math.max(0, Math.round(progress)));
        item.progressPercent = percent;
        this.applyProgressFill(item, percent);
        item.statusElement.innerText = statusText ?? `${percent}%`;
    }

    private applyProgressFill(item: ProgressMenuItem, percent: number): void {
        item.element.style.setProperty(CSSMap.ITEM_PROGRESS_CSS_VAR, `${percent}%`);
    }
}

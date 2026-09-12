import { createElement, injectElement } from "../../../utils/dom/elements";
import { ItemState } from "../../../utils/item-state";
import { applyDataState } from "../../../utils/ui/ui-state";
import { NotificationCSSMap } from "../notification-css-map";

export type NotificationEntryOpts = {
    readonly css?: string[];
    readonly weight?: number;
    readonly onClick?: (event: MouseEvent) => void;
};

export class NotificationEntry<OPTS extends NotificationEntryOpts = NotificationEntryOpts> {
    protected _state: ItemState = ItemState.PENDING;

    protected _iconContainer?: HTMLElement | null = undefined;
    protected _menuContainer?: HTMLElement | null = undefined;

    constructor(
        readonly iconSvgRaw: string,
        readonly opts?: OPTS,
    ) { }

    get state(): ItemState {
        return this._state;
    }

    set state(value: ItemState) {
        this._state = value;
        applyDataState(this._iconContainer, this._state);
        applyDataState(this._menuContainer, this._state);
    }

    get iconContainer(): HTMLElement | undefined {
        if (this._iconContainer === undefined) {
            this._iconContainer = this.buildIconContainer();
        }
        return this._iconContainer ?? undefined;
    }

    get menuContainer(): HTMLElement | undefined {
        if (this._menuContainer === undefined) {
            this._menuContainer = this.buildMenuContainer();
        }
        return this._menuContainer ?? undefined;
    }

    get onClickHandler(): ((event: MouseEvent) => void) | undefined {
        return this.opts?.onClick;
    }

    /** Whether the entry menu panel currently has the `open` class. */
    get isMenuOpen(): boolean {
        return this._menuContainer?.classList.contains("open") === true;
    }

    /**
     * Toggles the menu panel `open` class when a menu container exists.
     * @returns The open state after the toggle, or `false` when there is no menu.
     */
    toggleMenuOpen(): boolean {
        const menu = this.menuContainer;
        if (menu == null) {
            return false;
        }

        menu.classList.toggle("open");
        return menu.classList.contains("open");
    }

    protected buildIconContainer(): HTMLElement | null {
        const iconContainer = createElement("div", {
            classList: [NotificationCSSMap.ICON_ENTRY_CLASS],
            innerHTML: this.iconSvgRaw,
        });
        injectElement(iconContainer, "div", { classList: [NotificationCSSMap.ICON_STATE_CLASS] });
        applyDataState(iconContainer, this._state);
        return iconContainer;
    }

    protected buildMenuContainer(): HTMLElement | null {
        return null;
    }
}

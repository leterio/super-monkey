import { createElement, injectElement } from "../../utils/dom/elements";
import { attachCSSToShadowRoot, attachShadowRoot } from "../../utils/dom/shadow";
import { CSS_RESET, GENERAL_CSS } from "../../utils/ui/ui-builder";
import { SuperMonkey } from "../../supermonkey";
import type { AbstractConfiguration } from "../configuration/configuration";
import { StringSelectConfiguration, StringSelectStyleConfiguration } from "../configuration/impl/string-select";
import { Module, type ModuleOpts } from "../module";
import { NotificationEntry } from "./entries/notification-entry";
import { NotificationCSSMap } from "./notification-css-map";

import css from "./notification-bar.css?raw";

enum NotificationBarPosition {
    TOP_LEFT = "top-left",
    TOP_RIGHT = "top-right",
    BOTTOM_LEFT = "bottom-left",
    BOTTOM_RIGHT = "bottom-right",
}

enum NotificationBarIconSize {
    SMALL = "32px",
    MEDIUM = "48px",
    LARGE = "64px",
}

type NotificationBarPositionValue = `${NotificationBarPosition}`;

/**
 * Opts from `integration.defaults.notificationBar`.
 * Integration metadata treats `defaults` as an opaque bag.
 */
export type NotificationBarOpts = ModuleOpts & {
    readonly position?: string;
};

const POSITIONS: readonly NotificationBarPositionValue[] = Object.values(NotificationBarPosition);

/**
 * Static module that hosts the floating icon row and popup menus for all loaded modules.
 */
export class NotificationBar extends Module<NotificationBarOpts> {
    private readonly positionConfiguration: StringSelectConfiguration;
    private readonly iconSizeConfiguration: StringSelectStyleConfiguration;

    private rootContainer: HTMLElement | undefined = undefined;
    private rootShadow: ShadowRoot | undefined = undefined;
    private iconsContainer: HTMLElement | undefined = undefined;
    private menusContainer: HTMLElement | undefined = undefined;

    private entries: NotificationEntry[] = [];

    constructor(name: string, opts: NotificationBarOpts = {}) {
        super(name, opts);

        this.positionConfiguration = new StringSelectConfiguration(
            this.name,
            "position",
            NotificationBar.resolveDefaultPosition(opts),
            {
                options: Object.values(NotificationBarPosition),
                optionsLabels: {
                    [NotificationBarPosition.TOP_LEFT]: "Top left",
                    [NotificationBarPosition.TOP_RIGHT]: "Top right",
                    [NotificationBarPosition.BOTTOM_LEFT]: "Bottom left",
                    [NotificationBarPosition.BOTTOM_RIGHT]: "Bottom right",
                },
                invalidEmptyString: true,
                label: "Position",
                description: "Corner where the floating icon row appears.",
            },
        );

        this.iconSizeConfiguration = new StringSelectStyleConfiguration(
            this.name,
            "iconSize",
            NotificationBarIconSize.MEDIUM,
            {
                options: Object.values(NotificationBarIconSize),
                optionsLabels: {
                    [NotificationBarIconSize.SMALL]: "Small",
                    [NotificationBarIconSize.MEDIUM]: "Medium",
                    [NotificationBarIconSize.LARGE]: "Large",
                },
                invalidEmptyString: true,
                css: (value: string) => `:root { --sm-nb-icon-size: ${value}; }`,
                label: "Icon Size",
                description: "Pixel size of Notification Bar icons.",
            },
        );
    }

    override get title(): string {
        return "Notification Bar";
    }

    override get description(): string {
        return "The notification bar displays notifications and menus.";
    }

    override get configurations(): AbstractConfiguration<any>[] {
        return [this.positionConfiguration, this.iconSizeConfiguration];
    }

    protected override async onIntegrationLoaded(): Promise<void> {
        this.initContainers();
        this.initEntries();
        this.ensureMenuInjection();
    }

    private initContainers(): void {
        this.rootContainer = createElement("div");
        this.rootShadow = attachShadowRoot(this.rootContainer, {
            mode: "closed",
            css: [CSS_RESET, GENERAL_CSS, css],
        });

        this.iconsContainer = injectElement(this.rootShadow, "div", {
            id: NotificationCSSMap.ICONS_CONT_CLASS,
        });

        this.menusContainer = injectElement(this.rootShadow, "div", {
            id: NotificationCSSMap.MENUS_CONT_CLASS,
        });

        this.applyPosition(this.positionConfiguration.value);
        this.positionConfiguration.watch((_oldValue, newValue) => {
            this.applyPosition(newValue);
        });
    }

    private applyPosition(position: string): void {
        this.iconsContainer?.setAttribute("position", position);
        this.menusContainer?.setAttribute("position", position);
    }

    private initEntries(): void {
        this.log.debug("Initializing entries");

        const loadedModules = Array.from(SuperMonkey.loadedIntegration?.modules?.values() ?? []);

        this.entries = loadedModules
            .flatMap((module) => module.notifications)
            .filter((entry): entry is NotificationEntry => entry instanceof NotificationEntry)
            .sort((a, b) => (a.opts?.weight ?? 0) - (b.opts?.weight ?? 0));

        this.log.debug(
            "Found", this.entries.length, "entry(ies) on", loadedModules.length, "loaded module(s).",
        );

        for (const entry of this.entries) {
            const iconContainer = entry.iconContainer;
            const menuContainer = entry.menuContainer;
            const onClickHandler = entry.onClickHandler;

            if (iconContainer == null) {
                continue;
            }

            iconContainer.classList.add(NotificationCSSMap.ICON_ENTRY_CLASS);
            this.iconsContainer?.appendChild(iconContainer);

            if (menuContainer != null) {
                menuContainer.classList.add(NotificationCSSMap.MENU_ENTRY_CLASS);
                this.menusContainer?.appendChild(menuContainer);
            }

            if (onClickHandler != null || menuContainer != null) {
                iconContainer.addEventListener("click", this.handleEntryClick.bind(this, entry));
            }

            if (this.rootShadow != null && entry.opts?.css != null) {
                attachCSSToShadowRoot(entry.opts.css, this.rootShadow);
            }
        }
    }

    private ensureMenuInjection(): void {
        if (this.rootContainer == null) {
            return;
        }

        if (document.body != null) {
            document.body.appendChild(this.rootContainer);
        }

        const intervalId = window.setInterval(() => {
            if (document.body != null) {
                document.body.appendChild(this.rootContainer!);
                window.clearInterval(intervalId);
            }
        }, 100);
    }

    private handleEntryClick(entry: NotificationEntry, event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        entry.menuContainer?.classList.toggle("open");
        entry.opts?.onClick?.(event);
    }

    private static resolveDefaultPosition(opts: NotificationBarOpts): NotificationBarPositionValue {
        const configured = typeof opts.position === "string"
            ? opts.position.trim() as NotificationBarPositionValue
            : undefined;
        if (configured != null && POSITIONS.includes(configured)) {
            return configured;
        }

        return NotificationBarPosition.TOP_RIGHT;
    }
}

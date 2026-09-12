import { debounce } from "../../utils/debouncer";
import { query } from "../../utils/dom/query";
import type { Configuration } from "../configuration/configuration";
import { BooleanConfiguration } from "../configuration/impl/boolean";
import { Module } from "../module";
import type { KeyboardNavigationOpts } from "./keyboard-navigation-opts";

const DEBOUNCE_MS = 150;

type NavigationDirection = "prev" | "next";

export class KeyboardNavigation extends Module<KeyboardNavigationOpts> {
    private readonly letterKeysConfiguration = new BooleanConfiguration(
        this.name,
        "letterKeys",
        true,
        {
            label: "A / D keys",
            description: "Use A for previous and D for next.",
        },
    );

    private readonly numpadKeysConfiguration = new BooleanConfiguration(
        this.name,
        "numpadKeys",
        true,
        {
            label: "Numpad 4 / 6 keys",
            description: "Use Numpad 4 for previous and Numpad 6 for next.",
        },
    );

    private readonly arrowKeysConfiguration = new BooleanConfiguration(
        this.name,
        "arrowKeys",
        true,
        {
            label: "Arrow Left / Right keys",
            description: "Use Left Arrow for previous and Right Arrow for next.",
        },
    );

    private readonly navigateDebounceId: string;
    private letterKeysEnabled: boolean;
    private numpadKeysEnabled: boolean;
    private arrowKeysEnabled: boolean;

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        this.handleKeyDown(event);
    };

    constructor(name: string, opts: KeyboardNavigationOpts) {
        super(name, opts);
        this.navigateDebounceId = `${name}::navigate`;
        this.letterKeysEnabled = this.letterKeysConfiguration.value === true;
        this.numpadKeysEnabled = this.numpadKeysConfiguration.value === true;
        this.arrowKeysEnabled = this.arrowKeysConfiguration.value === true;
        this.letterKeysConfiguration.watch((_oldValue, newValue) => {
            this.letterKeysEnabled = newValue === true;
        });
        this.numpadKeysConfiguration.watch((_oldValue, newValue) => {
            this.numpadKeysEnabled = newValue === true;
        });
        this.arrowKeysConfiguration.watch((_oldValue, newValue) => {
            this.arrowKeysEnabled = newValue === true;
        });
    }

    override get title(): string {
        return "Keyboard Navigation";
    }

    override get description(): string {
        return "Navigates prev/next page controls with A/D, Numpad 4/6, and arrow keys.";
    }

    override get configurations(): Configuration[] {
        return [
            this.letterKeysConfiguration,
            this.numpadKeysConfiguration,
            this.arrowKeysConfiguration,
        ];
    }

    protected override async onIntegrationLoaded(): Promise<void> {
        document.addEventListener("keydown", this.onKeyDown);
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        if (KeyboardNavigation.isEditableFocus()) {
            return;
        }

        const direction = this.resolveDirection(event.code);
        if (direction == null) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        debounce(
            this.navigateDebounceId,
            () => this.navigate(direction),
            DEBOUNCE_MS,
        );
    }

    private resolveDirection(code: string): NavigationDirection | null {
        switch (code) {
            case "KeyA":
                return this.letterKeysEnabled ? "prev" : null;
            case "KeyD":
                return this.letterKeysEnabled ? "next" : null;
            case "Numpad4":
                return this.numpadKeysEnabled ? "prev" : null;
            case "Numpad6":
                return this.numpadKeysEnabled ? "next" : null;
            case "ArrowLeft":
                return this.arrowKeysEnabled ? "prev" : null;
            case "ArrowRight":
                return this.arrowKeysEnabled ? "next" : null;
            default:
                return null;
        }
    }

    private navigate(direction: NavigationDirection): void {
        const selectors =
            direction === "prev" ? this.opts.previousSelectors : this.opts.nextSelectors;
        const target = query<HTMLElement>(selectors);
        if (target == null) {
            this.log.warn(`No ${direction} control found for selectors`, selectors);
            return;
        }

        this.log.debug(`Clicking ${direction} control`, target);
        target.click();
    }

    private static isEditableFocus(): boolean {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) {
            return false;
        }

        if (active.isContentEditable) {
            return true;
        }

        const tag = active.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }
}

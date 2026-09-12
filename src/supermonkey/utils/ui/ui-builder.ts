import { injectElement } from "../dom/elements";
import { QueryableBaseElement } from "../dom/query";

import cssResetRaw from "./css-reset.css?raw";
import generalBodyCss from "./general.css?raw";
import tokensCssRaw from "./tokens.css?raw";

/** Combined design tokens and general body CSS for Super Monkey panels. */
export const GENERAL_CSS = `${tokensCssRaw}\n${generalBodyCss}`;

/** Base CSS reset for Super Monkey UI surfaces. */
export const CSS_RESET = cssResetRaw;

/** Design-token CSS variables for Super Monkey UI. */
export const TOKENS_CSS = tokensCssRaw;

/** CSS class tokens used by panel UI helpers. */
export enum UICSSMap {
    BACKDROP_CLASS = "sm-backdrop",
    PANEL_ROOT_CLASS = "sm-panel",

    HEADING_CLASS = "heading",
    HEADING_ACTIONS_CLASS = "heading-actions",
    SUBTITLE_CLASS = "subtitle",
    ROW_CLASS = "row",
    COLUMN_CLASS = "column",
    BUTTON_CLASS = "button",
    BUTTON_PRIMARY_CLASS = "primary",
    BUTTON_DANGER_CLASS = "danger",
    HELP_CLASS = "help",
    HELP_BUTTON_CLASS = "help-button",
    HELP_VISIBLE_CLASS = "help-visible",
    CLOSE_BUTTON_CLASS = "close",
    FIELD_CLASS = "field",
    CONTROL_CLASS = "control",
    FOLD_BUTTON_CLASS = "fold-button",
    FOLDED_CLASS = "folded",
}

/** Injects a full-bleed backdrop; optional `onClick` closes overlays. */
export function injectBackdrop(parent: QueryableBaseElement, onClick?: () => void): HTMLElement {
    return injectElement(parent, "div",
        { classList: [UICSSMap.BACKDROP_CLASS] },
        { click: onClick });
}

type SectionButton = {
    label: string,
    onClick: () => void,
    classes?: string[],
};

function injectHeading(parent: QueryableBaseElement, opts: {
    foldable?: boolean;
    title?: string | HTMLElement;
    button?: SectionButton;
    closeHandler?: () => void;
    subtitle?: string | HTMLElement;
}): void {
    if (
        opts.title == null
        && opts.subtitle == null
        && opts.closeHandler == null
        && opts.button == null
        && opts.foldable !== true
    ) {
        return;
    }

    const heading = injectElement(parent, "section", { classList: [UICSSMap.HEADING_CLASS] });

    if (opts.foldable === true) {
        injectElement(heading, "button", {
            type: "button",
            classList: [UICSSMap.FOLD_BUTTON_CLASS],
            innerText: ">",
            title: "Toggle section",
        }, {
            click: () => {
                if (parent instanceof HTMLElement) {
                    parent.classList.toggle(UICSSMap.FOLDED_CLASS);
                }
            },
        });
    }

    if (opts.title != null) {
        if (typeof opts.title === "string") {
            injectElement(heading, "h1", { innerText: opts.title });
        } else {
            heading.appendChild(opts.title);
        }
    }

    if (opts.button != null || opts.closeHandler != null) {
        const actions = injectElement(heading, "div", { classList: [UICSSMap.HEADING_ACTIONS_CLASS] });

        if (opts.button != null) {
            injectElement(actions, "button", {
                type: "button",
                innerText: opts.button.label,
                classList: [UICSSMap.BUTTON_CLASS, ...(opts.button.classes || [])],
            }, { click: opts.button.onClick });
        }

        if (opts.closeHandler != null) {
            injectElement(actions, "button", {
                type: "button",
                classList: [UICSSMap.CLOSE_BUTTON_CLASS],
                innerText: "×",
                title: "Close",
            }, { click: opts.closeHandler });
        }
    }

    if (opts.subtitle != null) {
        if (typeof opts.subtitle === "string") {
            injectElement(heading, "h2", { classList: [UICSSMap.SUBTITLE_CLASS], innerText: opts.subtitle });
        } else {
            opts.subtitle.classList.add(UICSSMap.SUBTITLE_CLASS);
            heading.appendChild(opts.subtitle);
        }
    }
}

/** Injects a panel root with optional title, subtitle, and close control. */
export function injectPanel(parent: QueryableBaseElement, opts: {
    title?: string | HTMLElement;
    subtitle?: string | HTMLElement;
    classes?: string[],
    button?: SectionButton,
    closeHandler?: () => void;
} = {}): HTMLElement {
    const panel = injectElement(parent, "div",
        { classList: [UICSSMap.PANEL_ROOT_CLASS, ...(opts.classes || [])] },
        { click: (event) => event.stopPropagation() });
    injectHeading(panel, opts);
    return panel;
}

/**
 * Injects a section with optional heading controls.
 * When `foldable` is true, a toggle collapses the section via {@link UICSSMap.FOLDED_CLASS}.
 * When `folded` is true, the section starts collapsed (`foldable` should also be true).
 */
export function injectSection(parent: QueryableBaseElement, opts: {
    title?: string | HTMLElement;
    subtitle?: string | HTMLElement;
    classes?: string[],
    button?: SectionButton,
    foldable?: boolean;
    folded?: boolean;
} = {}): HTMLElement {
    const section = injectElement(parent, "section", { classList: [...(opts.classes || [])] });
    injectHeading(section, opts);
    if (opts.folded === true) {
        section.classList.add(UICSSMap.FOLDED_CLASS);
    }
    return section;
}

function injectHelp(
    container: HTMLElement,
    labelEl: HTMLElement,
    label: string,
    help: string | undefined,
): void {
    if (help == null) {
        return;
    }

    injectElement(container, "div", { classList: [UICSSMap.HELP_CLASS], innerHTML: `<p>${help}</p>` });
    injectElement(
        labelEl,
        "button",
        {
            type: "button",
            classList: [UICSSMap.HELP_BUTTON_CLASS],
            innerText: "?",
            title: `Toggle help for "${label}"`,
        },
        {
            click: () => { container.classList.toggle(UICSSMap.HELP_VISIBLE_CLASS); }
        });
}

function enableAutoResizeTextarea(textarea: HTMLTextAreaElement): void {
    const resize = (): void => {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    textarea.addEventListener("input", resize);
    requestAnimationFrame(resize);
}

/**
 * Injects a labeled field row or column wrapping `input`.
 * Textareas get auto-resize; optional `help` adds a toggleable help block.
 * @returns The same `input` element after wiring
 */
export function injectInputRow(
    parent: QueryableBaseElement,
    id: string,
    label: string,
    input: HTMLElement,
    help?: string,
    layout: typeof UICSSMap.ROW_CLASS | typeof UICSSMap.COLUMN_CLASS = UICSSMap.ROW_CLASS,
): HTMLElement {
    const container = injectElement(parent, "section", {
        classList: [UICSSMap.FIELD_CLASS, layout],
    });

    const labelEl = injectElement(container, "label", { htmlFor: id });
    injectElement(labelEl, "span", { innerText: label });

    if (layout === UICSSMap.COLUMN_CLASS) {
        injectHelp(container, labelEl, label, help);
    }

    input.id = id;
    injectElement(container, "div", {
        classList: [UICSSMap.CONTROL_CLASS],
        children: [input],
    });

    if (input instanceof HTMLTextAreaElement) {
        enableAutoResizeTextarea(input);
    }

    if (layout === UICSSMap.ROW_CLASS) {
        injectHelp(container, labelEl, label, help);
    }

    return input;
}

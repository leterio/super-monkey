import { injectElement } from "../dom/elements";
import { QueryableBaseElement } from "../dom/query";
import { injectStyle } from "../dom/style";

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
    ISOLATED_FRAME_CLASS = "sm-isolated-frame",
    UI_ROOT_CLASS = "sm-ui-root",

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

/**
 * Full-viewport iframe that owns its own browsing context.
 * Host-page keyboard shortcuts (for example Reddit j/k) do not receive keys typed inside the frame.
 */
export type IsolatedFrame = {
    /** Iframe element appended to the host page. */
    readonly iframe: HTMLIFrameElement;
    /** Document inside the iframe. */
    readonly document: Document;
    /** `document.body` inside the iframe — mount UI here. */
    readonly body: HTMLElement;
    /** Removes the iframe from the host page. */
    readonly destroy: () => void;
};

let isolatedFrameHostChromeInjected = false;

function ensureIsolatedFrameHostChrome(): void {
    if (isolatedFrameHostChromeInjected) {
        return;
    }
    isolatedFrameHostChromeInjected = true;
    injectStyle(GENERAL_CSS);
}

/**
 * Appends a `<style>` element to an iframe (or other) document's `head`.
 * @throws When the document has no `head`
 */
export function injectStyleIntoDocument(doc: Document, css: string): HTMLStyleElement {
    const head = doc.head ?? doc.getElementsByTagName("head")[0];
    if (head == null) {
        throw new Error("Document has no head");
    }

    const style = doc.createElement("style");
    style.textContent = css;
    head.appendChild(style);
    return style;
}

/**
 * Creates a transparent full-viewport `about:blank` iframe and returns its document shell.
 * Injects {@link CSS_RESET} and {@link GENERAL_CSS} into the frame; pass extra sheets via `css`.
 * Host chrome uses `.sm-isolated-frame`; the document root uses `.sm-ui-root` from `general.css`.
 * @throws When the iframe document cannot be initialized
 */
export function createIsolatedFrame(css?: string | readonly string[]): IsolatedFrame {
    const parent = document.body ?? document.documentElement;
    if (parent == null) {
        throw new Error("Cannot create isolated frame before documentElement exists");
    }

    ensureIsolatedFrameHostChrome();

    const iframe = document.createElement("iframe");
    iframe.className = UICSSMap.ISOLATED_FRAME_CLASS;
    iframe.setAttribute("data-sm-isolated-frame", "");
    iframe.title = "SuperMonkey";
    parent.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (doc == null) {
        iframe.remove();
        throw new Error("Isolated frame contentDocument is null");
    }

    doc.open();
    doc.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
    doc.close();

    const html = doc.documentElement;
    const body = doc.body;
    if (html == null || body == null) {
        iframe.remove();
        throw new Error("Isolated frame document shell is incomplete");
    }

    html.classList.add(UICSSMap.UI_ROOT_CLASS);

    injectStyleIntoDocument(doc, CSS_RESET);
    injectStyleIntoDocument(doc, GENERAL_CSS);
    const sheets = css == null ? [] : typeof css === "string" ? [css] : css;
    for (const sheet of sheets) {
        injectStyleIntoDocument(doc, sheet);
    }

    return {
        iframe,
        document: doc,
        body,
        destroy: () => {
            iframe.remove();
        },
    };
}

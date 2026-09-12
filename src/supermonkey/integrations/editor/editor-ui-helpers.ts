import { createElement } from "../../utils/dom/elements";
import { injectSection, injectInputRow, UICSSMap } from "../../utils/ui/ui-builder";

/** CSS class on the editor body root; fold reveal stops at this ancestor. */
export const EDITOR_BODY_CLASS = "body";

/**
 * DOM helpers shared by integration-editor sections.
 */
export type EditorFieldOptions = {
    help?: string;
    column?: boolean;
    /** Validation path for Save/Import issue highlight (`data-path`). */
    path?: string;
};

export type EditorUiHelpers = {
    field(
        parent: HTMLElement,
        id: string,
        label: string,
        input: HTMLElement,
        helpOrOptions?: string | EditorFieldOptions,
        column?: boolean,
    ): void;
    textInput(value: string, onInput: (value: string) => void): HTMLInputElement;
    textarea(value: string, onInput: (value: string) => void): HTMLTextAreaElement;
    select(
        values: readonly string[],
        value: string,
        onChange: (value: string) => void,
        labels?: Readonly<Record<string, string>>,
    ): HTMLSelectElement;
    removableSection(
        parent: HTMLElement,
        title: string | HTMLElement,
        onRemove: () => void,
        foldable?: boolean,
        folded?: boolean,
        path?: string,
    ): HTMLElement;
    focusBlock(list: HTMLElement, section: HTMLElement): void;
    syncNamedListHeadings(
        list: HTMLElement,
        names: readonly string[],
        label: string,
    ): void;
    namedBlockHeading(label: string, index: number, name: string): HTMLHeadingElement;
    syncNamedBlockHeading(
        titleEl: HTMLHeadingElement,
        label: string,
        index: number,
        name: string,
    ): void;
    remove<T>(items: T[], item: T, element: HTMLElement): void;
    /** Sets `data-path` on a section or field container. */
    setPath(element: HTMLElement, path: string): void;
    /** Sets `data-path` on the field row that wraps the input with `inputId`. */
    setFieldPath(parent: HTMLElement, inputId: string, path: string): void;
};

/**
 * Builds the helper bag used by editor sections.
 */
export function createEditorUiHelpers(): EditorUiHelpers {
    return {
        field,
        textInput,
        textarea,
        select,
        removableSection,
        focusBlock,
        syncNamedListHeadings,
        namedBlockHeading,
        syncNamedBlockHeading,
        remove,
        setPath,
        setFieldPath,
    };
}

function field(
    parent: HTMLElement,
    id: string,
    label: string,
    input: HTMLElement,
    helpOrOptions?: string | EditorFieldOptions,
    column = false,
): void {
    const options: EditorFieldOptions = typeof helpOrOptions === "object" && helpOrOptions != null
        ? helpOrOptions
        : { help: helpOrOptions, column };
    const useColumn = options.column === true || (typeof helpOrOptions !== "object" && column);
    const fieldEl = injectInputRow(
        parent,
        id,
        label,
        input,
        options.help,
        useColumn ? UICSSMap.COLUMN_CLASS : UICSSMap.ROW_CLASS,
    );
    const container = fieldEl.closest(`.${UICSSMap.FIELD_CLASS}`);
    if (container instanceof HTMLElement && options.path != null && options.path.length > 0) {
        container.dataset.path = options.path;
    }
}

function textInput(value: string, onInput: (value: string) => void): HTMLInputElement {
    const input = createElement("input", { type: "text", value });
    input.addEventListener("input", () => onInput(input.value));
    return input;
}

function textarea(value: string, onInput: (value: string) => void): HTMLTextAreaElement {
    const input = createElement("textarea", { value });
    input.addEventListener("input", () => onInput(input.value));
    return input;
}

function select(
    values: readonly string[],
    value: string,
    onChange: (value: string) => void,
    labels: Readonly<Record<string, string>> = {},
): HTMLSelectElement {
    const selectEl = createElement("select", {
        children: values.map((entry) => createElement("option", {
            value: entry,
            innerText: labels[entry] ?? entry,
        })),
    });
    selectEl.value = value;
    selectEl.addEventListener("change", () => onChange(selectEl.value));
    return selectEl;
}

function removableSection(
    parent: HTMLElement,
    title: string | HTMLElement,
    onRemove: () => void,
    foldable = true,
    folded = true,
    path?: string,
): HTMLElement {
    const section = injectSection(parent, {
        title,
        foldable,
        folded: foldable && folded,
        button: {
            label: "Remove",
            classes: [UICSSMap.BUTTON_DANGER_CLASS],
            onClick: onRemove,
        },
    });
    if (path != null && path.length > 0) {
        section.dataset.path = path;
    }
    return section;
}

function focusBlock(list: HTMLElement, section: HTMLElement): void {
    for (const sibling of listBlocks(list)) {
        if (sibling !== section) {
            setFolded(sibling, true);
        }
    }
    revealSection(section);
    section.scrollIntoView({ block: "nearest" });
}

function revealSection(section: HTMLElement): void {
    setFolded(section, false);

    let parent = section.parentElement;
    while (parent != null) {
        if (parent instanceof HTMLElement && isFoldableSection(parent)) {
            setFolded(parent, false);
        }
        if (parent.classList.contains(EDITOR_BODY_CLASS)) {
            break;
        }
        parent = parent.parentElement;
    }
}

function setFolded(section: HTMLElement, folded: boolean): void {
    section.classList.toggle(UICSSMap.FOLDED_CLASS, folded);
}

function isFoldableSection(section: HTMLElement): boolean {
    return section.querySelector(
        `:scope > .${UICSSMap.HEADING_CLASS} > .${UICSSMap.FOLD_BUTTON_CLASS}`,
    ) != null;
}

function listBlocks(list: HTMLElement): HTMLElement[] {
    return Array.from(list.children).filter((child): child is HTMLElement =>
        child instanceof HTMLElement
        && child.matches(`section:not(.${UICSSMap.HEADING_CLASS}):not(.${UICSSMap.FIELD_CLASS})`)
    );
}

function syncNamedListHeadings(
    list: HTMLElement,
    names: readonly string[],
    label: string,
): void {
    listBlocks(list).forEach((child, index) => {
        const titleEl = child.querySelector(`:scope > .${UICSSMap.HEADING_CLASS} > h1`);
        const name = names[index];
        if (titleEl instanceof HTMLElement && name != null) {
            titleEl.innerText = namedBlockTitle(label, index, name);
        }
    });
}

function namedBlockHeading(label: string, index: number, name: string): HTMLHeadingElement {
    return createElement("h1", {
        innerText: namedBlockTitle(label, index, name),
    });
}

function syncNamedBlockHeading(
    titleEl: HTMLHeadingElement,
    label: string,
    index: number,
    name: string,
): void {
    titleEl.innerText = namedBlockTitle(label, index, name);
}

function namedBlockTitle(label: string, index: number, name: string): string {
    const trimmed = name.trim();
    return trimmed.length > 0 ? `${label} - ${trimmed}` : `${label} ${index + 1}`;
}

function remove<T>(items: T[], item: T, element: HTMLElement): void {
    const index = items.indexOf(item);
    if (index >= 0) {
        items.splice(index, 1);
    }
    element.remove();
}

function setPath(element: HTMLElement, path: string): void {
    element.dataset.path = path;
}

function setFieldPath(parent: HTMLElement, inputId: string, path: string): void {
    const input = parent.querySelector(`#${CSS.escape(inputId)}`);
    const container = input?.closest(`.${UICSSMap.FIELD_CLASS}`);
    if (container instanceof HTMLElement) {
        container.dataset.path = path;
    }
}

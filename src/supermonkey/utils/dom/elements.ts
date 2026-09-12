import { queryAll, type QueryableBaseElement } from "./query";

const VALID_CLASS_NAME = /^(-[\p{L}_-][\p{L}\p{N}_-]*|[\p{L}_][\p{L}\p{N}_-]*)$/u;

function isValidClassName(className: string): boolean {
    return className != null
        && typeof className === "string"
        && VALID_CLASS_NAME.test(className);
}

/** Attribute bag accepted by {@link createElement}, including `classList` and `children`. */
export type HTMLElementAttributes<T extends HTMLElement> = {
    id?: string;
    classList?: string[];
    children?: HTMLElement[];
    style?: Partial<CSSStyleDeclaration> | string;
} & Partial<Omit<T,
    "id" | "style" | "classList"
    | "children" | "addEventListener"
    | "removeEventListener" | "dispatchEvent">>;

/** Optional DOM event listeners keyed by event name for {@link createElement}. */
export type HTMLElementEvents<T extends HTMLElement> = {
    [K in keyof HTMLElementEventMap]?: (
        event: HTMLElementEventMap[K] & { target: T }
    ) => void;
};

/**
 * Creates an element with optional attributes and event listeners.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    attributes?: HTMLElementAttributes<HTMLElementTagNameMap[K]>,
    events?: HTMLElementEvents<HTMLElementTagNameMap[K]>,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);

    if (attributes?.id != null && isValidClassName(attributes.id)) {
        element.id = attributes.id;
    }

    if (attributes?.classList) {
        for (const className of attributes.classList) {
            if (isValidClassName(className)) {
                element.classList.add(className);
            }
        }
    }

    if (attributes?.innerHTML) {
        element.innerHTML = attributes.innerHTML;
    }

    if (attributes?.innerText) {
        element.innerText = attributes.innerText;
    }

    if (attributes?.children) {
        attributes.children.forEach((child) => element.appendChild(child));
    }

    if (attributes?.style) {
        if (typeof attributes.style === "string") {
            element.setAttribute("style", attributes.style);
        } else {
            Object.entries(attributes.style).forEach(([key, value]) => {
                if (value !== undefined && key in element.style) {
                    (element.style as any)[key] = value as string;
                }
            });
        }
    }

    if (attributes) {
        const {
            id: _id,
            style: _style,
            classList: _classList,
            children: _children,
            innerHTML: _innerHTML,
            innerText: _innerText,
            ...otherAttrs
        } = attributes;

        Object.entries(otherAttrs)
            .filter(([key, value]) =>
                value !== undefined
                && key in element
                && typeof (element as any)[key] !== "function",
            )
            .forEach(([key, value]) => {
                (element as any)[key] = value;
            });
    }

    if (events) {
        Object.entries(events)
            .filter(([_, handler]) => handler != null)
            .forEach(([eventName, handler]) => {
                element.addEventListener(eventName, handler as EventListener);
            });
    }

    return element;
}

/** Insertion mode for {@link positionElement} / {@link injectElementAt}. */
export enum ElementPosition {
    CHILDREN,
    FIRST_CHILDREN,
    AFTER,
    BEFORE,
    REPLACE,
}

/**
 * Positions `element` relative to `relativeElement`.
 */
export function positionElement(
    relativeElement: QueryableBaseElement,
    element: HTMLElement,
    position: ElementPosition,
): void {
    let resolvedPosition = position;
    let resolvedTarget: QueryableBaseElement = relativeElement;

    if (!(relativeElement instanceof HTMLElement)) {
        if (resolvedPosition === ElementPosition.BEFORE) {
            resolvedPosition = ElementPosition.FIRST_CHILDREN;
        } else if (resolvedPosition === ElementPosition.AFTER) {
            resolvedPosition = ElementPosition.CHILDREN;
        }
    }

    if (
        resolvedPosition === ElementPosition.BEFORE
        || resolvedPosition === ElementPosition.AFTER
    ) {
        if (
            !(relativeElement instanceof HTMLElement)
            || relativeElement.parentElement == null
        ) {
            throw new Error("BEFORE and AFTER require an HTMLElement with a parent.");
        }
    }

    if (resolvedPosition === ElementPosition.REPLACE) {
        if (relativeElement instanceof Document) {
            throw new Error("Document cannot be replaced.");
        }

        if (relativeElement instanceof ShadowRoot) {
            resolvedTarget = relativeElement;
        } else if (
            relativeElement instanceof HTMLElement
            && relativeElement.shadowRoot
        ) {
            resolvedTarget = relativeElement.shadowRoot;
        } else if (
            !(relativeElement instanceof HTMLElement)
            || relativeElement.parentElement == null
        ) {
            throw new Error("Only HTMLElements with a parent can be replaced.");
        }
    }

    switch (resolvedPosition) {
        case ElementPosition.BEFORE:
            (relativeElement as HTMLElement).before(element);
            break;

        case ElementPosition.AFTER:
            (relativeElement as HTMLElement).after(element);
            break;

        case ElementPosition.FIRST_CHILDREN:
            if (relativeElement.firstChild) {
                relativeElement.firstChild.before(element);
            } else {
                relativeElement.appendChild(element);
            }
            break;

        case ElementPosition.REPLACE:
            if (resolvedTarget instanceof ShadowRoot) {
                while (resolvedTarget.firstChild) {
                    resolvedTarget.removeChild(resolvedTarget.firstChild);
                }
                resolvedTarget.appendChild(element);
            } else {
                (relativeElement as HTMLElement).parentElement!.replaceChild(
                    element,
                    relativeElement as HTMLElement,
                );
            }
            break;

        case ElementPosition.CHILDREN:
        default:
            relativeElement.appendChild(element);
            break;
    }
}

/**
 * Creates an element and inserts it at `position` relative to `relativeElement`.
 */
export function injectElementAt<K extends keyof HTMLElementTagNameMap>(
    relativeElement: QueryableBaseElement,
    tagName: K,
    position: ElementPosition,
    attributes?: HTMLElementAttributes<HTMLElementTagNameMap[K]>,
    events?: HTMLElementEvents<HTMLElementTagNameMap[K]>,
): HTMLElementTagNameMap[K] {
    const element = createElement(tagName, attributes, events);
    positionElement(relativeElement, element, position);
    return element;
}

/**
 * Creates an element and appends it as a child of `relativeElement`.
 */
export function injectElement<K extends keyof HTMLElementTagNameMap>(
    relativeElement: QueryableBaseElement,
    tagName: K,
    attributes?: HTMLElementAttributes<HTMLElementTagNameMap[K]>,
    events?: HTMLElementEvents<HTMLElementTagNameMap[K]>,
): HTMLElementTagNameMap[K] {
    return injectElementAt(
        relativeElement,
        tagName,
        ElementPosition.CHILDREN,
        attributes,
        events,
    );
}

/**
 * Returns the first non-empty attribute value from `element`.
 * Tries `attributes` in order.
 */
export function getFirstElementAttributeValue(
    element: HTMLElement,
    attributes: readonly string[],
): string | null {
    if (element == null
        || attributes == null
        || !Array.isArray(attributes)
        || attributes.length === 0) {
        return null;
    }

    return attributes
        .map((attribute) => element.getAttribute(attribute))
        .filter((attribute) => attribute != null && attribute.length > 0)
        .at(0) ?? null;
}

/**
 * Walks ancestors of `element` up to (but not including) `container`
 * and returns the first matching attribute value.
 */
export function findElementAttributeValueInAncestors(
    element: HTMLElement,
    container: HTMLElement,
    attributes: readonly string[],
): string | null {
    if (element == null
        || container == null
        || attributes == null
        || attributes.length === 0) {
        return null;
    }

    const attributeList = [...attributes];
    let current = element.parentElement;

    while (current != null && current !== container) {
        const value = getFirstElementAttributeValue(current, attributeList);
        if (value != null) {
            return value;
        }

        current = current.parentElement;
    }

    return null;
}

/**
 * Walks descendants of `element` and returns the first matching attribute value.
 */
export function findElementAttributeValueInDescendants(
    element: HTMLElement,
    attributes: readonly string[],
): string | null {
    if (element == null
        || attributes == null
        || attributes.length === 0) {
        return null;
    }

    const attributeList = [...attributes];
    for (const descendant of queryAll<HTMLElement>("*", element)) {
        const value = getFirstElementAttributeValue(descendant, attributeList);
        if (value != null) {
            return value;
        }
    }

    return null;
}

/**
 * Returns the closest ancestor of `element` (or `element` itself) matching any of `selectors`.
 * Invalid selectors are skipped.
 */
export function closestMatching(
    element: HTMLElement,
    selectors: string[],
): HTMLElement | null {
    for (const selector of selectors) {
        if (typeof selector !== "string" || selector.trim().length === 0) {
            continue;
        }

        try {
            const closest = element.closest<HTMLElement>(selector);
            if (closest != null) {
                return closest;
            }
        } catch {
            // invalid selector-skip
        }
    }

    return null;
}

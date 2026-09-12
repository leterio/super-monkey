/**
 * Attaches a shadow root to `element` with optional HTML, CSS, and children.
 */
export function attachShadowRoot(
    element: HTMLElement,
    opts: {
        mode?: ShadowRootMode;
        innerHTML?: string;
        css?: string | string[];
        children?: HTMLElement[];
    },
): ShadowRoot {
    const shadowRoot = element.attachShadow({ mode: opts.mode ?? "open" });
    if (opts.innerHTML != null) {
        shadowRoot.innerHTML = opts.innerHTML;
    }
    if (opts.css != null) {
        attachCSSToShadowRoot(opts.css, shadowRoot);
    }
    if (opts.children != null) {
        opts.children.forEach((child) => shadowRoot.appendChild(child));
    }
    return shadowRoot;
}

/**
 * Adopts one or more CSS strings into `shadow` via `adoptedStyleSheets`.
 */
export function attachCSSToShadowRoot(
    css: string | string[],
    shadow: ShadowRoot,
): void {
    if (Array.isArray(css)) {
        css.forEach((sheet) => attachCSSToShadowRoot(sheet, shadow));
        return;
    }

    const cssObj = new CSSStyleSheet();
    cssObj.replaceSync(css);
    shadow.adoptedStyleSheets.push(cssObj);
}

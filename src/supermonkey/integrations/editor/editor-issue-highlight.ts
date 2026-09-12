import { ItemState } from "../../utils/item-state";
import { Logger } from "../../utils/logger";
import { applyDataState } from "../../utils/ui/ui-state";
import { UICSSMap } from "../../utils/ui/ui-builder";
import { EDITOR_BODY_CLASS } from "./editor-ui-helpers";
import type { IntegrationValidationIssue } from "../integration-validation";

const log = new Logger("EditorIssueHighlight");

const SECTION_HOST_BY_PREFIX: Readonly<Record<string, string>> = {
    name: "identity",
    matchedDomains: "matched-domains",
    mappedPages: "mapped-pages",
    contentManager: "content-manager",
    modules: "modules",
    defaults: "modules",
};

/**
 * Clears error highlight state under the editor body.
 */
export function clearIssueHighlights(root: HTMLElement): void {
    for (const element of root.querySelectorAll("[data-state=\"error\"]")) {
        if (element instanceof HTMLElement) {
            applyDataState(element, ItemState.PENDING);
        }
    }
}

/**
 * Highlights every resolvable issue chain, unfolds to body, scrolls to the first target.
 * @returns Path → target map for clickable footer wiring
 */
export function applyIssueHighlights(
    root: HTMLElement,
    issues: readonly IntegrationValidationIssue[],
): Map<string, HTMLElement> {
    clearIssueHighlights(root);
    const targets = new Map<string, HTMLElement>();

    for (const issue of issues) {
        const target = resolveIssueTarget(root, issue.path);
        if (target == null) {
            if (issue.path.length > 0) {
                log.warn("No editor control for validation path", issue.path);
            }
            continue;
        }
        targets.set(issue.path, target);
        highlightIssueChain(target);
    }

    const first = targets.values().next().value;
    if (first instanceof HTMLElement) {
        first.scrollIntoView({ block: "nearest" });
        focusControl(first);
    }

    return targets;
}

/**
 * Unfolds and scrolls to a previously resolved issue target.
 */
export function focusIssueTarget(target: HTMLElement): void {
    highlightIssueChain(target);
    target.scrollIntoView({ block: "nearest" });
    focusControl(target);
}

/**
 * Resolves a validation path to the nearest annotated control under `root`.
 */
export function resolveIssueTarget(root: HTMLElement, path: string): HTMLElement | null {
    const trimmed = path.trim();
    if (trimmed.length === 0) {
        return null;
    }

    const exact = root.querySelector(`[data-path="${escapeAttrSelector(trimmed)}"]`);
    if (exact instanceof HTMLElement) {
        return exact;
    }

    let best: HTMLElement | null = null;
    let bestLen = -1;
    for (const element of root.querySelectorAll("[data-path]")) {
        if (!(element instanceof HTMLElement)) {
            continue;
        }
        const candidate = element.dataset.path ?? "";
        if (candidate.length === 0) {
            continue;
        }
        if (!pathCoveredBy(trimmed, candidate)) {
            continue;
        }
        if (candidate.length > bestLen) {
            best = element;
            bestLen = candidate.length;
        }
    }
    if (best != null) {
        return best;
    }

    const firstSegment = trimmed.split(/[.\[]/, 1)[0] ?? "";
    const sectionId = SECTION_HOST_BY_PREFIX[firstSegment];
    if (sectionId == null) {
        return null;
    }
    const host = root.querySelector(`[data-editor-section="${sectionId}"]`);
    return host instanceof HTMLElement ? host : null;
}

function pathCoveredBy(issuePath: string, annotatedPath: string): boolean {
    if (issuePath === annotatedPath) {
        return true;
    }
    return issuePath.startsWith(`${annotatedPath}.`)
        || issuePath.startsWith(`${annotatedPath}[`);
}

function highlightIssueChain(from: HTMLElement): void {
    applyDataState(from, ItemState.ERROR);

    let node: HTMLElement | null = from;
    while (node != null) {
        if (isFoldableSection(node)) {
            applyDataState(node, ItemState.ERROR);
            node.classList.remove(UICSSMap.FOLDED_CLASS);
        }
        if (node.classList.contains(EDITOR_BODY_CLASS)) {
            break;
        }
        node = node.parentElement;
    }
}

function focusControl(target: HTMLElement): void {
    const control = target.matches("input, textarea, select")
        ? target
        : target.querySelector("input, textarea, select");
    if (control instanceof HTMLElement) {
        control.focus({ preventScroll: true });
    }
}

function isFoldableSection(section: HTMLElement): boolean {
    return section.querySelector(
        `:scope > .${UICSSMap.HEADING_CLASS} > .${UICSSMap.FOLD_BUTTON_CLASS}`,
    ) != null;
}

function escapeAttrSelector(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
    }
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

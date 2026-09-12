import type { DraftIntegration } from "./draft-mappers";
import type { EditorUiHelpers } from "./editor-ui-helpers";

/**
 * Shared context passed to each editor section while the modal body mounts.
 */
export type EditorSectionContext = {
    readonly mode: "create" | "edit";
    readonly draft: DraftIntegration;
    readonly body: HTMLElement;
    readonly ui: EditorUiHelpers;
    /**
     * Remounts one section (by id) or every visible section when omitted.
     */
    requestRerender(sectionId?: string): void;
};

/**
 * Pluggable body block for the integration editor.
 * First-party sections register through EditorSectionRegistry.
 */
export type EditorSection = {
    readonly id: string;
    readonly title: string;
    readonly order: number;
    /**
     * When false, the section is skipped for this mount.
     * Defaults to always visible.
     */
    visible?(ctx: Pick<EditorSectionContext, "mode" | "draft">): boolean;
    mount(ctx: EditorSectionContext): void;
};

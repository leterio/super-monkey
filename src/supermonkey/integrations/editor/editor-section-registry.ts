import { EditorSection } from "./editor-section";

/**
 * Ordered registry of integration-editor body sections.
 */
export class EditorSectionRegistry {
    private static readonly sections = new Map<string, EditorSection>();

    private constructor() { }

    /**
     * Registers or replaces a section by `id`.
     */
    static register(section: EditorSection): void {
        this.sections.set(section.id, section);
    }

    /**
     * Returns registered sections sorted by `order`, then `id`.
     */
    static getSections(): readonly EditorSection[] {
        return [...this.sections.values()].sort((left, right) => {
            if (left.order !== right.order) {
                return left.order - right.order;
            }
            return left.id.localeCompare(right.id);
        });
    }

    /**
     * Returns one registered section, or `undefined` when missing.
     */
    static getSection(id: string): EditorSection | undefined {
        return this.sections.get(id);
    }
}

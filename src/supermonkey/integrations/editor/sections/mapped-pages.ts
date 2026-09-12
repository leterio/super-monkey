import { randomString } from "../../../utils/string";
import { injectSection } from "../../../utils/ui/ui-builder";
import { DraftMappedPage, emptyMappedPage } from "../draft-mappers";
import { EditorSection } from "../editor-section";
import { EditorSectionRegistry } from "../editor-section-registry";
import type { EditorUiHelpers } from "../editor-ui-helpers";

const mappedPagesSection: EditorSection = {
    id: "mapped-pages",
    title: "Mapped pages",
    order: 30,
    mount(ctx) {
        const { draft, body, ui } = ctx;
        const section = injectSection(body, {
            title: "Mapped pages",
            subtitle: "Name pathname globs for page filters.",
            foldable: true,
            folded: true,
            button: {
                label: "Add page",
                onClick: () => {
                    const page = emptyMappedPage();
                    draft.mappedPages.push(page);
                    ui.focusBlock(section, mountMappedPage(section, page, draft.mappedPages, ui));
                },
            },
        });
        draft.mappedPages.forEach((page) => mountMappedPage(section, page, draft.mappedPages, ui));
    },
};

function pagePath(page: DraftMappedPage, pages: DraftMappedPage[]): string {
    const name = page.name.trim();
    const index = pages.indexOf(page);
    return name.length > 0 ? `mappedPages.${name}` : `mappedPages[${index}]`;
}

function syncPagePaths(
    section: HTMLElement,
    nameInputId: string,
    pathsInputId: string,
    page: DraftMappedPage,
    pages: DraftMappedPage[],
    ui: EditorUiHelpers,
): void {
    const base = pagePath(page, pages);
    ui.setPath(section, base);
    ui.setFieldPath(section, nameInputId, base);
    ui.setFieldPath(section, pathsInputId, `${base}.paths`);
}

function mountMappedPage(
    list: HTMLElement,
    page: DraftMappedPage,
    pages: DraftMappedPage[],
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => pages.indexOf(page);
    const titleEl = ui.namedBlockHeading("Page", indexOf(), page.name);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(pages, page, section);
        ui.syncNamedListHeadings(
            list,
            pages.map((entry) => entry.name),
            "Page",
        );
    }, true, true, pagePath(page, pages));
    const id = `mapped-page-${randomString(8)}`;
    const nameInputId = `${id}-name`;
    const pathsInputId = `${id}-paths`;
    ui.field(section, nameInputId, "Name", ui.textInput(page.name, (value) => {
        page.name = value;
        ui.syncNamedBlockHeading(titleEl, "Page", indexOf(), value);
        syncPagePaths(section, nameInputId, pathsInputId, page, pages, ui);
    }), {
        path: pagePath(page, pages),
        help: "Letters, digits, hyphens, and underscores. Unique within this integration.",
    });
    ui.field(
        section,
        pathsInputId,
        "Paths",
        ui.textInput(page.paths, (value) => {
            page.paths = value;
        }),
        {
            path: `${pagePath(page, pages)}.paths`,
            help: "Comma-separated pathname globs. * matches any substring. Prefix exclusions with !!.",
        },
    );
    return section;
}

EditorSectionRegistry.register(mappedPagesSection);

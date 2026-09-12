import { ScanMode } from "../../../content-manager/metadata";
import { createElement } from "../../../utils/dom/elements";
import { randomString } from "../../../utils/string";
import { injectSection } from "../../../utils/ui/ui-builder";
import {
    DraftContentManagerGroup,
    DraftContentManagerListing,
    DraftContentManagerView,
    DraftListingCleanupMode,
    DraftValueSource,
    emptyGroup,
    emptyListing,
    emptyValueSource,
    emptyView,
} from "../draft-mappers";
import { EditorSection } from "../editor-section";
import { EditorSectionRegistry } from "../editor-section-registry";
import type { EditorUiHelpers } from "../editor-ui-helpers";
import { mountValueSource } from "../value-source-fields";

const contentManagerSection: EditorSection = {
    id: "content-manager",
    title: "Content Manager",
    order: 40,
    mount(ctx) {
        const { draft, body, ui } = ctx;
        const section = injectSection(body, {
            title: "Content Manager",
            subtitle: "Configure open-item views and page listings.",
            foldable: true,
            folded: true,
            button: {
                label: "Add group",
                onClick: () => {
                    const group = emptyGroup();
                    draft.contentManagerGroups.push(group);
                    ui.focusBlock(section, mountGroup(section, group, draft.contentManagerGroups, ui));
                },
            },
        });

        ui.field(section, "cm-scan-mode", "Scan mode", ui.select(
            [ScanMode.ONLOAD, ScanMode.INTERVAL],
            draft.scanMode,
            (value) => {
                draft.scanMode = value as ScanMode;
            },
            {
                [ScanMode.ONLOAD]: "On load",
                [ScanMode.INTERVAL]: "Interval",
            },
        ), {
            path: "contentManager.scanMode",
            help: "On load scans each CONTENT_LOADED. Interval also rescans selector views and listings on a timer.",
        });
        ui.field(section, "cm-scan-interval", "Scan interval (ms)", ui.textInput(
            draft.scanIntervalMs,
            (value) => {
                draft.scanIntervalMs = value;
            },
        ), {
            path: "contentManager.scanIntervalMs",
            help: "Used when Scan mode is Interval. Default 1000; valid range 1000–60000.",
        });

        draft.contentManagerGroups.forEach((group) => {
            mountGroup(section, group, draft.contentManagerGroups, ui);
        });
    },
};

function groupPath(group: DraftContentManagerGroup, groups: DraftContentManagerGroup[]): string {
    const name = group.name.trim();
    const index = groups.indexOf(group);
    return name.length > 0 ? `contentManager.groups.${name}` : `contentManager.groups[${index}]`;
}

function syncGroupPaths(
    section: HTMLElement,
    nameInputId: string,
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    ui: EditorUiHelpers,
): void {
    const base = groupPath(group, groups);
    ui.setPath(section, base);
    ui.setFieldPath(section, nameInputId, base);
}

function viewPath(
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    view: DraftContentManagerView,
): string {
    const index = group.views.indexOf(view);
    return `${groupPath(group, groups)}.views[${index}]`;
}

function listingPath(
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    listing: DraftContentManagerListing,
): string {
    const index = group.listings.indexOf(listing);
    return `${groupPath(group, groups)}.listings[${index}]`;
}

function mountGroup(
    list: HTMLElement,
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => groups.indexOf(group);
    const titleEl = ui.namedBlockHeading("Group", indexOf(), group.name);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(groups, group, section);
        ui.syncNamedListHeadings(
            list,
            groups.map((entry) => entry.name),
            "Group",
        );
    }, true, true, groupPath(group, groups));
    const id = `group-${randomString(8)}`;
    const nameInputId = `${id}-name`;
    ui.field(section, nameInputId, "Group name", ui.textInput(group.name, (value) => {
        group.name = value;
        ui.syncNamedBlockHeading(titleEl, "Group", indexOf(), value);
        syncGroupPaths(section, nameInputId, group, groups, ui);
    }), {
        path: groupPath(group, groups),
        help: "Unique key for this content kind. Referenced by History and other modules.",
    });

    const viewsSection = injectSection(section, {
        title: "Views",
        subtitle: "Resolve the id for one open item.",
        foldable: true,
        folded: true,
        button: {
            label: "Add view",
            onClick: () => {
                const view = emptyView();
                group.views.push(view);
                ui.focusBlock(viewsSection, mountView(viewsSection, group, groups, view, id, ui));
            },
        },
    });
    group.views.forEach((view) => mountView(viewsSection, group, groups, view, id, ui));

    const listingsSection = injectSection(section, {
        title: "Listings",
        subtitle: "Resolve ids for items inside listing containers.",
        foldable: true,
        folded: true,
        button: {
            label: "Add listing",
            onClick: () => {
                const listing = emptyListing();
                group.listings.push(listing);
                ui.focusBlock(
                    listingsSection,
                    mountListing(listingsSection, group, groups, listing, id, ui),
                );
            },
        },
    });
    group.listings.forEach((listing) => mountListing(listingsSection, group, groups, listing, id, ui));
    return section;
}

function syncViewPaths(
    section: HTMLElement,
    nameInputId: string,
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    view: DraftContentManagerView,
    ui: EditorUiHelpers,
): void {
    const base = viewPath(group, groups, view);
    ui.setPath(section, base);
    ui.setFieldPath(section, nameInputId, `${base}.name`);
}

function mountView(
    list: HTMLElement,
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    view: DraftContentManagerView,
    prefix: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => group.views.indexOf(view);
    const titleEl = ui.namedBlockHeading("View", indexOf(), view.name);
    const base = viewPath(group, groups, view);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(group.views, view, section);
        ui.syncNamedListHeadings(
            list,
            group.views.map((entry) => entry.name),
            "View",
        );
    }, true, true, base);
    const id = `${prefix}-view-${randomString(8)}`;
    const nameInputId = `${id}-name`;
    ui.field(section, nameInputId, "Name", ui.textInput(view.name, (value) => {
        view.name = value;
        ui.syncNamedBlockHeading(titleEl, "View", indexOf(), value);
        syncViewPaths(section, nameInputId, group, groups, view, ui);
    }), {
        path: `${base}.name`,
        help: "Required. Used by History filters and other consumers.",
    });
    ui.field(section, `${id}-page-filter`, "Page filter", ui.textInput(
        view.pageFilter,
        (value) => {
            view.pageFilter = value;
        },
    ), {
        path: `${base}.pageFilter`,
        help: "Optional. Comma-separated mapped page names. Prefix exclusions with !!. Empty = all pages.",
    });
    ui.field(section, `${id}-selectors`, "Selectors", ui.textInput(view.selectors, (value) => {
        view.selectors = value;
    }), {
        path: `${base}.selectors`,
        help: "Comma-separated CSS selectors. Required for Attribute, Text, and Srcset. Omit for Query parameter or URL path.",
    });
    mountValueSource(section, view.idSource, `${id}-source`, ui, { pathPrefix: `${base}.idSource` });
    return section;
}

function syncListingPaths(
    section: HTMLElement,
    nameInputId: string,
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    listing: DraftContentManagerListing,
    ui: EditorUiHelpers,
): void {
    const base = listingPath(group, groups, listing);
    ui.setPath(section, base);
    ui.setFieldPath(section, nameInputId, `${base}.name`);
}

function mountListing(
    list: HTMLElement,
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    listing: DraftContentManagerListing,
    prefix: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => group.listings.indexOf(listing);
    const titleEl = ui.namedBlockHeading("Listing", indexOf(), listing.name);
    const base = listingPath(group, groups, listing);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(group.listings, listing, section);
        ui.syncNamedListHeadings(
            list,
            group.listings.map((entry) => entry.name),
            "Listing",
        );
    }, true, true, base);
    const id = `${prefix}-listing-${randomString(8)}`;
    const nameInputId = `${id}-name`;
    ui.field(section, nameInputId, "Name", ui.textInput(listing.name, (value) => {
        listing.name = value;
        ui.syncNamedBlockHeading(titleEl, "Listing", indexOf(), value);
        syncListingPaths(section, nameInputId, group, groups, listing, ui);
    }), {
        path: `${base}.name`,
        help: "Required. Used by History filters and other consumers.",
    });
    ui.field(section, `${id}-page-filter`, "Page filter", ui.textInput(
        listing.pageFilter,
        (value) => {
            listing.pageFilter = value;
        },
    ), {
        path: `${base}.pageFilter`,
        help: "Optional. Comma-separated mapped page names. Prefix exclusions with !!. Empty = all pages.",
    });
    ui.field(section, `${id}-containers`, "Container selectors", ui.textInput(
        listing.containerSelectors,
        (value) => {
            listing.containerSelectors = value;
        },
    ), {
        path: `${base}.containerSelectors`,
        help: "Comma-separated CSS selectors. Required listing roots.",
    });
    ui.field(section, `${id}-entries`, "Entry selectors", ui.textInput(
        listing.entriesSelectors,
        (value) => {
            listing.entriesSelectors = value;
        },
    ), {
        path: `${base}.entriesSelectors`,
        help: "Comma-separated CSS selectors. Required nodes inside each container.",
    });
    ui.field(section, `${id}-entry-container`, "Entry container selectors", ui.textInput(
        listing.entryContainerSelector,
        (value) => {
            listing.entryContainerSelector = value;
        },
    ), {
        path: `${base}.entryContainerSelector`,
        help: "Comma-separated CSS selectors. Optional closest() targets when the entry node is a deep child.",
    });

    const cleanupSelectorsHost = createElement("div");
    const syncCleanupSelectorsVisibility = () => {
        cleanupSelectorsHost.hidden = listing.cleanupMode !== "removeSelectors";
    };

    ui.field(section, `${id}-cleanup-mode`, "Cleanup", ui.select(
        ["none", "removeNonEntities", "removeSelectors"],
        listing.cleanupMode,
        (value) => {
            listing.cleanupMode = value as DraftListingCleanupMode;
            syncCleanupSelectorsVisibility();
        },
        {
            none: "None",
            removeNonEntities: "Remove non-entities",
            removeSelectors: "Remove by selectors",
        },
    ), {
        path: `${base}.cleanup`,
        help: "Optional cleanup of non-entry nodes in each listing container after discover.",
    });

    section.append(cleanupSelectorsHost);
    ui.field(
        cleanupSelectorsHost,
        `${id}-cleanup-selectors`,
        "Cleanup remove selectors",
        ui.textInput(
            listing.cleanupRemoveSelectors,
            (value) => {
                listing.cleanupRemoveSelectors = value;
            },
        ),
        {
            path: `${base}.cleanup.removeSelectors`,
            help: "Comma-separated CSS selectors. Matched nodes are removed unless the match is exactly a listed entity. Selectors that wrap or nest inside entities can still remove them.",
        },
    );
    syncCleanupSelectorsVisibility();

    const sourcesSection = injectSection(section, {
        title: "Entry ID sources",
        subtitle: "Sources are tried in order.",
        foldable: true,
        folded: true,
        button: {
            label: "Add source",
            onClick: () => {
                const source = emptyValueSource();
                listing.entryIdSources.push(source);
                ui.focusBlock(
                    sourcesSection,
                    mountListingSource(
                        sourcesSection,
                        group,
                        groups,
                        listing,
                        source,
                        id,
                        ui,
                    ),
                );
            },
        },
    });
    listing.entryIdSources.forEach((source) => {
        mountListingSource(sourcesSection, group, groups, listing, source, id, ui);
    });
    return section;
}

function mountListingSource(
    list: HTMLElement,
    group: DraftContentManagerGroup,
    groups: DraftContentManagerGroup[],
    listing: DraftContentManagerListing,
    source: DraftValueSource,
    prefix: string,
    ui: EditorUiHelpers,
): HTMLElement {
    const sourceIndex = () => listing.entryIdSources.indexOf(source);
    const sourcePath = () =>
        `${listingPath(group, groups, listing)}.entryIdSource[${sourceIndex()}]`;
    const section = ui.removableSection(
        list,
        "ID source",
        () => ui.remove(listing.entryIdSources, source, section),
        true,
        true,
        sourcePath(),
    );
    mountValueSource(
        section,
        source,
        `${prefix}-source-${randomString(8)}`,
        ui,
        { pathPrefix: sourcePath() },
    );
    return section;
}

EditorSectionRegistry.register(contentManagerSection);

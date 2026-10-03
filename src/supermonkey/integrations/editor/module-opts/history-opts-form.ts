import { joinCsv, randomString, splitCsv } from "../../../utils/string";
import { isPlainObject } from "../../../utils/type";
import { injectSection } from "../../../utils/ui/ui-builder";
import type { DraftHistoryGroup, DraftHistoryOpts, DraftIntegrationModule } from "../draft-mappers";
import type { ModuleOptsForm, ModuleOptsFormContext } from "./module-opts-form";
import { ModuleOptsFormRegistry } from "./module-opts-form-registry";

const MODULE_KEY = "History";

const historyOptsForm: ModuleOptsForm = {
    moduleKey: MODULE_KEY,

    hydrate(module, opts) {
        const draft = emptyDraft();
        if (isPlainObject(opts) && isPlainObject(opts.groups)) {
            const groups = Object.entries(opts.groups).map(([name, rawBinder]) => {
                const group = emptyGroup(name);
                if (isPlainObject(rawBinder)) {
                    group.newContentSelectors = stringListToCsv(rawBinder.newContentSelectors);
                    group.recordFilter = stringListToCsv(rawBinder.recordFilter);
                    group.decorateFilter = stringListToCsv(rawBinder.decorateFilter);
                    group.viewedStyles = typeof rawBinder.viewedStyles === "string"
                        ? rawBinder.viewedStyles
                        : "";
                    group.listedStyles = typeof rawBinder.listedStyles === "string"
                        ? rawBinder.listedStyles
                        : "";
                }
                return group;
            });
            if (groups.length > 0) {
                draft.groups = groups;
            }
        }
        module.historyOpts = draft;
        module.optsText = "";
    },

    mount(ctx) {
        const { module, host, ui, pathPrefix } = ctx;
        ensureDraft(module);
        const draft = module.historyOpts!;
        const id = `history-opts-${module.instanceName || "new"}`;
        const groupsSection = injectSection(host, {
            title: "Groups",
            subtitle: "Bind History to Content Manager groups.",
            foldable: true,
            folded: false,
            button: {
                label: "Add group",
                onClick: () => {
                    const group = emptyGroup();
                    draft.groups.push(group);
                    ui.focusBlock(
                        groupsSection,
                        mountGroup(groupsSection, group, draft.groups, id, pathPrefix, ui),
                    );
                },
            },
        });
        draft.groups.forEach((group) => {
            mountGroup(groupsSection, group, draft.groups, id, pathPrefix, ui);
        });
    },

    toOpts(module) {
        ensureDraft(module);
        const draft = module.historyOpts!;
        const groups: Record<string, unknown> = {};
        for (const [index, group] of draft.groups.entries()) {
            const name = group.name.trim();
            if (name.length === 0) {
                return {
                    ok: false,
                    issues: [{
                        path: `groups[${index}]`,
                        message: "Each History group needs a Content Manager group name.",
                    }],
                };
            }
            if (Object.hasOwn(groups, name)) {
                return {
                    ok: false,
                    issues: [{
                        path: `groups.${name}`,
                        message: `Duplicate History group name: ${name}`,
                    }],
                };
            }

            const newContentSelectors = splitCsv(group.newContentSelectors);
            const recordFilter = splitCsv(group.recordFilter);
            const decorateFilter = splitCsv(group.decorateFilter);
            const viewedStyles = group.viewedStyles.trim();
            const listedStyles = group.listedStyles.trim();
            groups[name] = {
                ...(newContentSelectors.length > 0 ? { newContentSelectors } : {}),
                ...(recordFilter.length > 0 ? { recordFilter } : {}),
                ...(decorateFilter.length > 0 ? { decorateFilter } : {}),
                ...(viewedStyles.length > 0 ? { viewedStyles } : {}),
                ...(listedStyles.length > 0 ? { listedStyles } : {}),
            };
        }

        return {
            ok: true,
            value: { groups },
        };
    },
};

function groupPath(
    group: DraftHistoryGroup,
    groups: DraftHistoryGroup[],
    pathPrefix: string,
): string {
    const name = group.name.trim();
    const index = groups.indexOf(group);
    return name.length > 0 ? `${pathPrefix}.groups.${name}` : `${pathPrefix}.groups[${index}]`;
}

function mountGroup(
    list: HTMLElement,
    group: DraftHistoryGroup,
    groups: DraftHistoryGroup[],
    prefix: string,
    pathPrefix: string,
    ui: ModuleOptsFormContext["ui"],
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
    }, true, true, groupPath(group, groups, pathPrefix));
    const fieldsStart = document.createComment("history-group");
    const fieldsEnd = document.createComment("/history-group");
    section.append(fieldsStart, fieldsEnd);

    const render = () => {
        const parent = fieldsStart.parentElement;
        if (parent == null || fieldsEnd.parentElement !== parent) {
            return;
        }
        while (fieldsStart.nextSibling !== fieldsEnd) {
            fieldsStart.nextSibling!.remove();
        }
        const staging = document.createElement("div");
        const id = `${prefix}-group-${randomString(8)}`;
        const base = groupPath(group, groups, pathPrefix);
        const nameInputId = `${id}-name`;
        ui.field(
            staging,
            nameInputId,
            "Content Manager group",
            ui.textInput(group.name, (value) => {
                group.name = value;
                ui.syncNamedBlockHeading(titleEl, "Group", indexOf(), value);
                ui.setPath(section, groupPath(group, groups, pathPrefix));
                ui.setFieldPath(section, nameInputId, groupPath(group, groups, pathPrefix));
            }),
            {
                path: base,
                help: "Content Manager group name whose views and listings are recorded.",
            },
        );
        ui.field(
            staging,
            `${id}-new-content`,
            "New content selectors",
            ui.textInput(group.newContentSelectors, (value) => {
                group.newContentSelectors = value;
            }),
            {
                path: `${base}.newContentSelectors`,
                help: "Comma-separated CSS selectors for markers of new subcontent on an entry. Matches set data-sm-has-new-content=\"true\". With Keep new content visible when hiding on, those entries stay visible when Hide Viewed/Listed Content is enabled.",
            },
        );
        ui.field(
            staging,
            `${id}-record-filter`,
            "Record filter",
            ui.textInput(group.recordFilter, (value) => {
                group.recordFilter = value;
            }),
            {
                path: `${base}.recordFilter`,
                help: "Comma-separated listing/view names (!! exclusions). Controls which names are written to history. Empty = all.",
            },
        );
        ui.field(
            staging,
            `${id}-decorate-filter`,
            "Decorate filter",
            ui.textInput(group.decorateFilter, (value) => {
                group.decorateFilter = value;
            }),
            {
                path: `${base}.decorateFilter`,
                help: "Comma-separated listing/view names (!! exclusions). Controls history markers, new-content flags, and hide. Empty = all.",
            },
        );
        ui.field(
            staging,
            `${id}-viewed-styles`,
            "Viewed styles",
            ui.textarea(group.viewedStyles, (value) => {
                group.viewedStyles = value;
            }),
            {
                path: `${base}.viewedStyles`,
                help: "CSS rules with & as this group's viewed marker ([data-sm-history=\"viewed\"][data-sm-history-group=\"<group>\"]). Example: & { opacity: 0.5; } or & .card { border-left: 2px solid red; }",
                column: true,
            },
        );
        ui.field(
            staging,
            `${id}-listed-styles`,
            "Listed styles",
            ui.textarea(group.listedStyles, (value) => {
                group.listedStyles = value;
            }),
            {
                path: `${base}.listedStyles`,
                help: "CSS rules with & as this group's listed marker ([data-sm-history=\"listed\"][data-sm-history-group=\"<group>\"]). Example: & { outline: 2px solid yellow; } or & .card { border-left: 2px solid yellow; }",
                column: true,
            },
        );
        parent.insertBefore(staging, fieldsEnd);
        staging.replaceWith(...staging.childNodes);
    };

    render();
    return section;
}

function stringListToCsv(raw: unknown): string {
    if (!Array.isArray(raw)) {
        return "";
    }
    return joinCsv(raw.filter((entry): entry is string => typeof entry === "string"));
}

function emptyDraft(): DraftHistoryOpts {
    return { groups: [emptyGroup()] };
}

function emptyGroup(name = ""): DraftHistoryGroup {
    return {
        name,
        newContentSelectors: "",
        recordFilter: "",
        decorateFilter: "",
        viewedStyles: "",
        listedStyles: "",
    };
}

function ensureDraft(module: DraftIntegrationModule): void {
    if (module.historyOpts == null) {
        module.historyOpts = emptyDraft();
    }
}

ModuleOptsFormRegistry.register(historyOptsForm);

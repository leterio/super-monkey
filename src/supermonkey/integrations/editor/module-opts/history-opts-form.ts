import { joinCsv, splitCsv } from "../../../utils/string";
import { isPlainObject } from "../../../utils/type";
import type { DraftIntegrationModule } from "../draft-mappers";
import type { ModuleOptsForm } from "./module-opts-form";
import { ModuleOptsFormRegistry } from "./module-opts-form-registry";

const MODULE_KEY = "History";

const historyOptsForm: ModuleOptsForm = {
    moduleKey: MODULE_KEY,

    hydrate(module, opts) {
        module.historyOpts = {
            group: isPlainObject(opts) && typeof opts.group === "string" ? opts.group : "",
            newContentSelectors: stringListToCsv(opts, "newContentSelectors"),
            recordFilter: stringListToCsv(opts, "recordFilter"),
            decorateFilter: stringListToCsv(opts, "decorateFilter"),
            viewedStyles: isPlainObject(opts) && typeof opts.viewedStyles === "string"
                ? opts.viewedStyles
                : "",
            listedStyles: isPlainObject(opts) && typeof opts.listedStyles === "string"
                ? opts.listedStyles
                : "",
        };
        module.optsText = "";
    },

    mount(ctx) {
        const { module, host, ui, pathPrefix } = ctx;
        ensureDraft(module);
        const draft = module.historyOpts!;
        const id = `history-opts-${module.instanceName || "new"}`;

        ui.field(
            host,
            `${id}-group`,
            "Group",
            ui.textInput(draft.group, (value) => {
                draft.group = value;
            }),
            {
                path: `${pathPrefix}.group`,
                help: "Content Manager group name whose views and listings are recorded.",
            },
        );
        ui.field(
            host,
            `${id}-new-content`,
            "New content selectors",
            ui.textInput(draft.newContentSelectors, (value) => {
                draft.newContentSelectors = value;
            }),
            {
                path: `${pathPrefix}.newContentSelectors`,
                help: "Comma-separated CSS selectors for markers of new subcontent on an entry. Matches set data-sm-has-new-content=\"true\". With Keep new content visible when hiding on, those entries stay visible when Hide Viewed/Listed Content is enabled.",
            },
        );
        ui.field(
            host,
            `${id}-record-filter`,
            "Record filter",
            ui.textInput(draft.recordFilter, (value) => {
                draft.recordFilter = value;
            }),
            {
                path: `${pathPrefix}.recordFilter`,
                help: "Comma-separated listing/view names (!! exclusions). Controls which names are written to history. Empty = all.",
            },
        );
        ui.field(
            host,
            `${id}-decorate-filter`,
            "Decorate filter",
            ui.textInput(draft.decorateFilter, (value) => {
                draft.decorateFilter = value;
            }),
            {
                path: `${pathPrefix}.decorateFilter`,
                help: "Comma-separated listing/view names (!! exclusions). Controls history markers, new-content flags, and hide. Empty = all.",
            },
        );
        ui.field(
            host,
            `${id}-viewed-styles`,
            "Viewed styles",
            ui.textarea(draft.viewedStyles, (value) => {
                draft.viewedStyles = value;
            }),
            {
                path: `${pathPrefix}.viewedStyles`,
                help: "CSS rules with & as the viewed marker ([data-sm-history=\"viewed\"]). Example: & { opacity: 0.5; } or & .card { border-left: 2px solid red; }",
                column: true,
            },
        );
        ui.field(
            host,
            `${id}-listed-styles`,
            "Listed styles",
            ui.textarea(draft.listedStyles, (value) => {
                draft.listedStyles = value;
            }),
            {
                path: `${pathPrefix}.listedStyles`,
                help: "CSS rules with & as the listed marker ([data-sm-history=\"listed\"]). Example: & { outline: 2px solid yellow; } or & .card { border-left: 2px solid yellow; }",
                column: true,
            },
        );
    },

    toOpts(module) {
        ensureDraft(module);
        const draft = module.historyOpts!;
        const group = draft.group.trim();
        if (group.length === 0) {
            return {
                ok: false,
                issues: [{ path: "group", message: "Group is required." }],
            };
        }
        const newContentSelectors = splitCsv(draft.newContentSelectors);
        const recordFilter = splitCsv(draft.recordFilter);
        const decorateFilter = splitCsv(draft.decorateFilter);
        const viewedStyles = draft.viewedStyles.trim();
        const listedStyles = draft.listedStyles.trim();

        return {
            ok: true,
            value: {
                group,
                ...(newContentSelectors.length > 0 ? { newContentSelectors } : {}),
                ...(recordFilter.length > 0 ? { recordFilter } : {}),
                ...(decorateFilter.length > 0 ? { decorateFilter } : {}),
                ...(viewedStyles.length > 0 ? { viewedStyles } : {}),
                ...(listedStyles.length > 0 ? { listedStyles } : {}),
            },
        };
    },
};

function stringListToCsv(opts: unknown, key: string): string {
    if (!isPlainObject(opts) || !Array.isArray(opts[key])) {
        return "";
    }
    return joinCsv(opts[key].filter((entry): entry is string => typeof entry === "string"));
}

function ensureDraft(module: DraftIntegrationModule): void {
    if (module.historyOpts == null) {
        module.historyOpts = {
            group: "",
            newContentSelectors: "",
            recordFilter: "",
            decorateFilter: "",
            viewedStyles: "",
            listedStyles: "",
        };
    }
}

ModuleOptsFormRegistry.register(historyOptsForm);

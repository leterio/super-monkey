import { expandCssAmpersandPlaceholder } from "../../utils/dom/style";
import { passesPageFilter } from "../../utils/page-filter";
import { fillTokens } from "../../utils/string";
import type {
    EntitiesParsedEventPayload,
    EntityViewedEventPayload,
} from "../../content-manager/events";
import { Action } from "../configuration/action";
import type { Configuration } from "../configuration/configuration";
import { ArrayConfiguration } from "../configuration/impl/array";
import { BooleanConfiguration, BooleanStyleConfiguration } from "../configuration/impl/boolean";
import { Module } from "../module";
import { HistoryBackup } from "./history-backup";
import type { HistoryOpts } from "./history-opts";
import { HistoryStore } from "./history-store";
import { HAS_NEW_CONTENT_METADATA_KEY, HISTORY_METADATA_KEY, HistoryState } from "./metadata";

const LABEL = "History";
const DESCRIPTION = "A content history manager that marks listed and viewed content.";

enum CSSMap {
    hideViewedCSS = `[${HISTORY_METADATA_KEY}="${HistoryState.VIEWED}"]{{keepNewTemplateCSS}} { display: none !important; }`,
    hideListedCSS = `[${HISTORY_METADATA_KEY}="${HistoryState.LISTED}"]{{keepNewTemplateCSS}} { display: none !important; }`,
    keepNewTemplateCSS = `:not([${HAS_NEW_CONTENT_METADATA_KEY}="true"])`,
}

/**
 * Feature module that tracks listed/viewed content history.
 * Opts must already be normalized by {@link normalizeHistoryOpts} (via ModuleLoader).
 */
export class History extends Module<HistoryOpts> {
    private readonly listedHistoryArrayConfiguration = new ArrayConfiguration<string>(
        this.name,
        "listedHistory",
        [],
        {
            label: "Listed History",
            description: "Content IDs that have appeared in listing pages.",
        },
    );

    private readonly viewedHistoryArrayConfiguration = new ArrayConfiguration<string>(
        this.name,
        "viewedHistory",
        [],
        {
            label: "Viewed History",
            description: "Content IDs that have been opened.",
        },
    );

    private readonly clearHistoryAction = new Action(
        this.name,
        "clearHistory",
        this.onClearHistoryClicked.bind(this),
        {
            label: "Clear History",
            description: "Permanently clear listed and viewed history (asks for confirmation).",
        },
    );
    private readonly backupHistoryAction = new Action(
        this.name,
        "backupHistory",
        this.onBackupHistoryClicked.bind(this),
        {
            label: "Backup History",
            description: "Download listed and viewed ids as JSON.",
        },
    );
    private readonly restoreHistoryAction = new Action(
        this.name,
        "restoreHistory",
        this.onRestoreHistoryClicked.bind(this),
        {
            label: "Restore History",
            description: "Merge ids from a JSON backup file.",
        },
    );

    private readonly store: HistoryStore;
    private readonly backup: HistoryBackup;
    private readonly newContentSelectors: readonly string[];
    private readonly viewedStyles: string;
    private readonly listedStyles: string;
    private readonly decorateViewedContentConfiguration: BooleanStyleConfiguration | null;
    private readonly decorateListedContentConfiguration: BooleanStyleConfiguration | null;
    private readonly showEntriesWithNewContentConfiguration: BooleanConfiguration | null;
    private readonly hideViewedContentConfiguration: BooleanStyleConfiguration;
    private readonly hideListedContentConfiguration: BooleanStyleConfiguration;

    constructor(name: string, opts: HistoryOpts) {
        super(name, opts);

        this.viewedStyles = opts.viewedStyles ?? "";
        this.listedStyles = opts.listedStyles ?? "";
        this.newContentSelectors = opts.newContentSelectors ?? [];
        this.decorateViewedContentConfiguration = this.viewedStyles.length > 0
            ? new BooleanStyleConfiguration(this.name, "decorateViewedContent", true, {
                label: "Decorate Viewed Content",
                description: "Decorate viewed entries with the configured viewed styles.",
                css: (enabled) => this.buildViewedDecorationCss(enabled),
            })
            : null;
        this.decorateListedContentConfiguration = this.listedStyles.length > 0
            ? new BooleanStyleConfiguration(this.name, "decorateListedContent", true, {
                label: "Decorate Listed Content",
                description: "Decorate listed entries with the configured listed styles.",
                css: (enabled) => this.buildListedDecorationCss(enabled),
            })
            : null;

        this.showEntriesWithNewContentConfiguration = this.newContentSelectors.length > 0
            ? new BooleanConfiguration(this.name, "showEntriesWithNewContent", true, {
                label: "Keep new content visible when hiding",
                description:
                    "When Hide Viewed Content or Hide Listed Content is on, still show entries marked with new content.",
            })
            : null;

        this.hideViewedContentConfiguration = new BooleanStyleConfiguration(
            this.name,
            "hideViewedContent",
            false,
            {
                label: "Hide Viewed Content",
                description:
                    "Hide viewed entries. Turning off may leave already-removed entries until the page reloads.",
                css: () => fillTokens(CSSMap.hideViewedCSS, {
                    keepNewTemplateCSS: this.shouldKeepNewContentVisible()
                        ? CSSMap.keepNewTemplateCSS
                        : "",
                }),
                triggeredBy: this.showEntriesWithNewContentConfiguration != null
                    ? [this.showEntriesWithNewContentConfiguration]
                    : [],
            },
        );

        this.hideListedContentConfiguration = new BooleanStyleConfiguration(
            this.name,
            "hideListedContent",
            false,
            {
                label: "Hide Listed Content",
                description:
                    "Hide listed entries. Turning off may leave already-removed entries until the page reloads.",
                css: () => fillTokens(CSSMap.hideListedCSS, {
                    keepNewTemplateCSS: this.shouldKeepNewContentVisible()
                        ? CSSMap.keepNewTemplateCSS
                        : "",
                }),
                triggeredBy: this.showEntriesWithNewContentConfiguration != null
                    ? [this.showEntriesWithNewContentConfiguration]
                    : [],
            },
        );

        this.store = new HistoryStore(
            this.name,
            this.listedHistoryArrayConfiguration,
            this.viewedHistoryArrayConfiguration,
            this.log,
        );
        this.backup = new HistoryBackup(this.store, this.log);
        this.store.watchRemoteFlushes();
    }

    override get title(): string {
        return LABEL;
    }

    override get description(): string | undefined {
        return DESCRIPTION;
    }

    override get configurations(): Configuration[] {
        return [
            ...(this.decorateViewedContentConfiguration != null
                ? [this.decorateViewedContentConfiguration]
                : []),
            ...(this.decorateListedContentConfiguration != null
                ? [this.decorateListedContentConfiguration]
                : []),
            this.hideViewedContentConfiguration,
            this.hideListedContentConfiguration,
            ...(this.showEntriesWithNewContentConfiguration != null
                ? [this.showEntriesWithNewContentConfiguration]
                : []),
            this.clearHistoryAction,
            this.backupHistoryAction,
            this.restoreHistoryAction,
        ];
    }

    markAsViewed(contentId: string): void {
        if (contentId == null || contentId.length === 0) {
            return;
        }

        if (this.store.viewed.has(contentId)) {
            return;
        }

        this.log.debug("Marking content as viewed:", contentId);
        this.store.viewed.addToSession(contentId);
        this.store.viewed.scheduleFlush();
    }

    override async onEntitiesParsed(data: EntitiesParsedEventPayload): Promise<void> {
        await super.onEntitiesParsed(data);
        this.log.debug("Handling entities parsed ...");

        const addressableContents = data.entities
            .get(this.opts.group)
            ?.filter((content) => content.id.length > 0 && content.element != null);
        if (addressableContents == null || addressableContents.length === 0) {
            return;
        }

        const listedHistory = this.store.listed.toPersistedSet();
        const viewedHistory = this.store.viewed.toPersistedSet();
        const shouldHideViewedContent = this.hideViewedContentConfiguration.value;
        const shouldHideListedContent = this.hideListedContentConfiguration.value;
        const shouldKeepNewContentVisible = this.shouldKeepNewContentVisible();
        this.log.debug("Listed history entries:", listedHistory.size, "Viewed:", viewedHistory.size);

        let hasNewListedEntries = false;

        for (const content of addressableContents) {
            const contentId = content.id;
            const canDecorate = History.passesNameFilter(this.opts.decorateFilter, content.name);
            const canRecord = History.passesNameFilter(this.opts.recordFilter, content.name);

            if (!canDecorate && !canRecord) {
                continue;
            }

            const hasNewContent = canDecorate
                ? this.applyHasNewContentMetadata(content.element)
                : false;
            const bypassHide = hasNewContent && shouldKeepNewContentVisible;

            if (
                this.store.viewed.hasInSession(contentId)
                || viewedHistory.has(contentId)
            ) {
                if (canDecorate) {
                    content.element.setAttribute(HISTORY_METADATA_KEY, HistoryState.VIEWED);
                    if (shouldHideViewedContent && !bypassHide) {
                        content.hide = true;
                    }
                }
            } else if (
                this.store.listed.hasInSession(contentId)
                || listedHistory.has(contentId)
            ) {
                if (canDecorate) {
                    content.element.setAttribute(HISTORY_METADATA_KEY, HistoryState.LISTED);
                    if (shouldHideListedContent && !bypassHide) {
                        content.hide = true;
                    }
                }
            } else {
                if (canDecorate) {
                    content.element.setAttribute(HISTORY_METADATA_KEY, HistoryState.UNREAD);
                }
                if (canRecord) {
                    this.store.listed.addToSession(contentId);
                    hasNewListedEntries = true;
                }
            }
        }

        if (hasNewListedEntries) {
            this.store.listed.scheduleFlush();
        }
    }

    override async onEntityViewed(data: EntityViewedEventPayload): Promise<void> {
        await super.onEntityViewed(data);

        if (data.entity.group !== this.opts.group) {
            return;
        }

        if (data.entity.id.length === 0) {
            return;
        }

        if (!History.passesNameFilter(this.opts.recordFilter, data.entity.name)) {
            return;
        }

        this.log.debug("Handling entity viewed for group:", data.entity.group, "id:", data.entity.id);
        this.markAsViewed(data.entity.id);
    }

    private async onClearHistoryClicked(): Promise<void> {
        await this.backup.clear();
    }

    private async onBackupHistoryClicked(): Promise<void> {
        await this.backup.backup();
    }

    private async onRestoreHistoryClicked(): Promise<void> {
        await this.backup.restore();
    }

    private shouldKeepNewContentVisible(): boolean {
        return this.showEntriesWithNewContentConfiguration?.value === true;
    }

    private buildViewedDecorationCss(enabled: boolean): string | null {
        if (enabled !== true || this.viewedStyles.length === 0) {
            return null;
        }

        return expandCssAmpersandPlaceholder(
            this.viewedStyles,
            `[${HISTORY_METADATA_KEY}="${HistoryState.VIEWED}"]`,
        );
    }

    private buildListedDecorationCss(enabled: boolean): string | null {
        if (enabled !== true || this.listedStyles.length === 0) {
            return null;
        }

        return expandCssAmpersandPlaceholder(
            this.listedStyles,
            `[${HISTORY_METADATA_KEY}="${HistoryState.LISTED}"]`,
        );
    }

    private applyHasNewContentMetadata(element: HTMLElement): boolean {
        const hasNewContent = this.matchesNewContentSelectors(element);
        if (hasNewContent) {
            element.setAttribute(HAS_NEW_CONTENT_METADATA_KEY, "true");
        } else {
            element.removeAttribute(HAS_NEW_CONTENT_METADATA_KEY);
        }
        return hasNewContent;
    }

    private matchesNewContentSelectors(element: HTMLElement): boolean {
        if (this.newContentSelectors.length === 0) {
            return false;
        }

        return this.newContentSelectors.some(
            (selector) => element.matches(selector) || element.querySelector(selector) != null,
        );
    }

    private static passesNameFilter(
        filter: readonly string[] | null | undefined,
        name: string,
    ): boolean {
        return passesPageFilter(filter, [name]);
    }
}

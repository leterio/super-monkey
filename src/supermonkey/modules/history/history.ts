import { expandCssAmpersandPlaceholder } from "../../utils/dom/style";
import { passesPageFilter } from "../../utils/page-filter";
import { fillTokens, isValidId } from "../../utils/string";
import type {
    EntitiesParsedEventPayload,
    EntityViewedEventPayload,
    ListedEntity,
} from "../../content-manager/events";
import { Action } from "../configuration/action";
import type { Configuration } from "../configuration/configuration";
import { ArrayConfiguration } from "../configuration/impl/array";
import { BooleanConfiguration, BooleanStyleConfiguration } from "../configuration/impl/boolean";
import { Module } from "../module";
import { HistoryBackup } from "./history-backup";
import type { HistoryGroupOpts, HistoryOpts } from "./history-opts";
import { HistoryStore } from "./history-store";
import {
    HAS_NEW_CONTENT_METADATA_KEY,
    HISTORY_GROUP_METADATA_KEY,
    HISTORY_METADATA_KEY,
    HistoryState,
} from "./metadata";

const LABEL = "History";
const DESCRIPTION = "A content history manager that marks listed and viewed content.";

enum CSSMap {
    hideCSS = `{{selector}}{{keepNewTemplateCSS}} { display: none !important; }`,
    keepNewTemplateCSS = `:not([${HAS_NEW_CONTENT_METADATA_KEY}="true"])`,
}

type HistoryGroupRuntime = {
    readonly groupKey: string;
    readonly opts: HistoryGroupOpts;
    readonly store: HistoryStore;
    readonly decorateViewedContentConfiguration: BooleanStyleConfiguration | null;
    readonly decorateListedContentConfiguration: BooleanStyleConfiguration | null;
    readonly hideViewedContentConfiguration: BooleanStyleConfiguration;
    readonly hideListedContentConfiguration: BooleanStyleConfiguration;
};

/**
 * Feature module that tracks listed/viewed content history.
 * Opts must already be normalized by {@link normalizeHistoryOpts} (via ModuleLoader).
 */
export class History extends Module<HistoryOpts> {
    private readonly groups: ReadonlyMap<string, HistoryGroupRuntime>;
    private readonly backup: HistoryBackup;
    private readonly showEntriesWithNewContentConfiguration: BooleanConfiguration | null;
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

    constructor(name: string, opts: HistoryOpts) {
        super(name, opts);

        const groupEntries = Object.entries(opts.groups);
        const labelGroup = groupEntries.length > 1;
        const hasNewContentSelectors = groupEntries.some(
            ([, group]) => (group.newContentSelectors?.length ?? 0) > 0,
        );

        this.showEntriesWithNewContentConfiguration = hasNewContentSelectors
            ? new BooleanConfiguration(this.name, "showEntriesWithNewContent", true, {
                label: "Keep new content visible when hiding",
                description:
                    "When a group's Hide Viewed Content or Hide Listed Content is on, still show entries marked with new content.",
            })
            : null;

        const hideTriggers = this.showEntriesWithNewContentConfiguration != null
            ? [this.showEntriesWithNewContentConfiguration]
            : [];

        this.groups = new Map(
            groupEntries.map(([groupKey, groupOpts]) => {
                const scopeId = History.toConfigurationGroupId(groupKey);
                const listed = new ArrayConfiguration<string>(
                    this.name,
                    `listedHistory::${scopeId}`,
                    [],
                );
                const viewed = new ArrayConfiguration<string>(
                    this.name,
                    `viewedHistory::${scopeId}`,
                    [],
                );

                const decorateViewedContentConfiguration = History.hasStyles(groupOpts.viewedStyles)
                    ? new BooleanStyleConfiguration(
                        this.name,
                        `decorateViewedContent::${scopeId}`,
                        true,
                        {
                            label: History.controlLabel("Decorate Viewed Content", groupKey, labelGroup),
                            description: "Decorate viewed entries with this group's viewed styles.",
                            css: (enabled) => History.buildGroupDecorationCss(
                                enabled,
                                groupOpts.viewedStyles,
                                HistoryState.VIEWED,
                                groupKey,
                            ),
                        },
                    )
                    : null;
                const decorateListedContentConfiguration = History.hasStyles(groupOpts.listedStyles)
                    ? new BooleanStyleConfiguration(
                        this.name,
                        `decorateListedContent::${scopeId}`,
                        true,
                        {
                            label: History.controlLabel("Decorate Listed Content", groupKey, labelGroup),
                            description: "Decorate listed entries with this group's listed styles.",
                            css: (enabled) => History.buildGroupDecorationCss(
                                enabled,
                                groupOpts.listedStyles,
                                HistoryState.LISTED,
                                groupKey,
                            ),
                        },
                    )
                    : null;
                const hideViewedContentConfiguration = new BooleanStyleConfiguration(
                    this.name,
                    `hideViewedContent::${scopeId}`,
                    false,
                    {
                        label: History.controlLabel("Hide Viewed Content", groupKey, labelGroup),
                        description:
                            "Hide viewed entries in this group. Turning off may leave already-removed entries until the page reloads.",
                        css: () => this.buildGroupHideCss(HistoryState.VIEWED, groupKey),
                        triggeredBy: hideTriggers,
                    },
                );
                const hideListedContentConfiguration = new BooleanStyleConfiguration(
                    this.name,
                    `hideListedContent::${scopeId}`,
                    false,
                    {
                        label: History.controlLabel("Hide Listed Content", groupKey, labelGroup),
                        description:
                            "Hide listed entries in this group. Turning off may leave already-removed entries until the page reloads.",
                        css: () => this.buildGroupHideCss(HistoryState.LISTED, groupKey),
                        triggeredBy: hideTriggers,
                    },
                );

                return [
                    groupKey,
                    {
                        groupKey,
                        opts: groupOpts,
                        store: new HistoryStore(this.name, scopeId, listed, viewed, this.log),
                        decorateViewedContentConfiguration,
                        decorateListedContentConfiguration,
                        hideViewedContentConfiguration,
                        hideListedContentConfiguration,
                    },
                ];
            }),
        );

        this.backup = new HistoryBackup(
            new Map(Array.from(this.groups.values(), (group) => [group.groupKey, group.store])),
            this.log,
        );
        for (const group of this.groups.values()) {
            group.store.watchRemoteFlushes();
        }
    }

    override get title(): string {
        return LABEL;
    }

    override get description(): string | undefined {
        return DESCRIPTION;
    }

    override get configurations(): Configuration[] {
        const values: Configuration[] = [];
        for (const group of this.groups.values()) {
            if (group.decorateViewedContentConfiguration != null) {
                values.push(group.decorateViewedContentConfiguration);
            }
            if (group.decorateListedContentConfiguration != null) {
                values.push(group.decorateListedContentConfiguration);
            }
            values.push(
                group.hideViewedContentConfiguration,
                group.hideListedContentConfiguration,
            );
        }
        if (this.showEntriesWithNewContentConfiguration != null) {
            values.push(this.showEntriesWithNewContentConfiguration);
        }
        values.push(
            this.clearHistoryAction,
            this.backupHistoryAction,
            this.restoreHistoryAction,
        );
        return values;
    }

    override async onEntitiesParsed(data: EntitiesParsedEventPayload): Promise<void> {
        await super.onEntitiesParsed(data);
        this.log.debug("Handling entities parsed ...");

        for (const [groupKey, entities] of data.entities) {
            const group = this.groups.get(groupKey);
            if (group == null) {
                continue;
            }

            this.handleParsedGroup(group, entities);
        }
    }

    override async onEntityViewed(data: EntityViewedEventPayload): Promise<void> {
        await super.onEntityViewed(data);

        const group = this.groups.get(data.entity.group);
        if (group == null || data.entity.id.length === 0) {
            return;
        }

        if (!History.passesNameFilter(group.opts.recordFilter, data.entity.name)) {
            return;
        }

        this.log.debug("Handling entity viewed for group:", data.entity.group, "id:", data.entity.id);
        this.markAsViewed(group.store, data.entity.id);
    }

    private handleParsedGroup(group: HistoryGroupRuntime, entities: readonly ListedEntity[]): void {
        const addressableContents = entities.filter(
            (content) => content.id.length > 0 && content.element != null,
        );
        if (addressableContents.length === 0) {
            return;
        }

        const listedHistory = group.store.listed.toPersistedSet();
        const viewedHistory = group.store.viewed.toPersistedSet();
        const shouldHideViewedContent = group.hideViewedContentConfiguration.value;
        const shouldHideListedContent = group.hideListedContentConfiguration.value;
        const shouldKeepNewContentVisible = this.shouldKeepNewContentVisible();
        this.log.debug(
            "Listed history entries:",
            listedHistory.size,
            "Viewed:",
            viewedHistory.size,
            "Group:",
            group.groupKey,
        );

        let hasNewListedEntries = false;

        for (const content of addressableContents) {
            const contentId = content.id;
            const canDecorate = History.passesNameFilter(group.opts.decorateFilter, content.name);
            const canRecord = History.passesNameFilter(group.opts.recordFilter, content.name);

            if (!canDecorate && !canRecord) {
                continue;
            }

            const hasNewContent = canDecorate
                ? this.applyHasNewContentMetadata(content.element, group.opts.newContentSelectors)
                : false;
            const bypassHide = hasNewContent && shouldKeepNewContentVisible;

            if (group.store.viewed.hasInSession(contentId) || viewedHistory.has(contentId)) {
                if (canDecorate) {
                    History.markHistoryState(content.element, group.groupKey, HistoryState.VIEWED);
                    if (shouldHideViewedContent && !bypassHide) {
                        content.hide = true;
                    }
                }
            } else if (group.store.listed.hasInSession(contentId) || listedHistory.has(contentId)) {
                if (canDecorate) {
                    History.markHistoryState(content.element, group.groupKey, HistoryState.LISTED);
                    if (shouldHideListedContent && !bypassHide) {
                        content.hide = true;
                    }
                }
            } else {
                if (canDecorate) {
                    History.markHistoryState(content.element, group.groupKey, HistoryState.UNREAD);
                }
                if (canRecord) {
                    group.store.listed.addToSession(contentId);
                    hasNewListedEntries = true;
                }
            }
        }

        if (hasNewListedEntries) {
            group.store.listed.scheduleFlush();
        }
    }

    private markAsViewed(store: HistoryStore, contentId: string): void {
        if (contentId.length === 0 || store.viewed.has(contentId)) {
            return;
        }

        this.log.debug("Marking content as viewed:", contentId);
        store.viewed.addToSession(contentId);
        store.viewed.scheduleFlush();
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

    private buildGroupHideCss(state: HistoryState, groupKey: string): string {
        return fillTokens(CSSMap.hideCSS, {
            selector: History.historyStateSelector(state, groupKey),
            keepNewTemplateCSS: this.shouldKeepNewContentVisible()
                ? CSSMap.keepNewTemplateCSS
                : "",
        });
    }

    private static buildGroupDecorationCss(
        enabled: boolean,
        styles: string | undefined,
        state: HistoryState,
        groupKey: string,
    ): string | null {
        if (enabled !== true || !History.hasStyles(styles)) {
            return null;
        }

        return expandCssAmpersandPlaceholder(
            styles,
            History.historyStateSelector(state, groupKey),
        );
    }

    private static markHistoryState(
        element: HTMLElement,
        groupKey: string,
        state: HistoryState,
    ): void {
        element.setAttribute(HISTORY_METADATA_KEY, state);
        element.setAttribute(HISTORY_GROUP_METADATA_KEY, groupKey);
    }

    private static historyStateSelector(state: HistoryState, groupKey: string): string {
        const group = CSS.escape(groupKey);
        return `[${HISTORY_METADATA_KEY}="${state}"][${HISTORY_GROUP_METADATA_KEY}="${group}"]`;
    }

    private static controlLabel(base: string, groupKey: string, labelGroup: boolean): string {
        return labelGroup ? `${base} — ${groupKey}` : base;
    }

    private static hasStyles(styles: string | undefined): styles is string {
        return styles != null && styles.length > 0;
    }

    private applyHasNewContentMetadata(
        element: HTMLElement,
        selectors: readonly string[] | undefined,
    ): boolean {
        const hasNewContent = History.matchesNewContentSelectors(element, selectors);
        if (hasNewContent) {
            element.setAttribute(HAS_NEW_CONTENT_METADATA_KEY, "true");
        } else {
            element.removeAttribute(HAS_NEW_CONTENT_METADATA_KEY);
        }
        return hasNewContent;
    }

    private static matchesNewContentSelectors(
        element: HTMLElement,
        selectors: readonly string[] | undefined,
    ): boolean {
        if (selectors == null || selectors.length === 0) {
            return false;
        }

        return selectors.some(
            (selector) => element.matches(selector) || element.querySelector(selector) != null,
        );
    }

    private static passesNameFilter(
        filter: readonly string[] | null | undefined,
        name: string,
    ): boolean {
        return passesPageFilter(filter, [name]);
    }

    private static toConfigurationGroupId(groupKey: string): string {
        return isValidId(groupKey) ? groupKey : Array.from(groupKey, (character) =>
            character.codePointAt(0)!.toString(16),
        ).join("_");
    }
}

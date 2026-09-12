import { EventBus } from "../../event-bus/event-bus";
import type { BeforeUnloadEventPayload, ContentLoadedEventPayload } from "../../lifecycle/events";
import { LifecycleAwareEvent } from "../../lifecycle/events";
import { SuperMonkey } from "../../supermonkey";
import { sleep } from "../../utils/async";
import { ItemState } from "../../utils/item-state";
import { Logger } from "../../utils/logger";
import { isValidId } from "../../utils/string";
import type { Configuration } from "../configuration/configuration";
import { NumberConfiguration } from "../configuration/impl/number";
import { Module } from "../module";
import type { NotificationEntry } from "../notification-bar/entries/notification-entry";
import { ProgressMenuEntry } from "../notification-bar/entries/progress-menu/progress-menu";
import type { AdditionalPagesOpts } from "./additional-pages-opts";
import {
    ContextManager,
    ContextManagerLoader,
} from "./context-manager/context-manager";
import iconSvgRaw from "./emblem-documents-svgrepo-com.svg?raw";
import type { LoadedPageResult, Page, PaginationContext } from "./metadata";
import {
    PageFetcher,
    type PageFetcherRequestOpts,
} from "./page-fetcher/page-fetcher";
import {
    resolveNumberedPagingOpts,
} from "./paging-strategy/numbered-paging-strategy";
import {
    PagingStrategy,
    PagingStrategyLoader,
} from "./paging-strategy/paging-strategy";

const LABEL = "Additional Pages";
const DESCRIPTION = "Loads additional listing pages and merges their content into the live document.";

type GroupBinderRuntime = {
    readonly groupKey: string;
    readonly contextManager: ContextManager;
    readonly pagingStrategy: PagingStrategy;
    readonly pageRequestOpts?: PageFetcherRequestOpts;
    readonly pagesToLoadConfiguration: NumberConfiguration;
};

type GroupRun = {
    readonly binder: GroupBinderRuntime;
    readonly pagesToLoad: number;
    readonly processedPages: Set<Page>;
    readonly loadedPageResults: Map<Page, LoadedPageResult>;
    readonly paginationContext: PaginationContext;
};

export class AdditionalPages extends Module<AdditionalPagesOpts> {
    private readonly notificationIcon: ProgressMenuEntry = new ProgressMenuEntry(iconSvgRaw, LABEL);

    private readonly pageLoadIntervalConfiguration = new NumberConfiguration(
        this.name,
        "pageLoadInterval",
        1000,
        {
            min: 100,
            max: 10000,
            label: "Page Load Interval (ms)",
            description: "Delay in milliseconds between each additional page request.",
        },
    );
    private readonly pageLoadTimeoutConfiguration = new NumberConfiguration(
        this.name,
        "pageLoadTimeout",
        10000,
        {
            min: 1000,
            max: 180000,
            label: "Page Load Timeout (ms)",
            description: "Per-request timeout in milliseconds.",
        },
    );

    private readonly binders: ReadonlyMap<string, GroupBinderRuntime>;
    private readonly pageFetcher: PageFetcher = new PageFetcher();
    private readonly groupRuns: Map<string, GroupRun> = new Map();
    private readonly pageRuns: WeakMap<Page, GroupRun> = new WeakMap();

    constructor(name: string, opts: AdditionalPagesOpts) {
        super(name, opts);

        this.binders = new Map(
            Object.entries(opts.groups).map(([groupKey, binder]) => {
                const pagingStrategy = PagingStrategyLoader.load(binder.pagingStrategy);
                const pageNumbering =
                    binder.pagingStrategy.type === "incremental" ||
                    binder.pagingStrategy.type === "decremental"
                        ? resolveNumberedPagingOpts(binder.pagingStrategy)
                        : undefined;
                const contextManager = ContextManagerLoader.load(
                    binder.contextManager,
                    pageNumbering,
                );

                return [
                    groupKey,
                    {
                        groupKey,
                        contextManager,
                        pagingStrategy,
                        pageRequestOpts: binder.pageRequestOpts,
                        pagesToLoadConfiguration: new NumberConfiguration(
                            this.name,
                            `pagesToLoad_${AdditionalPages.toConfigurationGroupId(groupKey)}`,
                            0,
                            {
                                min: 0,
                                max: 99,
                                label: `Pages to Load (${groupKey})`,
                                description:
                                    `Additional pages to load for Content Manager group "${groupKey}".`,
                            },
                        ),
                    },
                ];
            }),
        );
    }

    override get title(): string {
        return LABEL;
    }

    override get description(): string | undefined {
        return DESCRIPTION;
    }

    override get configurations(): Configuration[] {
        return [
            ...Array.from(this.binders.values(), (binder) => binder.pagesToLoadConfiguration),
            this.pageLoadIntervalConfiguration,
            this.pageLoadTimeoutConfiguration,
        ];
    }

    override get notifications(): NotificationEntry[] {
        return [this.notificationIcon];
    }

    protected override async onContentLoaded(data: ContentLoadedEventPayload): Promise<void> {
        if (data.document !== window.document) {
            return;
        }

        await this.loadAdditionalPages(data.document);
    }

    protected override async onBeforeUnload(data: BeforeUnloadEventPayload): Promise<void> {
        if (this.hasPendingPageLoads()) {
            data.notifyPendingOperations();
        }
    }

    private async loadAdditionalPages(sourceDocument: Document): Promise<void> {
        try {
            this.log.info("Preparing to load additional pages ...");
            this.groupRuns.clear();

            const contentManager = SuperMonkey.loadedIntegration?.contentManager;
            if (contentManager == null) {
                this.log.warn("No content manager loaded. Skipping additional pages loading.");
                this.notificationIcon.state = ItemState.DONE;
                return;
            }

            const matchingKeys = [...this.binders.keys()].filter((groupKey) =>
                contentManager.hasListingContext(sourceDocument, groupKey),
            );

            if (matchingKeys.length === 0) {
                this.log.info("No matching Content Manager listing groups. Skipping.");
                this.notificationIcon.state = ItemState.DONE;
                return;
            }

            this.notificationIcon.state = ItemState.PROGRESS;
            let hasGroupFailure = false;

            for (const groupKey of matchingKeys) {
                const binder = this.binders.get(groupKey)!;
                const pagesToLoad = binder.pagesToLoadConfiguration.value;
                if (pagesToLoad <= 0) {
                    this.log.info("Group", groupKey, ": pagesToLoad is 0. Skipping fetch.");
                    continue;
                }

                try {
                    this.notificationIcon.state = ItemState.PROGRESS;
                    await this.runGroup(binder, pagesToLoad);
                } catch (error) {
                    this.log.error("Group", groupKey, "failed:", error);
                    hasGroupFailure = true;
                    this.notificationIcon.state = ItemState.ERROR;
                }
            }

            this.notificationIcon.state = hasGroupFailure || this.hasAnyProgressError()
                ? ItemState.ERROR
                : ItemState.DONE;

            this.log.info("Additional pages loading finished.");
        } catch (error) {
            this.log.error("Failed to load additional pages.", error);
            this.notificationIcon.state = ItemState.ERROR;
        }
    }

    private async runGroup(
        binder: GroupBinderRuntime,
        pagesToLoad: number,
    ): Promise<void> {
        const paginationContext = binder.contextManager.resolveContext(
            binder.pagingStrategy.getDefaultPageNumber?.() ?? 1,
        );
        binder.pagingStrategy.validateContext(paginationContext);

        const run: GroupRun = {
            binder,
            pagesToLoad,
            processedPages: new Set([paginationContext.rootPage]),
            loadedPageResults: new Map(),
            paginationContext,
        };
        paginationContext.rootPage.groupKey = binder.groupKey;
        this.groupRuns.set(binder.groupKey, run);
        this.pageRuns.set(paginationContext.rootPage, run);

        this.log.debug(
            "Resolved pagination context for group",
            binder.groupKey,
            ". Current page:",
            paginationContext.cursor.number,
            "of",
            paginationContext.totalPages,
        );

        const lastLoad = await this.loadPages(run);
        this.finishLoadingPages(run, lastLoad);
    }

    private async loadPages(run: GroupRun): Promise<LoadedPageResult | null> {
        this.log.info(
            "Loading additional pages for group",
            run.binder.groupKey,
            ". Expected:",
            run.pagesToLoad,
            "additional pages.",
        );

        let lastLoad: LoadedPageResult | null = null;

        do {
            const cursor = run.paginationContext.cursor;
            this.log.debug("Cursor page:", cursor.number, "with state:", cursor.state);

            const requestedPagesToLoad = run.pagesToLoad - run.processedPages.size + 1;
            this.log.debug(
                "Resolving next pages to load. Expected:",
                requestedPagesToLoad,
                "next pages.",
            );

            const nextPagesToLoad = run.binder.pagingStrategy.resolveNextPages(
                run.paginationContext,
                requestedPagesToLoad,
                cursor,
                lastLoad?.paginators,
            );
            this.log.debug(
                "Resolved:",
                nextPagesToLoad.length,
                "next pages. Expected:",
                requestedPagesToLoad,
                "next pages.",
            );

            if (nextPagesToLoad.length === 0) {
                this.log.info("No more pages to load. Finishing additional pages loading.");
                break;
            }

            lastLoad = await this.loadResolvedNextPages(run, nextPagesToLoad);
            run.paginationContext.cursor = nextPagesToLoad.at(-1)!;
        } while (run.processedPages.size - 1 < run.pagesToLoad);

        return lastLoad;
    }

    private async loadResolvedNextPages(
        run: GroupRun,
        nextPagesToLoad: Page[],
    ): Promise<LoadedPageResult | null> {
        if (Logger.isTraceEnabled()) {
            this.log.trace("Loading next pages:", nextPagesToLoad);
        } else {
            this.log.debug("Loading", nextPagesToLoad.length, "next pages ...");
        }

        for (const page of nextPagesToLoad) {
            const pageLabel = page.label ?? String(page.number);
            page.groupKey = run.binder.groupKey;
            page.progress = this.notificationIcon.mapItem(
                `Additional Page [${run.binder.groupKey}] ${pageLabel}`,
                {
                    onRetry: () => {
                        void this.retryPage(page);
                    },
                },
            );
            run.processedPages.add(page);
            this.pageRuns.set(page, run);
        }

        let lastLoad: LoadedPageResult | null = null;

        for (const page of nextPagesToLoad) {
            await sleep(this.pageLoadIntervalConfiguration.value);

            this.log.info("Loading page", page.number, "...");
            lastLoad = await this.loadPage(run, page);
        }

        return lastLoad;
    }

    private async retryPage(page: Page): Promise<void> {
        if (page.state !== ItemState.ERROR) {
            return;
        }

        const groupKey = page.groupKey;
        if (groupKey == null) {
            return;
        }

        const binder = this.binders.get(groupKey);
        if (binder == null) {
            return;
        }

        try {
            const run = this.pageRuns.get(page);
            if (run == null) {
                this.log.error(
                    "Failed to retry page because its load run is unavailable",
                    page.number,
                    "for group",
                    groupKey,
                );
                return;
            }

            this.log.info("Retrying page", page.number, "for group", groupKey, "...");

            this.notificationIcon.state = ItemState.PROGRESS;
            const loadResult = await this.loadPage(run, page);

            this.finishLoadingPages(run, loadResult);
            this.notificationIcon.state = this.hasAnyProgressError()
                ? ItemState.ERROR
                : ItemState.DONE;
        } catch (error) {
            this.log.error("Failed to retry page", page.number, "for group", groupKey, error);
            this.notificationIcon.state = ItemState.ERROR;
        }
    }

    private async loadPage(run: GroupRun, page: Page): Promise<LoadedPageResult | null> {
        page.state = ItemState.PROGRESS;
        page.progress?.setStatus(ItemState.PROGRESS);

        try {
            const response = await this.pageFetcher.fetchPage(page, {
                timeoutMs: this.pageLoadTimeoutConfiguration.value,
                request: run.binder.pageRequestOpts,
            });

            page.url = response.finalUrl;
            page.progress?.setProgress(100);

            await EventBus.publish<ContentLoadedEventPayload>(LifecycleAwareEvent.CONTENT_LOADED, {
                document: response.content,
            });

            page.state = ItemState.DONE;
            page.progress?.setStatus(ItemState.DONE);

            const loadResult = this.toLoadedPageResult(run, response.content);
            run.loadedPageResults.set(page, loadResult);

            this.log.info("Page", page.number, "loaded successfully.");

            return loadResult;
        } catch (error) {
            this.log.error(`Page ${page.number} failed:`, error);
            page.state = ItemState.ERROR;
            page.progress?.setStatus(ItemState.ERROR);
            run.loadedPageResults.delete(page);
            return null;
        } finally {
            run.binder.contextManager.updatePaginators?.(run.paginationContext, page);
        }
    }

    private toLoadedPageResult(run: GroupRun, content: Document): LoadedPageResult {
        const paginators = run.binder.contextManager.bindPaginators?.(content);

        return {
            content,
            ...(paginators != null && paginators.length > 0 ? { paginators } : {}),
        };
    }

    private resolveFrontierLoad(
        run: GroupRun,
        fallback: LoadedPageResult | null,
    ): LoadedPageResult | null {
        const rootPage = run.paginationContext.rootPage;
        let frontier: LoadedPageResult | null = null;

        for (const page of run.processedPages) {
            if (page === rootPage || page.state !== ItemState.DONE) {
                continue;
            }

            const result = run.loadedPageResults.get(page);
            if (result != null) {
                frontier = result;
            }
        }

        return frontier ?? fallback;
    }

    private resolveAndApplyPaginatorPointers(
        run: GroupRun,
        lastLoad: LoadedPageResult | null,
    ): { previousPage: Page | null; nextPage: Page | null } {
        const frontierLoad = this.resolveFrontierLoad(run, lastLoad);

        const pointers = run.binder.pagingStrategy.resolvePaginatorPointers(
            run.paginationContext,
            run.pagesToLoad,
            frontierLoad?.paginators,
        );

        run.binder.contextManager.applyPaginatorPointers?.(
            run.paginationContext,
            pointers.previousPage,
            pointers.nextPage,
        );

        return pointers;
    }

    private finishLoadingPages(
        run: GroupRun,
        lastLoad: LoadedPageResult | null,
    ): void {
        if (this.hasPagesInState(run, ItemState.PROGRESS)) {
            return;
        }

        if (!this.areAllPagesDone(run)) {
            return;
        }

        if (run.pagesToLoad > 0) {
            this.log.debug("All pages loaded. Resolving and applying paginator pointers ...");
            this.resolveAndApplyPaginatorPointers(run, lastLoad);
        }
    }

    private hasPagesInState(run: GroupRun, state: ItemState): boolean {
        return Array.from(run.processedPages).some((page) => page.state === state);
    }

    private hasAnyProgressError(): boolean {
        return Array.from(this.groupRuns.values()).some((run) =>
            this.hasPagesInState(run, ItemState.ERROR),
        );
    }

    private hasPendingPageLoads(): boolean {
        return this.notificationIcon.state === ItemState.PROGRESS
            || Array.from(this.groupRuns.values()).some((run) =>
                this.hasPagesInState(run, ItemState.PROGRESS),
            );
    }

    private areAllPagesDone(run: GroupRun): boolean {
        return Array.from(run.processedPages).every((page) => page.state === ItemState.DONE);
    }

    private static toConfigurationGroupId(groupKey: string): string {
        return isValidId(groupKey) ? groupKey : Array.from(groupKey, (character) =>
            character.codePointAt(0)!.toString(16),
        ).join("_");
    }
}

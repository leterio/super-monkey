import { EventBus } from "../event-bus/event-bus";
import { Component } from "../lifecycle/component";
import {
    ContentLoadedEventPayload,
    IntegrationLoadedEventPayload,
    LifecycleAwareEvent,
} from "../lifecycle/events";
import { SuperMonkey } from "../supermonkey";
import { trimArray } from "../utils/arrays";
import { closestMatching } from "../utils/dom/elements";
import { query, queryAll } from "../utils/dom/query";
import { Logger } from "../utils/logger";
import { passesPageFilter } from "../utils/page-filter";
import { fillTokens, ID_SEPARATOR } from "../utils/string";
import { resolveValue, ValueSource } from "../utils/value-resolver";
import {
    ContentManagerEvents,
    EntitiesInjectedEventPayload,
    EntitiesParsedEventPayload,
    Entity,
    EntityViewedEventPayload,
    ListedEntity
} from "./events";
import {
    ContentManagerListing,
    ContentManagerMarkers,
    ContentManagerOpts,
    ContentManagerView,
    ScanMode,
} from "./metadata";

/**
 * Maps the live page into content groups and ids, and publishes parse/inject/view events.
 * Owns {@link LifecycleAwareEvent.CONTENT_LOADED}: publishes it after integration load and scans on each emission.
 */
export class ContentManager extends Component {
    private static readonly SCAN_WARN_THRESHOLD_MS = 100;

    private readonly viewedEntityKeys = new Set<string>();
    private intervalStarted = false;

    constructor(private readonly opts: ContentManagerOpts) {
        super("ContentManager");
    }

    protected override async onIntegrationLoaded(data: IntegrationLoadedEventPayload): Promise<void> {
        this.log.debug("Integration loaded; Publishing CONTENT_LOADED for live document");
        await EventBus.publish<ContentLoadedEventPayload>(LifecycleAwareEvent.CONTENT_LOADED, {
            document: data.document,
        });
    }

    protected override async onContentLoaded(data: ContentLoadedEventPayload): Promise<void> {
        const doc = data.document;
        if (doc == null) {
            this.log.warn("CONTENT_LOADED without document; skipping page scan");
            return;
        }

        this.log.debug(
            "Running page scan (views + listings)",
            doc === document ? "(live document)" : "(foreign document)",
        );
        const activePages = ContentManager.resolveActivePages();
        await this.scanViews(doc, false, activePages);
        await this.scanListings(doc, activePages);
        this.startIntervalScansIfNeeded();
    }

    hasListingContext(sourceDocument: Document, groupKey?: string): boolean {
        const activePages = ContentManager.resolveActivePages();
        const groupKeys =
            groupKey != null && groupKey.length > 0
                ? this.opts.groups[groupKey] != null
                    ? [groupKey]
                    : []
                : this.listingGroupKeys();

        return groupKeys.some((key) => {
            const listings = this.opts.groups[key]?.listings;
            if (listings == null || listings.length === 0) {
                return false;
            }

            return listings.some((listingOpts) => {
                if (!passesPageFilter(listingOpts.pageFilter, activePages)) {
                    return false;
                }
                return query(listingOpts.containerSelectors, sourceDocument) != null;
            });
        });
    }

    private async scanViews(
        sourceDocument: Document,
        selectorViewsOnly = false,
        activePages: readonly string[] = ContentManager.resolveActivePages(),
    ): Promise<void> {
        const entities = this.discoverViews(sourceDocument, selectorViewsOnly, activePages);
        if (entities.length === 0) {
            this.log.trace(
                selectorViewsOnly
                    ? "No selector view entities discovered"
                    : "No view entities discovered",
            );
            return;
        }

        if (Logger.isTraceEnabled()) {
            this.log.trace("Discovered view entities:", entities);
        } else {
            this.log.info("Discovered", entities.length, "view entities");
        }

        for (const entity of entities) {
            await EventBus.publish<EntityViewedEventPayload>(
                ContentManagerEvents.ENTITY_VIEWED,
                { entity },
            );
        }
    }

    private discoverViews(
        sourceDocument: Document,
        selectorViewsOnly: boolean,
        activePages: readonly string[],
    ): Entity[] {
        return this.timed("ContentManager.discoverViews", () => {
            const entities: Entity[] = [];

            for (const groupKey of Object.keys(this.opts.groups)) {
                const views = this.opts.groups[groupKey]?.views;
                if (views == null || views.length === 0) {
                    continue;
                }

                for (const view of views) {
                    if (!passesPageFilter(view.pageFilter, activePages)) {
                        continue;
                    }

                    const hasSelectors = view.selectors != null && view.selectors.length > 0;
                    if (selectorViewsOnly && !hasSelectors) {
                        continue;
                    }

                    if (hasSelectors) {
                        entities.push(...this.discoverSelectorView(groupKey, view, sourceDocument));
                    } else {
                        const entity = this.discoverUrlView(groupKey, view);
                        if (entity != null) {
                            entities.push(entity);
                        }
                    }
                }
            }

            return entities;
        });
    }

    private discoverUrlView(groupKey: string, view: ContentManagerView): Entity | null {
        const id = ContentManager.resolveEntityId(view.idSource);
        if (id == null) {
            return null;
        }

        if (this.hasViewedEntity(groupKey, id)) {
            return null;
        }

        this.rememberViewedEntity(groupKey, id);
        return { id, group: groupKey, name: view.name };
    }

    private discoverSelectorView(
        groupKey: string,
        view: ContentManagerView,
        sourceDocument: Document,
    ): Entity[] {
        const selectors = view.selectors;
        if (selectors == null || selectors.length === 0) {
            return [];
        }

        const entities: Entity[] = [];

        for (const element of queryAll(selectors, sourceDocument)) {
            if (ContentManager.isViewed(element, groupKey)) {
                continue;
            }

            this.log.trace("View selector matched element for group:", groupKey, element);

            const id = ContentManager.resolveEntityId(view.idSource, element);
            if (id == null) {
                this.log.trace("View id unresolved for group:", groupKey, element);
                continue;
            }

            if (this.hasViewedEntity(groupKey, id)) {
                ContentManager.markViewed(element, groupKey);
                continue;
            }

            ContentManager.markViewed(element, groupKey);
            this.log.trace("Marked viewed:", groupKey, id);
            this.rememberViewedEntity(groupKey, id);
            entities.push({
                id,
                group: groupKey,
                element,
                name: view.name,
            });
        }

        return entities;
    }

    private hasViewedEntity(groupKey: string, id: string): boolean {
        return this.viewedEntityKeys.has(ContentManager.viewedEntityKey(groupKey, id));
    }

    private rememberViewedEntity(groupKey: string, id: string): void {
        this.viewedEntityKeys.add(ContentManager.viewedEntityKey(groupKey, id));
    }

    private static viewedEntityKey(groupKey: string, id: string): string {
        return `${groupKey}${ID_SEPARATOR}${id}`;
    }

    private static resolveEntityId(
        sources: ValueSource | readonly ValueSource[],
        element?: HTMLElement,
    ): string | null {
        const list = Array.isArray(sources) ? sources : [sources];
        for (const source of list) {
            const id = resolveValue(source, element);
            if (id != null && id.length > 0) {
                return id;
            }
        }
        return null;
    }

    private static isViewed(element: HTMLElement, groupKey: string): boolean {
        return ContentManager.hasMarker(element, ContentManagerMarkers.VIEWED, groupKey);
    }

    private static markViewed(element: HTMLElement, groupKey: string): void {
        ContentManager.addMarker(element, ContentManagerMarkers.VIEWED, groupKey);
    }

    private async scanListings(
        sourceDocument: Document,
        activePages: readonly string[] = ContentManager.resolveActivePages(),
    ): Promise<void> {
        const groupKeys = this.listingGroupKeys();
        if (groupKeys.length === 0) {
            this.log.trace("No listing groups configured");
            return;
        }

        const discovered = this.discoverListings(sourceDocument, groupKeys, activePages);
        const hasEntities = [...discovered.values()].some((entities) => entities.length > 0);
        if (!hasEntities) {
            this.log.trace("No new listing entities discovered");
            return;
        }

        if (Logger.isTraceEnabled()) {
            this.log.trace("Discovered listing entities:", [...discovered.values()].flat());
        } else {
            this.log.info("Discovered", [...discovered.values()].flat().length, "new listing entities");
        }

        await EventBus.publish<EntitiesParsedEventPayload>(
            ContentManagerEvents.ENTITIES_PARSED,
            { entities: discovered },
        );
        await this.processListing(discovered, sourceDocument);
    }

    private listingGroupKeys(): string[] {
        return Object.keys(this.opts.groups).filter((groupKey) => {
            const listings = this.opts.groups[groupKey]?.listings;
            return listings != null && listings.length > 0;
        });
    }

    private discoverListings(
        sourceDocument: Document,
        groupKeys: readonly string[],
        activePages: readonly string[],
    ): Map<string, ListedEntity[]> {
        return this.timed("ContentManager.discoverListings", () => {
            return new Map(
                groupKeys.map((groupKey): [string, ListedEntity[]] => [
                    groupKey,
                    this.discoverGroupListings(sourceDocument, groupKey, activePages),
                ]),
            );
        });
    }

    private discoverGroupListings(
        sourceDocument: Document,
        groupKey: string,
        activePages: readonly string[],
    ): ListedEntity[] {
        const groupOpts = this.opts.groups[groupKey];
        if (groupOpts?.listings == null || groupOpts.listings.length === 0) {
            return [];
        }

        return groupOpts.listings.flatMap((listingOpts) => {
            if (!passesPageFilter(listingOpts.pageFilter, activePages)) {
                return [];
            }
            return this.discoverListingOpts(sourceDocument, groupKey, listingOpts);
        });
    }

    private discoverListingOpts(
        sourceDocument: Document,
        groupKey: string,
        listingOpts: ContentManagerListing,
    ): ListedEntity[] {
        const containers = queryAll(listingOpts.containerSelectors, sourceDocument);
        if (containers.length === 0) {
            this.log.trace("No listing containers for group:", groupKey);
            return [];
        }

        this.log.trace(
            "Listing containers for group:",
            groupKey,
            containers.length,
            listingOpts.containerSelectors,
        );

        return containers.flatMap((container) =>
            this.discoverEntriesInContainer(groupKey, listingOpts, container),
        );
    }

    private discoverEntriesInContainer(
        groupKey: string,
        listingOpts: ContentManagerListing,
        container: HTMLElement,
    ): ListedEntity[] {
        const entities: ListedEntity[] = [];

        for (const matched of queryAll(listingOpts.entriesSelectors, container)) {
            this.log.trace("Listing entry selector matched for group:", groupKey, matched);

            const managedElement = ContentManager.resolveManagedElement(
                matched,
                container,
                listingOpts.entryContainerSelector,
            );
            if (managedElement == null) {
                this.log.trace("Entry container unresolved for group:", groupKey, matched);
                continue;
            }

            if (ContentManager.isListed(managedElement, groupKey)) {
                continue;
            }

            const id = ContentManager.resolveEntityId(listingOpts.entryIdSource, matched);
            if (id == null) {
                this.log.trace("Listing entry id unresolved for group:", groupKey, matched);
                continue;
            }

            ContentManager.markListed(managedElement, groupKey);
            ContentManager.markId(managedElement, groupKey, id);
            this.log.trace("Marked listed:", groupKey, id);
            entities.push({
                id,
                group: groupKey,
                element: managedElement,
                name: listingOpts.name,
            });
        }

        this.cleanupListingContainer(container, groupKey, listingOpts);
        return entities;
    }

    private cleanupListingContainer(
        container: HTMLElement,
        groupKey: string,
        listingOpts: ContentManagerListing,
    ): void {
        const cleanup = listingOpts.cleanup;
        if (cleanup == null) {
            return;
        }

        if ("removeNonEntities" in cleanup) {
            this.removeNonEntityChildren(container, groupKey);
            return;
        }

        this.removeSelectorMatches(container, groupKey, cleanup.removeSelectors);
    }

    private removeNonEntityChildren(container: HTMLElement, groupKey: string): void {
        const entities = ContentManager.listedEntitiesInContainer(container, groupKey);
        if (entities.size === 0) {
            this.log.trace(
                "Cleanup removeNonEntities: no listed entities in container for group:",
                groupKey,
            );
        }

        for (const child of [...container.children]) {
            if (!(child instanceof HTMLElement)) {
                continue;
            }

            if (entities.has(child)) {
                continue;
            }

            const containsEntity = [...entities].some((entity) => child.contains(entity));
            if (containsEntity) {
                continue;
            }

            this.log.trace("Cleanup removeNonEntities: removing child for group:", groupKey, child);
            child.remove();
        }
    }

    private removeSelectorMatches(
        container: HTMLElement,
        groupKey: string,
        removeSelectors: string[],
    ): void {
        const entities = ContentManager.listedEntitiesInContainer(container, groupKey);

        for (const matched of queryAll(removeSelectors, container)) {
            if (entities.has(matched)) {
                this.log.trace(
                    "Cleanup removeSelectors: skipping listed entity for group:",
                    groupKey,
                    matched,
                );
                continue;
            }

            this.log.trace("Cleanup removeSelectors: removing match for group:", groupKey, matched);
            matched.remove();
        }
    }

    private static listedEntitiesInContainer(
        container: HTMLElement,
        groupKey: string,
    ): Set<HTMLElement> {
        const entities = new Set<HTMLElement>();
        for (const element of queryAll(`[${ContentManagerMarkers.LISTED}]`, container)) {
            if (ContentManager.isListed(element, groupKey)) {
                entities.add(element);
            }
        }
        return entities;
    }

    private static resolveManagedElement(
        matched: HTMLElement,
        container: HTMLElement,
        entryContainerSelector: string[] | undefined,
    ): HTMLElement | null {
        if (entryContainerSelector == null || entryContainerSelector.length === 0) {
            return matched;
        }

        const closest = closestMatching(matched, entryContainerSelector);
        if (closest == null || !container.contains(closest)) {
            return null;
        }

        return closest;
    }

    private static isListed(element: HTMLElement, groupKey: string): boolean {
        return ContentManager.hasMarker(element, ContentManagerMarkers.LISTED, groupKey);
    }

    private static markListed(element: HTMLElement, groupKey: string): void {
        ContentManager.addMarker(element, ContentManagerMarkers.LISTED, groupKey);
    }

    private static markId(element: HTMLElement, groupKey: string, id: string): void {
        ContentManager.addMarker(element, fillTokens(ContentManagerMarkers.ID, { GROUP_KEY: groupKey }), id);
    }

    private static markerTokens(element: HTMLElement, attribute: string): string[] {
        const value = element.getAttribute(attribute);
        if (value == null || value.length === 0) {
            return [];
        }
        return trimArray(value.split(/\s+/));
    }

    private static hasMarker(element: HTMLElement, attribute: string, groupKey: string): boolean {
        return ContentManager.markerTokens(element, attribute).includes(groupKey);
    }

    private static addMarker(element: HTMLElement, attribute: string, groupKey: string): void {
        const tokens = ContentManager.markerTokens(element, attribute);
        if (tokens.includes(groupKey)) {
            return;
        }
        tokens.push(groupKey);
        element.setAttribute(attribute, tokens.join(" "));
    }

    private async processListing(
        parsedContent: Map<string, ListedEntity[]>,
        sourceDocument: Document,
    ): Promise<void> {
        const remaining = new Map<string, ListedEntity[]>();
        let hiddenCount = 0;
        let injectedCount = 0;
        const injectIntoLive = sourceDocument !== document;

        for (const [groupKey, content] of parsedContent.entries()) {
            const kept: ListedEntity[] = [];
            const container = this.findFirstLiveContainer(groupKey);

            for (const entity of content) {
                if (entity.hide === true) {
                    this.log.trace("Removing hidden listing entity:", groupKey, entity.id);
                    entity.element.remove();
                    hiddenCount += 1;
                    continue;
                }

                if (injectIntoLive) {
                    if (container == null) {
                        this.log.warn(
                            "No live listing container for group:",
                            groupKey,
                            "- skipping inject of entity:",
                            entity.id,
                        );
                        continue;
                    }
                    this.log.trace("Injecting listing entity into live DOM:", groupKey, entity.id);
                    container.appendChild(entity.element);
                    injectedCount += 1;
                }

                kept.push({
                    id: entity.id,
                    group: entity.group,
                    name: entity.name,
                    element: entity.element,
                });
            }

            remaining.set(groupKey, kept);
        }

        this.log.debug(
            "Listing apply finished: hidden",
            hiddenCount,
            "injected",
            injectedCount,
            "kept",
            [...remaining.values()].flat().length,
        );

        await EventBus.publish<EntitiesInjectedEventPayload>(
            ContentManagerEvents.ENTITIES_INJECTED,
            { entities: remaining },
        );
    }

    private findFirstLiveContainer(groupKey: string): HTMLElement | null {
        const groupOpts = this.opts.groups[groupKey];
        if (groupOpts?.listings == null) {
            return null;
        }

        const activePages = ContentManager.resolveActivePages();
        for (const listingOpts of groupOpts.listings) {
            if (!passesPageFilter(listingOpts.pageFilter, activePages)) {
                continue;
            }
            const container = query(listingOpts.containerSelectors, document);
            if (container != null) {
                return container;
            }
        }

        return null;
    }

    private startIntervalScansIfNeeded(): void {
        if (this.intervalStarted) {
            return;
        }

        if (this.opts.scanMode !== ScanMode.INTERVAL) {
            return;
        }

        const intervalMs = this.opts.scanIntervalMs;
        if (intervalMs == null) {
            return;
        }

        this.intervalStarted = true;

        this.log.debug("Interval scan every", intervalMs, "ms");

        window.setInterval(() => {
            void this.scanInterval();
        }, intervalMs);
    }

    private async scanInterval(): Promise<void> {
        const activePages = ContentManager.resolveActivePages();
        await this.scanViews(document, true, activePages);
        await this.scanListings(document, activePages);
    }

    private static resolveActivePages(): readonly string[] {
        return SuperMonkey.loadedIntegration?.getActivePages() ?? [];
    }

    private timed<T>(label: string, fn: () => T): T {
        const startTime = performance.now();
        const result = fn();
        const duration = performance.now() - startTime;
        if (duration > ContentManager.SCAN_WARN_THRESHOLD_MS) {
            this.log.warn(`${label} execution took too long: ${duration}ms`);
        }
        return result;
    }
}

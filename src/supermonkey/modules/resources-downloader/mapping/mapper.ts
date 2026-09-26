import { ListedEntity } from "../../../content-manager/events";
import { SuperMonkey } from "../../../supermonkey";
import { traceDuration } from "../../../utils/async";
import { QueryableBaseElement, queryAll } from "../../../utils/dom/query";
import { ItemState } from "../../../utils/item-state";
import { Logger } from "../../../utils/logger";
import { passesPageFilter } from "../../../utils/page-filter";
import {
    MAPPED_BY_ATTR,
    RESOURCE_STATE_ATTR,
    Resource,
    ResourceCollection,
    ResourceLeaf,
    ResourcesMapping,
    ResourcesMappingCollection,
} from "../metadata";

const MAPPING_DURATION_WARNING_MS = 100;
const MAPPING_DURATION_WARNING_MESSAGE = "Check the mappings configuration to ensure they are efficient and do not contain any slow selectors";

export class ResourcesMapper {
    private readonly log: Logger = new Logger("ResourcesMapper");
    private readonly entryPoints: readonly string[];

    constructor(
        private readonly mappings: Record<string, ResourcesMapping>,
        entryPoints: readonly string[] | undefined,
        private readonly onMapped: (resources: Resource[]) => void,
    ) {
        if (entryPoints == null || entryPoints.length === 0) {
            throw new Error("No entry points provided");
        }

        this.entryPoints = entryPoints;
    }

    scanListing(listing: Map<string, ListedEntity[]>): void {
        this.log.debug("Mapping resources for listing ...");
        this.emitFrom(Array.from(listing.values()).flat().map((entry) => entry.element));
    }

    scanEntryElement(element: HTMLElement): void {
        this.log.debug("Mapping resources for entry element ...");
        this.emitFrom([element]);
    }

    private emitFrom(bases: QueryableBaseElement[]): void {
        const resources = traceDuration(
            "Mapping downloadable resources",
            () => this.mapFrom(bases),
            {
                log: this.log,
                warnThresholdMs: MAPPING_DURATION_WARNING_MS,
                warnAdditionalMessage: MAPPING_DURATION_WARNING_MESSAGE,
            },
        );

        this.onMapped(resources);
    }

    private mapFrom(bases: QueryableBaseElement[]): Resource[] {
        const activePages = SuperMonkey.loadedIntegration?.getActivePages() ?? [];
        const resources = bases.flatMap((base) =>
            this.entryPoints.flatMap((key) => this.scanMapping(key, base, activePages)),
        );
        this.log.debug("Found", resources.length, "resources on", bases.length, "base elements");

        return resources;
    }

    private scanMapping(
        mappingKey: string,
        baseElement: QueryableBaseElement,
        activePages: readonly string[],
    ): Resource[] {
        const mapping = this.mappings[mappingKey];
        if (mapping == null) {
            this.log.warn(`Unknown mapping key: ${mappingKey}`);
            return [];
        }

        if (!passesPageFilter(mapping.pageFilter, activePages)) {
            this.log.trace("Skipping mapping", mappingKey, "because it does not pass page filter", mapping.pageFilter, "on", activePages);
            return [];
        }

        return ResourcesMapper.collectMappingElements(mapping.selectors, baseElement)
            .filter((element) => !element.hasAttribute(MAPPED_BY_ATTR))
            .flatMap((element) => {
                if (mapping.type === "collection") {
                    return this.scanCollectionElement(element, mappingKey, mapping, activePages);
                }

                return [ResourcesMapper.createLeaf(element, mappingKey)];
            });
    }

    private static collectMappingElements(
        selectors: string[],
        baseElement: QueryableBaseElement,
    ): HTMLElement[] {
        const found = queryAll<HTMLElement>(selectors, baseElement);
        const withSelf = ResourcesMapper.prependSelfMatch(selectors, baseElement, found);
        return ResourcesMapper.dedupeElements(withSelf);
    }

    private static prependSelfMatch(
        selectors: string[],
        baseElement: QueryableBaseElement,
        found: HTMLElement[],
    ): HTMLElement[] {
        if (!(baseElement instanceof HTMLElement)) {
            return found;
        }

        const matchesSelf = selectors.some((selector) => {
            try {
                return baseElement.matches(selector);
            } catch {
                return false;
            }
        });

        if (matchesSelf && !found.includes(baseElement)) {
            return [baseElement, ...found];
        }

        return found;
    }

    private static dedupeElements(elements: readonly HTMLElement[]): HTMLElement[] {
        const seen = new Set<HTMLElement>();
        const result: HTMLElement[] = [];

        for (const element of elements) {
            if (seen.has(element)) {
                continue;
            }

            seen.add(element);
            result.push(element);
        }

        return result;
    }

    private scanCollectionElement(
        element: HTMLElement,
        mappedBy: string,
        mapping: ResourcesMappingCollection,
        activePages: readonly string[],
    ): Resource[] {
        const childResources = mapping.children.flatMap((childKey) =>
            this.scanMapping(childKey, element, activePages),
        );

        if (childResources.length === 0) {
            return [];
        }

        element.setAttribute(MAPPED_BY_ATTR, mappedBy);

        if (childResources.length === 1 && childResources[0]!.type === "leaf") {
            return [childResources[0]!];
        }

        const collection: ResourceCollection = {
            type: "collection",
            state: ItemState.PENDING,
            element,
            mappedBy,
            children: childResources,
        };

        element.setAttribute(RESOURCE_STATE_ATTR, ItemState.PENDING);

        for (const child of childResources) {
            child.parent = collection;
        }

        return [collection];
    }

    private static createLeaf(element: HTMLElement, mappedBy: string): ResourceLeaf {
        element.setAttribute(MAPPED_BY_ATTR, mappedBy);
        element.setAttribute(RESOURCE_STATE_ATTR, ItemState.PENDING);

        return {
            type: "leaf",
            state: ItemState.PENDING,
            element,
            mappedBy,
        };
    }
}

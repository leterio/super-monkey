import type {
    EntitiesInjectedEventPayload,
    EntityViewedEventPayload,
} from "../../content-manager/events";
import type { BeforeUnloadEventPayload } from "../../lifecycle/events";
import { injectStyle } from "../../utils/dom/style";
import { TOKENS_CSS } from "../../utils/ui/ui-builder";
import type { Configuration } from "../configuration/configuration";
import { NumberConfiguration } from "../configuration/impl/number";
import { Module } from "../module";
import type { NotificationEntry } from "../notification-bar/entries/notification-entry";
import { ProgressMenuEntry } from "../notification-bar/entries/progress-menu/progress-menu";
import { ResourcesDecorator } from "./decorator/decorator";
import { DownloadOrchestrator } from "./download/orchestrator";
import { BUILTIN_RESOURCES_MAPPINGS } from "./mapping/builtin";
import { ResourcesMapper } from "./mapping/mapper";
import type { Resource, ResourcesMapping } from "./metadata";
import decorationCss from "./resources-decoration.css?raw";
import type { ResourcesDownloaderOpts } from "./resources-downloader-opts";
import iconSvgRaw from "./save-svgrepo-com.svg?raw";

const LABEL = "Resources Downloader";
const DESCRIPTION = "Maps and downloads resources from Content Manager listing and view entries.";

/**
 * Feature module that maps downloadable resources inside listed entries and runs downloads.
 * Opts must already be normalized by {@link normalizeResourcesDownloaderOpts} (via ModuleLoader).
 */
export class ResourcesDownloader extends Module<ResourcesDownloaderOpts> {
    private readonly progressMenu: ProgressMenuEntry;
    private readonly resourcesMapper: ResourcesMapper;
    private readonly decorator: ResourcesDecorator;
    private readonly downloadOrchestrator: DownloadOrchestrator;
    private readonly resources: Resource[] = [];

    private readonly parallelDownloadsConfiguration = new NumberConfiguration(
        this.name,
        "parallelDownloads",
        10,
        {
            label: "Parallel downloads",
            description: "Maximum concurrent downloads.",
            min: 1,
            max: 50,
        },
    );

    private readonly downloadRetriesConfiguration = new NumberConfiguration(
        this.name,
        "downloadRetries",
        0,
        {
            label: "Download retries",
            description: "Automatic retries after a failed download (0 disables auto-retry).",
            min: 0,
            max: 10,
        },
    );

    private readonly downloadRetryIntervalMsConfiguration = new NumberConfiguration(
        this.name,
        "downloadRetryIntervalMs",
        1000,
        {
            label: "Download retry interval (ms)",
            description: "Delay before an automatic retry is queued.",
            min: 1000,
            max: 30000,
        },
    );

    constructor(name: string, opts: ResourcesDownloaderOpts) {
        super(name, opts);

        this.progressMenu = new ProgressMenuEntry(iconSvgRaw, LABEL, {
            additionalButtons: [
                {
                    label: "Download All",
                    title:
                        "Ignores leaves whose URL matches another leaf in this run; skipped leaves stay skipped on later Download All runs until downloaded manually.",
                    onClick: this.onDownloadAllClick,
                },
                { label: "Retry All", onClick: this.onRetryAllClick },
                { label: "Cancel All", onClick: this.onCancelAllClick },
            ],
        });
        const mappings = ResourcesDownloader.consolidateMappings(opts.mappings);
        this.resourcesMapper = new ResourcesMapper(
            mappings,
            opts.entryPoints!,
            (resources) => this.registerResources(resources),
        );
        this.decorator = new ResourcesDecorator(mappings);
        this.downloadOrchestrator = new DownloadOrchestrator(
            this.progressMenu,
            this.resources,
            mappings,
            opts.downloadModes ?? [],
            this.parallelDownloadsConfiguration,
            this.downloadRetriesConfiguration,
            this.downloadRetryIntervalMsConfiguration,
        );

        injectStyle(`${TOKENS_CSS}\n${decorationCss}`);
    }

    override get title(): string {
        return LABEL;
    }

    override get description(): string | undefined {
        return DESCRIPTION;
    }

    override get configurations(): Configuration[] {
        return [
            this.parallelDownloadsConfiguration,
            this.downloadRetriesConfiguration,
            this.downloadRetryIntervalMsConfiguration,
        ];
    }

    override get notifications(): NotificationEntry[] {
        return [this.progressMenu];
    }

    override async onEntityViewed(data: EntityViewedEventPayload): Promise<void> {
        const entry = {
            ...data.entity,
            element: data.entity.element ?? document.body,
        };

        this.resourcesMapper.scanEntryElement(entry.element);
    }

    override async onEntitiesInjected(data: EntitiesInjectedEventPayload): Promise<void> {
        this.resourcesMapper.scanListing(data.entities);
    }

    protected override async onBeforeUnload(data: BeforeUnloadEventPayload): Promise<void> {
        if (this.downloadOrchestrator.hasInProgressDownloads()) {
            data.notifyPendingOperations();
        }
    }

    private registerResources(resources: Resource[]): void {
        this.log.debug("Registering", resources.length, "resources");

        if (resources.length === 0) {
            return;
        }

        this.resources.push(...resources);
        this.decorator.decorate(resources, this.onDownloadClick);
    }

    private readonly onDownloadClick = async (resource: Resource): Promise<void> => {
        this.log.debug("Handling download click for resource", resource);

        if (resource == null) {
            return;
        }

        await this.downloadOrchestrator.start(resource);
    };

    private readonly onDownloadAllClick = async (): Promise<void> => {
        this.log.debug("Handling menu download all click");
        await this.downloadOrchestrator.downloadAll();
    };

    private readonly onRetryAllClick = async (): Promise<void> => {
        this.log.debug("Handling menu retry all click");
        await this.downloadOrchestrator.retryAll();
    };

    private readonly onCancelAllClick = (): void => {
        this.log.debug("Handling menu cancel all click");
        this.downloadOrchestrator.cancelAll();
    };

    private static consolidateMappings(
        userMappings: Record<string, ResourcesMapping>,
    ): Record<string, ResourcesMapping> {
        return {
            ...BUILTIN_RESOURCES_MAPPINGS,
            ...userMappings,
        };
    }
}

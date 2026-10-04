import { Integration, IntegrationModule } from "../integrations/metadata";
import { Logger } from "../utils/logger";
import { Normalized, OptsNormalization, formatOptsFindingsOfKind } from "../utils/opts/normalization";
import { reportUnrecognizedKeys } from "../utils/opts/opts-fields";
import { mergeIds } from "../utils/string";
import { isPlainObject } from "../utils/type";
import { AdditionalPages } from "./additional-pages/additional-pages";
import { normalizeAdditionalPagesOpts } from "./additional-pages/additional-pages-opts";
import { ConfigurationMenu } from "./configuration/menu/menu";
import { CustomCss } from "./custom-css/custom-css";
import { normalizeCustomCssOpts } from "./custom-css/custom-css-opts";
import { History } from "./history/history";
import { normalizeHistoryOpts } from "./history/history-opts";
import { IntegrationsMenu } from "./integrations-menu/menu";
import { JsSnippets } from "./js-snippets/js-snippets";
import { normalizeJsSnippetsOpts } from "./js-snippets/js-snippets-opts";
import { KeyboardNavigation } from "./keyboard-navigation/keyboard-navigation";
import { normalizeKeyboardNavigationOpts } from "./keyboard-navigation/keyboard-navigation-opts";
import { Module } from "./module";
import { NotificationBar, type NotificationBarOpts } from "./notification-bar/notification-bar";
import { ResourcesDownloader } from "./resources-downloader/resources-downloader";
import { normalizeResourcesDownloaderOpts } from "./resources-downloader/resources-downloader-opts";

type LoadableModule = {
    readonly constructor: new (name: string, opts: any) => Module;
    readonly optsNormalizer?: (opts: unknown) => Normalized<object>;
};

/**
 * Constructs integration modules from `integration.modules`.
 */
export class ModuleLoader {
    private static readonly MAPPED_MODULES: Map<string, LoadableModule> = new Map([
        ["AdditionalPages", {
            constructor: AdditionalPages,
            optsNormalizer: normalizeAdditionalPagesOpts,
        }],
        ["CustomCss", {
            constructor: CustomCss,
            optsNormalizer: normalizeCustomCssOpts,
        }],
        ["History", {
            constructor: History,
            optsNormalizer: normalizeHistoryOpts,
        }],
        ["JsSnippets", {
            constructor: JsSnippets,
            optsNormalizer: normalizeJsSnippetsOpts,
        }],
        ["KeyboardNavigation", {
            constructor: KeyboardNavigation,
            optsNormalizer: normalizeKeyboardNavigationOpts,
        }],
        ["ResourcesDownloader", {
            constructor: ResourcesDownloader,
            optsNormalizer: normalizeResourcesDownloaderOpts,
        }],
    ]);

    private static readonly log: Logger = new Logger("ModuleLoader");
    private static readonly instances: Map<string, Module> = new Map();

    private constructor() { }

    /**
     * Constructs each named module instance.
     * Unknown module keys or construction failures are logged and skipped; other instances still load.
     */
    static load(integration: Integration): Map<string, Module> {
        for (const [instanceName, entry] of Object.entries(integration.modules ?? {})) {
            this.loadModule(mergeIds(integration.name, instanceName), entry);
        }

        this.loadStaticModules(integration);

        this.log.debug(
            "Loaded",
            this.instances.size,
            "module instances for integration",
            integration.name,
        );

        return this.instances;
    }

    private static loadModule(
        instanceName: string,
        entry: IntegrationModule,
    ): void {
        this.constructModule(instanceName, () => {
            const loadable = this.MAPPED_MODULES.get(entry.module);
            if (loadable == null) {
                throw new Error(`Unknown module: ${entry.module}`);
            }

            const normalized = loadable.optsNormalizer != null
                ? loadable.optsNormalizer(entry.opts)
                : {
                    value: isPlainObject(entry.opts) ? entry.opts : {},
                    findings: [],
                };

            const unknown = formatOptsFindingsOfKind(normalized.findings, "unknown");
            if (unknown.length > 0) {
                this.log.warn("Unrecognized option keys:", instanceName, unknown);
            }

            if (normalized.value == null) {
                const rejected = formatOptsFindingsOfKind(normalized.findings, "reject");
                const repaired = formatOptsFindingsOfKind(normalized.findings, "repair");
                throw new Error(`Invalid module options${rejected}${repaired}`);
            }

            const repaired = formatOptsFindingsOfKind(normalized.findings, "repair");
            if (repaired.length > 0) {
                this.log.warn("Module options were repaired:", instanceName, repaired);
            }

            return new loadable.constructor(instanceName, normalized.value);
        });
    }

    private static constructModule(
        instanceName: string,
        factory: () => Module,
    ): void {
        try {
            if (this.instances.has(instanceName)) {
                throw new Error(`Module instance already registered: ${instanceName}`);
            }

            this.instances.set(instanceName, factory());
            this.log.debug("Constructed module instance:", instanceName);
        } catch (error) {
            this.log.fatal(
                `Failed to load module: ${instanceName}`,
                error,
                "Please check the integration configuration and module options.",
            );
        }
    }

    private static loadStaticModules(integration: Integration): void {
        this.log.debug("Loading static modules");

        const notificationBarName = mergeIds(integration.name, "notificationBar");
        const notificationBarOpts = ModuleLoader.readNotificationBarOpts(integration.defaults);
        this.constructModule(
            notificationBarName,
            () => new NotificationBar(notificationBarName, notificationBarOpts),
        );

        const configurationMenuName = mergeIds(integration.name, "configurationMenu");
        this.constructModule(
            configurationMenuName,
            () => new ConfigurationMenu(configurationMenuName, {}),
        );

        const integrationsMenuName = mergeIds(integration.name, "integrationsMenu");
        this.constructModule(
            integrationsMenuName,
            () => new IntegrationsMenu(integrationsMenuName, {}),
        );
    }

    private static readNotificationBarOpts(
        defaults: Readonly<Record<string, unknown>> | undefined,
    ): NotificationBarOpts {
        const normalized = normalizeNotificationBarOpts(defaults?.notificationBar);
        const unknown = formatOptsFindingsOfKind(normalized.findings, "unknown");
        if (unknown.length > 0) {
            this.log.warn("Unrecognized option keys:", "notificationBar", unknown);
        }
        return normalized.value ?? {};
    }

    /** Whether `moduleKey` is a registered loadable module constructor. */
    static hasModuleKey(moduleKey: string): boolean {
        return this.MAPPED_MODULES.has(moduleKey);
    }

    /** Sorted constructor keys available for integration module instances. */
    static getAvailableConstructors(): string[] {
        return Array.from(this.MAPPED_MODULES.keys()).sort();
    }

    /**
     * Opts normalizer for a registered module key, when one exists.
     * Callers use this for save-time validation; load still normalizes in {@link load}.
     */
    static getOptsNormalizer(
        moduleKey: string,
    ): ((opts: unknown) => Normalized<object>) | undefined {
        return this.MAPPED_MODULES.get(moduleKey)?.optsNormalizer;
    }
}

/**
 * Normalizes Notification Bar opts from `defaults.notificationBar`.
 * The only contract field is `position`. Other keys are `unknown` findings.
 */
export function normalizeNotificationBarOpts(raw: unknown): Normalized<NotificationBarOpts> {
    const walk = new OptsNormalization();
    if (!isPlainObject(raw)) {
        return walk.finish({});
    }

    reportUnrecognizedKeys(raw, ["position"], "defaults.notificationBar", walk);
    const position = typeof raw.position === "string" ? raw.position : undefined;
    return walk.finish(position != null ? { position } : {});
}

import { ContentManager } from "../content-manager/content-manager";
import { ContentManagerOpts } from "../content-manager/metadata";
import { Module } from "../modules/module";

/**
 * One module instance declared on an integration.
 * The record key under `modules` is the instance id.
 */
export type IntegrationModule = {
    /** Constructor key registered in ModuleLoader. */
    readonly module: string;
    /** Options passed to the module constructor. */
    readonly opts?: Record<string, unknown>;
};

/**
 * Named pathname catalog entry for an integration.
 * `name` is referenced by Content Manager `pageFilter` values; `paths` are pathname globs with optional `!!` negations.
 */
export type IntegrationMappedPage = {
    /** Page id (`[A-Za-z0-9_-]+`); unique within the integration. */
    readonly name: string;
    /** Pathname globs (`*` = any substring); supports `!!` negations. At least one positive entry when present. */
    readonly paths: readonly string[];
};

/** Site integration configuration. */
export type Integration = {
    /**
     * Unique integration id.
     * Must be a single id segment (`[A-Za-z0-9_-]+`); used as the first part of configuration storage keys.
     * An invalid name is a hard error at activate time (no sanitization).
     */
    readonly name: string;
    /** Hostnames and globs that activate this integration; supports `!!` negations. */
    readonly matchedDomains: readonly string[];
    /**
     * Optional named pathname pages for this integration.
     * Omit when empty. Active names come from `LoadedIntegration.getActivePages`.
     */
    readonly mappedPages?: readonly IntegrationMappedPage[];
    /** Content Manager options for this site; omit to skip Content Manager load. */
    readonly contentManager?: ContentManagerOpts;
    /** Named module instances to load for this integration. */
    readonly modules?: Record<string, IntegrationModule>;
    /**
     * Opaque preset bag.
     * Integration metadata does not interpret keys; each consumer reads what it owns.
     */
    readonly defaults?: Readonly<Record<string, unknown>>;
};

export type LoadedIntegration = {
    /** Matched integration id. */
    readonly name: string;
    /** Content Manager for this tab when configured and loaded. */
    readonly contentManager?: ContentManager;
    /** Constructed module instances keyed by composed instance id. */
    readonly modules?: Map<string, Module>;
    /**
     * Mapped-page names whose path globs match the current tab pathname.
     * Re-reads `window.location.pathname` on each call.
     */
    readonly getActivePages: () => readonly string[];
};

import { normalizeContentManagerOpts } from "../content-manager/content-manager-opts";
import { ModuleLoader, normalizeNotificationBarOpts } from "../modules/module-loader";
import {
    hasPositiveAllowDenyPattern,
    normalizeAllowDenyPattern,
} from "../utils/allow-deny";
import { OptsFinding } from "../utils/opts/normalization";
import { isValidId } from "../utils/string";
import { isPlainObject } from "../utils/type";
import { isValidDomainPattern, isValidPathPattern } from "../utils/urls";
import { Integration, IntegrationMappedPage, IntegrationModule } from "./metadata";
import { normalizeStoredIntegration } from "./store/normalize-stored-integration";

export type IntegrationValidationIssue = {
    readonly path: string;
    readonly message: string;
};

export type IntegrationValidationResult = {
    readonly valid: boolean;
    readonly issues: IntegrationValidationIssue[];
    /** Present when `valid` is true: envelope with normalized Content Manager and module opts. */
    readonly value?: Integration;
};

export type ValidateIntegrationOptions = {
    readonly mode: "create" | "edit";
    readonly existingNames: ReadonlySet<string>;
};

/**
 * Validates an integration for create/edit save.
 * Reject and repair findings block save. `unknown` findings do not. When valid, `value` carries normalized opts.
 */
export function validateIntegration(
    integration: Integration,
    options: ValidateIntegrationOptions,
): IntegrationValidationResult {
    const issues: IntegrationValidationIssue[] = [];
    const name = integration.name?.trim() ?? "";

    if (name.length === 0) {
        issues.push({ path: "name", message: "Name is required." });
    } else if (!isValidId(name)) {
        issues.push({
            path: "name",
            message: "Name must contain only ASCII letters, digits, hyphens, and underscores.",
        });
    } else if (options.mode === "create" && options.existingNames.has(name)) {
        issues.push({ path: "name", message: `An integration named "${name}" already exists.` });
    }

    const domainsResult = validateMatchedDomains(integration.matchedDomains);
    issues.push(...domainsResult.issues);

    const pagesResult = validateMappedPages(integration.mappedPages);
    issues.push(...pagesResult.issues);

    let contentManager = integration.contentManager;
    if (integration.contentManager != null) {
        const normalized = normalizeContentManagerOpts(integration.contentManager);
        issues.push(...collectNormalizedIssues("contentManager", normalized));
        if (normalized.value != null) {
            contentManager = normalized.value;
        }
    }

    const modules: Record<string, IntegrationModule> = {};
    if (integration.modules != null && !isPlainObject(integration.modules)) {
        issues.push({ path: "modules", message: "modules must be an object." });
    } else {
        for (const [instanceName, module] of Object.entries(integration.modules ?? {})) {
            const moduleResult = validateModule(instanceName, module, `modules.${instanceName}`);
            issues.push(...moduleResult.issues);
            modules[instanceName] = moduleResult.module;
        }
    }

    if (integration.defaults != null && !isPlainObject(integration.defaults)) {
        issues.push({ path: "defaults", message: "defaults must be a JSON object when provided." });
    }

    if (issues.length > 0) {
        return { valid: false, issues };
    }

    return {
        valid: true,
        issues: [],
        value: {
            name,
            matchedDomains: domainsResult.domains,
            ...(pagesResult.pages != null ? { mappedPages: pagesResult.pages } : {}),
            ...(contentManager != null ? { contentManager } : {}),
            ...(Object.keys(modules).length > 0 ? { modules } : {}),
            ...(integration.defaults != null ? { defaults: integration.defaults } : {}),
        },
    };
}

function validateMatchedDomains(domains: readonly string[] | undefined): {
    issues: IntegrationValidationIssue[];
    domains: string[];
} {
    if (!Array.isArray(domains) || domains.length === 0) {
        return {
            issues: [{ path: "matchedDomains", message: "At least one matched domain is required." }],
            domains: [],
        };
    }

    const issues: IntegrationValidationIssue[] = [];
    const normalized: string[] = [];

    for (const [index, raw] of domains.entries()) {
        const pattern = typeof raw === "string" ? normalizeAllowDenyPattern(raw) : undefined;
        if (pattern == null || !isValidDomainPattern(pattern)) {
            issues.push({
                path: `matchedDomains[${index}]`,
                message: "Each entry must be a valid hostname glob (optional !! exclusion).",
            });
            continue;
        }
        normalized.push(pattern);
    }

    if (issues.length === 0 && !hasPositiveAllowDenyPattern(normalized)) {
        issues.push({
            path: "matchedDomains",
            message: "At least one positive (non-!!) domain pattern is required.",
        });
    }

    return { issues, domains: normalized };
}

function validateMappedPages(
    pages: readonly IntegrationMappedPage[] | undefined,
): {
    issues: IntegrationValidationIssue[];
    pages: readonly IntegrationMappedPage[] | undefined;
} {
    if (pages == null) {
        return { issues: [], pages: undefined };
    }

    if (!Array.isArray(pages)) {
        return {
            issues: [{ path: "mappedPages", message: "mappedPages must be an array when provided." }],
            pages: undefined,
        };
    }

    const issues: IntegrationValidationIssue[] = [];
    const seenNames = new Set<string>();
    const normalizedPages: IntegrationMappedPage[] = [];

    for (const [index, page] of pages.entries()) {
        const name = page?.name?.trim() ?? "";
        const pathBase = name.length > 0 ? `mappedPages.${name}` : `mappedPages[${index}]`;

        if (name.length === 0) {
            issues.push({ path: `mappedPages[${index}]`, message: "Mapped page name is required." });
        } else if (!isValidId(name)) {
            issues.push({
                path: pathBase,
                message: "Mapped page name must contain only ASCII letters, digits, hyphens, and underscores.",
            });
        } else if (seenNames.has(name)) {
            issues.push({ path: pathBase, message: "Mapped page name must be unique." });
        } else {
            seenNames.add(name);
        }

        if (!Array.isArray(page?.paths) || page.paths.length === 0) {
            issues.push({
                path: `${pathBase}.paths`,
                message: "At least one path pattern is required.",
            });
            continue;
        }

        const normalizedPaths: string[] = [];
        const pathIssues: IntegrationValidationIssue[] = [];
        for (const [pathIndex, raw] of page.paths.entries()) {
            const pattern = typeof raw === "string" ? normalizeAllowDenyPattern(raw) : undefined;
            if (pattern == null || !isValidPathPattern(pattern)) {
                pathIssues.push({
                    path: `${pathBase}.paths[${pathIndex}]`,
                    message: "Each path must be a non-empty pathname glob (optional !! exclusion).",
                });
                continue;
            }
            normalizedPaths.push(pattern);
        }

        issues.push(...pathIssues);
        if (pathIssues.length === 0 && !hasPositiveAllowDenyPattern(normalizedPaths)) {
            issues.push({
                path: `${pathBase}.paths`,
                message: "At least one positive (non-!!) path pattern is required.",
            });
            continue;
        }

        if (name.length > 0 && isValidId(name) && pathIssues.length === 0) {
            normalizedPages.push({ name, paths: normalizedPaths });
        }
    }

    return {
        issues,
        pages: normalizedPages.length > 0 ? normalizedPages : pages,
    };
}

function validateModule(
    instanceName: string,
    module: IntegrationModule,
    path: string,
): { issues: IntegrationValidationIssue[]; module: IntegrationModule } {
    const issues: IntegrationValidationIssue[] = [];

    if (!isPlainObject(module)) {
        issues.push({ path, message: "Module instance must be an object." });
        return {
            issues,
            module: { module: "" },
        };
    }

    if (!isValidId(instanceName)) {
        issues.push({
            path,
            message: "Module instance name must contain only ASCII letters, digits, hyphens, and underscores.",
        });
    }

    const moduleKey = module.module?.trim() ?? "";
    if (moduleKey.length === 0) {
        issues.push({ path: `${path}.module`, message: "Module key is required." });
    } else if (!ModuleLoader.hasModuleKey(moduleKey)) {
        issues.push({ path: `${path}.module`, message: `Unknown module key "${moduleKey}".` });
    }

    if (module.opts == null) {
        return {
            issues,
            module: { module: moduleKey },
        };
    }

    if (!isPlainObject(module.opts)) {
        issues.push({ path: `${path}.opts`, message: "opts must be a JSON object when provided." });
        return {
            issues,
            module: { module: moduleKey, opts: module.opts },
        };
    }

    const normalizer = ModuleLoader.getOptsNormalizer(moduleKey);
    if (normalizer == null) {
        return {
            issues,
            module: { module: moduleKey, opts: module.opts },
        };
    }

    const normalized = normalizer(module.opts);
    issues.push(...collectNormalizedIssues(`${path}.opts`, normalized));
    return {
        issues,
        module: {
            module: moduleKey,
            ...(normalized.value != null
                ? { opts: { ...normalized.value } as Record<string, unknown> }
                : { opts: module.opts }),
        },
    };
}

function collectNormalizedIssues(
    sectionPath: string,
    normalized: { readonly value?: object; readonly findings: readonly OptsFinding[] },
): IntegrationValidationIssue[] {
    const issues: IntegrationValidationIssue[] = [];

    for (const finding of normalized.findings) {
        if (finding.kind === "unknown") {
            continue;
        }
        issues.push({
            path: qualifyFindingPath(sectionPath, finding.path),
            message: finding.message,
        });
    }

    if (normalized.value == null && issues.length === 0) {
        issues.push({
            path: sectionPath,
            message: "Options are incomplete or invalid after normalization.",
        });
    }

    return issues;
}

function qualifyFindingPath(sectionPath: string, findingPath: string): string {
    const trimmed = findingPath.trim();
    if (trimmed.length === 0 || trimmed === "opts") {
        return sectionPath;
    }
    if (trimmed === sectionPath || trimmed.startsWith(`${sectionPath}.`)) {
        return trimmed;
    }
    return `${sectionPath}.${trimmed}`;
}

/**
 * Parses optional module opts JSON text.
 * Empty input yields no value; non-object JSON is rejected.
 */
export function parseOptsJson(
    raw: string,
): { ok: true; value?: Record<string, unknown> } | { ok: false; message: string } {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return { ok: true, value: undefined };
    }

    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (!isPlainObject(parsed)) {
            return { ok: false, message: "opts must be a JSON object." };
        }
        return { ok: true, value: parsed };
    } catch {
        return { ok: false, message: "opts is not valid JSON." };
    }
}

/**
 * `unknown` findings for a raw integration document.
 * Identity keys stay in place; closed objects and nested unknown objects are listed in one pass.
 */
export function collectUnrecognizedOpts(raw: unknown): readonly OptsFinding[] {
    const findings: OptsFinding[] = [];
    const mapKey = isPlainObject(raw) && typeof raw.name === "string" ? raw.name : "";
    pushUnknown(findings, normalizeStoredIntegration(raw, mapKey).findings);

    if (!isPlainObject(raw)) {
        return findings;
    }

    if (isPlainObject(raw.contentManager)) {
        pushUnknown(findings, normalizeContentManagerOpts(raw.contentManager).findings);
    }

    if (isPlainObject(raw.modules)) {
        for (const [instanceName, module] of Object.entries(raw.modules)) {
            if (!isPlainObject(module) || !isPlainObject(module.opts)) {
                continue;
            }
            const moduleKey = typeof module.module === "string" ? module.module.trim() : "";
            const normalizer = ModuleLoader.getOptsNormalizer(moduleKey);
            if (normalizer == null) {
                continue;
            }
            const prefix = `modules.${instanceName}.opts`;
            for (const finding of normalizer(module.opts).findings) {
                if (finding.kind !== "unknown") {
                    continue;
                }
                findings.push({
                    path: qualifyFindingPath(prefix, finding.path),
                    message: finding.message,
                    kind: finding.kind,
                });
            }
        }
    }

    if (isPlainObject(raw.defaults) && raw.defaults.notificationBar != null) {
        pushUnknown(findings, normalizeNotificationBarOpts(raw.defaults.notificationBar).findings);
    }

    return findings;
}

/**
 * Asks before save drops unrecognized keys.
 * Returns true when there is nothing to drop, or the user accepts.
 */
export function confirmUnrecognizedOpts(findings: readonly OptsFinding[]): boolean {
    if (findings.length === 0) {
        return true;
    }

    const body = findings
        .map((finding) => `${finding.path}\n${finding.message}`)
        .join("\n\n");
    return window.confirm(
        `These keys are not in the options contract. Saving drops them permanently.\n\n${body}\n\nSave the sanitized options?`,
    );
}

function pushUnknown(target: OptsFinding[], findings: readonly OptsFinding[]): void {
    for (const finding of findings) {
        if (finding.kind === "unknown") {
            target.push(finding);
        }
    }
}

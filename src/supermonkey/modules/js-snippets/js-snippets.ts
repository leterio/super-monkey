import {
    EntitiesInjectedEventPayload,
    EntitiesParsedEventPayload,
    EntityViewedEventPayload,
    ListedEntity,
} from "../../content-manager/events";
import {
    BeforeUnloadEventPayload,
    ContentLoadedEventPayload,
} from "../../lifecycle/events";
import type { Configuration } from "../configuration/configuration";
import { BooleanConfiguration } from "../configuration/impl/boolean";
import { Module } from "../module";
import type { JsSnippetListener, JsSnippetRule, JsSnippetsOpts } from "./js-snippets-opts";

const LABEL = "JS Snippets";
const DESCRIPTION =
    "Runs integration-authored page scripts on selected lifecycle and content hooks, with opt-in Configuration Menu toggles.";

type SnippetFn = ((event?: unknown) => void);

type CompiledSnippet = {
    readonly rule: JsSnippetRule;
    readonly configuration: BooleanConfiguration;
    readonly run: SnippetFn;
};

/**
 * Runs opt-in JS snippets from integration opts on selected Module hooks.
 * Snippets receive no SuperMonkey module context; `contentLoaded` has no arguments,
 * other listeners receive a payload binding named `event`.
 */
export class JsSnippets extends Module<JsSnippetsOpts> {
    private readonly snippets: readonly CompiledSnippet[];

    constructor(name: string, opts: JsSnippetsOpts) {
        super(name, opts);

        const compiled: CompiledSnippet[] = [];
        for (const rule of opts.rules) {
            const run = JsSnippets.compile(rule, this);
            if (run == null) {
                continue;
            }

            compiled.push({
                rule,
                configuration: new BooleanConfiguration(this.name, rule.name, false, {
                    label: rule.label,
                    ...(rule.description != null ? { description: rule.description } : {}),
                }),
                run,
            });
        }

        this.snippets = compiled;
    }

    override get title(): string {
        return LABEL;
    }

    override get description(): string | undefined {
        return DESCRIPTION;
    }

    override get configurations(): Configuration[] {
        return this.snippets.map((snippet) => snippet.configuration);
    }

    protected override async onContentLoaded(_data: ContentLoadedEventPayload): Promise<void> {
        this.runListener("contentLoaded");
    }

    protected override async onBeforeUnload(data: BeforeUnloadEventPayload): Promise<void> {
        this.runListener("beforeUnload", asReadOnlyEvent(data));
    }

    protected override async onEntityViewed(data: EntityViewedEventPayload): Promise<void> {
        this.runListener("entityViewed", asReadOnlyEvent(data));
    }

    protected override async onEntitiesParsed(data: EntitiesParsedEventPayload): Promise<void> {
        this.runListener("entitiesParsed", wrapEntitiesParsedEvent(data));
    }

    protected override async onEntitiesInjected(data: EntitiesInjectedEventPayload): Promise<void> {
        this.runListener("entitiesInjected", asReadOnlyEvent(data));
    }

    private runListener(listener: JsSnippetListener, event?: unknown): void {
        for (const snippet of this.snippets) {
            if (snippet.rule.listener !== listener || snippet.configuration.value !== true) {
                continue;
            }

            try {
                if (listener === "contentLoaded") {
                    snippet.run();
                } else {
                    snippet.run(event);
                }
            } catch (error) {
                this.log.warn(`JS snippet "${snippet.rule.name}" failed:`, error);
            }
        }
    }

    private static compile(rule: JsSnippetRule, module: JsSnippets): SnippetFn | undefined {
        try {
            if (rule.listener === "contentLoaded") {
                return new Function(rule.code) as SnippetFn;
            }

            return new Function("event", rule.code) as SnippetFn;
        } catch (error) {
            module.log.fatal(
                `Failed to compile JS snippet "${rule.name}"`,
                error,
                "The rule is ignored; fix the code in the integration options.",
            );
            return undefined;
        }
    }
}

function asReadOnlyEvent<T extends object>(event: T): T {
    return new Proxy(event, {
        set() {
            return false;
        },
        deleteProperty() {
            return false;
        },
        defineProperty() {
            return false;
        },
    });
}

function wrapEntitiesParsedEvent(data: EntitiesParsedEventPayload): EntitiesParsedEventPayload {
    const entities = new Map<string, ListedEntity[]>();
    for (const [group, list] of data.entities) {
        entities.set(
            group,
            list.map((entity) => wrapListedEntityForHide(entity)),
        );
    }

    return asReadOnlyEvent({ entities });
}

function wrapListedEntityForHide(entity: ListedEntity): ListedEntity {
    return new Proxy(entity, {
        set(target, property, value) {
            if (property === "hide") {
                target.hide = value as boolean | undefined;
                return true;
            }

            return false;
        },
        deleteProperty(target, property) {
            if (property === "hide") {
                delete target.hide;
                return true;
            }

            return false;
        },
        defineProperty() {
            return false;
        },
    });
}

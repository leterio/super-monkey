import { debounce } from "../../utils/debouncer";
import { Logger } from "../../utils/logger";
import { ArrayConfiguration } from "../configuration/impl/array";

export class HistoryBucket {
    private readonly sessionIds: Set<string> = new Set();

    constructor(
        private readonly flushKey: string,
        private readonly label: string,
        private readonly configuration: ArrayConfiguration<string>,
        private readonly log: Logger,
    ) {
    }

    get persisted(): string[] {
        return this.configuration.value;
    }

    set persisted(value: string[]) {
        this.configuration.value = value;
    }

    has(contentId: string): boolean {
        return this.sessionIds.has(contentId) || this.configuration.value.includes(contentId);
    }

    hasInSession(contentId: string): boolean {
        return this.sessionIds.has(contentId);
    }

    addToSession(contentId: string): void {
        this.sessionIds.add(contentId);
    }

    scheduleFlush(): void {
        debounce(
            this.flushKey,
            () => this.flush(),
            { min: 50, max: 100 },
        );
    }

    flush(): void {
        const history = this.configuration.value;
        const historySet = new Set(history);
        const elementsToInclude = Array.from(this.sessionIds)
            .filter((element) => !historySet.has(element));

        if (elementsToInclude.length === 0) {
            return;
        }

        this.log.debug(`Flushing session managed entries to ${this.label} history:`, elementsToInclude.length);
        this.configuration.value = [
            ...history,
            ...elementsToInclude,
        ];
    }

    clear(): void {
        this.sessionIds.clear();
        this.configuration.value = [];
    }

    mergePersisted(ids: string[]): void {
        this.configuration.value = Array.from(
            new Set<string>([
                ...this.configuration.value,
                ...ids,
            ]),
        );
    }

    watchRemoteFlushes(): void {
        this.configuration.watch((_, __, remote) => {
            if (remote && this.sessionIds.size > 0) {
                this.scheduleFlush();
            }
        });
    }

    toPersistedSet(): Set<string> {
        return new Set(this.configuration.value);
    }
}

export class HistoryStore {
    readonly listed: HistoryBucket;
    readonly viewed: HistoryBucket;

    constructor(
        moduleName: string,
        listedConfiguration: ArrayConfiguration<string>,
        viewedConfiguration: ArrayConfiguration<string>,
        log: Logger,
    ) {
        this.listed = new HistoryBucket(
            `${moduleName}-listed-insert`,
            "listed",
            listedConfiguration,
            log,
        );
        this.viewed = new HistoryBucket(
            `${moduleName}-viewed-insert`,
            "viewed",
            viewedConfiguration,
            log,
        );
    }

    watchRemoteFlushes(): void {
        this.listed.watchRemoteFlushes();
        this.viewed.watchRemoteFlushes();
    }

    flushAll(): void {
        this.listed.flush();
        this.viewed.flush();
    }

    clear(): void {
        this.listed.clear();
        this.viewed.clear();
    }
}

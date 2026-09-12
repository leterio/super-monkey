import { ItemState } from "../../../utils/item-state";
import { resolveUrlFromSources } from "../../../utils/links";
import { Logger } from "../../../utils/logger";
import { AbortError, formatByteSize, HttpProgress } from "../../../utils/network";
import { applyDataState } from "../../../utils/ui/ui-state";
import { tryNormalizeUrl } from "../../../utils/urls";
import { resolveAllValues } from "../../../utils/value-resolver";
import { NumberConfiguration } from "../../configuration/impl/number";
import { ProgressItemHandle } from "../../notification-bar/entries/progress-menu/progress-item";
import { ProgressMenuEntry } from "../../notification-bar/entries/progress-menu/progress-menu";
import {
    DownloadMode,
    FinalDownloadStep,
    RESOURCE_STATE_ATTR,
    Resource,
    ResourceLeaf,
    ResourcesMapping,
    ResourcesMappingLeaf,
} from "../metadata";
import { DownloadExecutor } from "./executor";

type DownloadBranch = {
    url: string;
    progress: ProgressItemHandle;
};

type ProgressReporter = (progress: number, statusText?: string) => void;

export class DownloadOrchestrator {
    private readonly log: Logger = new Logger("DownloadOrchestrator");

    private readonly downloadExecutor: DownloadExecutor = new DownloadExecutor();
    private readonly customModes: ReadonlyMap<string, DownloadMode>;
    private readonly abortControllers = new Map<ResourceLeaf, AbortController>();

    constructor(
        private readonly notificationIcon: ProgressMenuEntry,
        private readonly roots: readonly Resource[],
        private readonly mappings: Record<string, ResourcesMapping>,
        downloadModes: readonly DownloadMode[] = [],
        private readonly parallelDownloadsConfiguration?: NumberConfiguration,
    ) {
        this.customModes = new Map(downloadModes.map((mode) => [mode.name, mode]));
    }

    async start(resource: Resource): Promise<void> {
        if (resource.state === ItemState.PROGRESS) {
            return;
        }

        if (resource.type === "leaf") {
            await this.startLeaf(resource);
            return;
        }

        const leaves = DownloadOrchestrator.collectDescendantLeaves(resource)
            .filter((leaf) => leaf.state !== ItemState.PROGRESS);

        const uniqueLeaves = this.takeUniqueUrlLeaves(leaves);
        await this.runWithConcurrency(uniqueLeaves, (leaf) => this.startLeaf(leaf));
    }

    async downloadAll(): Promise<void> {
        const leaves = this.collectSessionLeaves()
            .filter((leaf) =>
                leaf.state === ItemState.PENDING
                || leaf.state === ItemState.ERROR
                || leaf.state === ItemState.CANCELLED
            );

        const uniqueLeaves = this.takeUniqueUrlLeaves(leaves);
        await this.runWithConcurrency(uniqueLeaves, (leaf) => this.startLeaf(leaf));
    }

    async retryAll(): Promise<void> {
        const leaves = this.collectSessionLeaves()
            .filter((leaf) => leaf.state === ItemState.ERROR);

        await this.runWithConcurrency(leaves, (leaf) => this.startLeaf(leaf));
    }

    cancel(leaf: ResourceLeaf): void {
        const controller = this.abortControllers.get(leaf);
        if (controller != null) {
            controller.abort();
            return;
        }

        if (leaf.state !== ItemState.ERROR) {
            return;
        }

        this.log.debug("Dismissing failed download", leaf);
        this.destroyAllProgressItems(leaf);
        this.applyState(leaf, ItemState.CANCELLED);
        this.bubble(leaf);
        this.syncNotification();
    }

    cancelAll(): void {
        for (const leaf of this.collectSessionLeaves()) {
            if (leaf.state === ItemState.PROGRESS) {
                this.cancel(leaf);
            }
        }
    }

    hasInProgressDownloads(): boolean {
        return this.aggregateSession() === ItemState.PROGRESS;
    }

    private async startLeaf(leaf: ResourceLeaf): Promise<void> {
        if (leaf.state === ItemState.PROGRESS) {
            return;
        }

        const url = this.resolveLeafUrl(leaf);
        if (url == null) {
            this.log.error("Failed to resolve resource url for element", leaf.element);
            this.destroyAllProgressItems(leaf);
            this.applyState(leaf, ItemState.ERROR);
            this.bubble(leaf);
            this.syncNotification();
            return;
        }

        this.destroyAllProgressItems(leaf);
        this.ensureMenuItem(leaf, url);
        this.applyState(leaf, ItemState.PROGRESS);
        leaf.progress?.setProgress(0);
        this.bubble(leaf);
        this.syncNotification();

        const controller = new AbortController();
        this.abortControllers.set(leaf, controller);

        try {
            this.log.debug("Downloading resource", leaf, url);
            const mapping = this.mappings[leaf.mappedBy];
            if (mapping == null || mapping.type !== "leaf") {
                throw new Error(`Invalid leaf mapping "${leaf.mappedBy}"`);
            }

            await this.executeDownloadMode(leaf, mapping, url, controller.signal);
            this.completeLeaf(leaf);
        } catch (error) {
            if (controller.signal.aborted) {
                this.log.debug("Download cancelled", leaf);
                this.destroyAllProgressItems(leaf);
                this.applyState(leaf, ItemState.CANCELLED);
            } else {
                this.log.error("Failed to download resource", leaf, error);
                this.applyState(leaf, ItemState.ERROR);
            }
        } finally {
            this.abortControllers.delete(leaf);
        }

        this.bubble(leaf);
        this.syncNotification();
    }

    private async executeDownloadMode(
        leaf: ResourceLeaf,
        mapping: ResourcesMappingLeaf,
        initialUrl: string,
        signal: AbortSignal,
    ): Promise<void> {
        const modeName = mapping.downloadMode ?? "download";
        const setProgress: ProgressReporter = (progress, statusText) =>
            leaf.progress?.setProgress(progress, statusText);

        this.log.debug("Running download mode", modeName, initialUrl);

        if (modeName === "download") {
            await this.runFinalDownload(initialUrl, undefined, setProgress, signal);
            return;
        }

        const customMode = this.customModes.get(modeName);
        if (customMode == null) {
            throw new Error(`Unknown download mode "${modeName}"`);
        }

        const initialBranch: DownloadBranch = {
            url: initialUrl,
            progress: leaf.progress!,
        };
        const branches = await this.runCustomSteps(
            initialBranch,
            leaf.element,
            customMode,
            leaf,
            signal,
        );
        await this.finalizeAll(branches, customMode, signal);
    }

    private async runCustomSteps(
        initialBranch: DownloadBranch,
        element: HTMLElement,
        mode: DownloadMode,
        leaf: ResourceLeaf,
        signal: AbortSignal,
    ): Promise<DownloadBranch[]> {
        let branches = [initialBranch];
        const documentSteps = mode.steps.filter(
            (step): step is Extract<DownloadMode["steps"][number], { mode: "document" }> =>
                step.mode === "document",
        );
        const stepCount = documentSteps.length;
        const stepBudget = stepCount > 0 ? 90 / stepCount : 90;

        for (const [stepIndex, step] of documentSteps.entries()) {
            if (signal.aborted) {
                throw new AbortError(branches[0]?.url ?? "");
            }

            const stepStart = stepIndex * stepBudget;
            const stepEnd = stepStart + stepBudget;

            const results: DownloadBranch[][] = Array.from({ length: branches.length }, () => []);
            await this.runWithConcurrency(
                branches.map((branch, index) => ({ branch, index })),
                async ({ branch, index }) => {
                    const fetched = await this.downloadExecutor.fetchDocumentStep(
                        branch.url,
                        element,
                        step,
                        (httpProgress) => {
                            DownloadOrchestrator.reportHttpProgress(
                                httpProgress,
                                stepStart,
                                stepEnd,
                                (progress, statusText) => branch.progress.setProgress(progress, statusText),
                            );
                        },
                        signal,
                    );

                    const resolvedUrls = DownloadOrchestrator.dedupeUrls(
                        resolveAllValues(step.valueSource, fetched.document)
                            .map((value) => tryNormalizeUrl(value, fetched.finalUrl))
                            .filter((url): url is string => url != null),
                    );

                    if (resolvedUrls.length === 0) {
                        throw new Error(`Step ${stepIndex + 1} resolved no URLs`);
                    }

                    results[index] = this.expandBranchUrls(branch, resolvedUrls, leaf, stepEnd);
                },
                false,
            );

            branches = DownloadOrchestrator.dedupeBranches(results.flat());
            if (branches.length === 0) {
                throw new Error(`Step ${stepIndex + 1} resolved no URLs`);
            }
        }

        return branches;
    }

    private expandBranchUrls(
        branch: DownloadBranch,
        urls: readonly string[],
        leaf: ResourceLeaf,
        stepEndProgress: number,
    ): DownloadBranch[] {
        const [firstUrl, ...extraUrls] = urls;
        if (firstUrl == null) {
            return [];
        }

        branch.url = firstUrl;
        branch.progress.setLabel(firstUrl);
        branch.progress.setProgress(stepEndProgress);

        const expanded: DownloadBranch[] = [{ url: firstUrl, progress: branch.progress }];

        for (const url of extraUrls) {
            const progress = this.createBranchMenuItem(leaf, url);
            progress.setProgress(stepEndProgress);
            expanded.push({ url, progress });
        }

        return expanded;
    }

    private async finalizeAll(
        branches: readonly DownloadBranch[],
        mode: DownloadMode,
        signal: AbortSignal,
    ): Promise<void> {
        if (signal.aborted) {
            throw new AbortError(branches[0]?.url ?? "");
        }

        const finalStep = mode.steps[mode.steps.length - 1];
        if (finalStep == null || finalStep.mode !== "download") {
            throw new Error(`Download mode "${mode.name}" is missing a final download step`);
        }

        await this.runWithConcurrency([...branches], async (branch) => {
            await this.runFinalDownload(
                branch.url,
                finalStep,
                (progress, statusText) => branch.progress.setProgress(progress, statusText),
                signal,
                90,
                100,
            );
        }, false);
    }

    private async runFinalDownload(
        url: string,
        step: FinalDownloadStep | undefined,
        setProgress: ProgressReporter,
        signal: AbortSignal,
        rangeStart = 0,
        rangeEnd = 100,
    ): Promise<void> {
        await this.downloadExecutor.downloadUrl(
            url,
            step,
            (httpProgress: HttpProgress) => {
                DownloadOrchestrator.reportHttpProgress(
                    httpProgress,
                    rangeStart,
                    rangeEnd,
                    setProgress,
                );
            },
            signal,
        );

        setProgress(rangeEnd);
        this.log.debug("Saved download", url);
    }

    private createBranchMenuItem(leaf: ResourceLeaf, label: string): ProgressItemHandle {
        const handle = this.notificationIcon.mapItem(label, {
            onRetry: () => {
                void this.start(leaf);
            },
            onCancel: () => {
                this.cancel(leaf);
            },
        });
        handle.setStatus(ItemState.PROGRESS);

        if (leaf.branchProgress == null) {
            leaf.branchProgress = [];
        }
        leaf.branchProgress.push(handle);

        return handle;
    }

    private destroyAllProgressItems(leaf: ResourceLeaf): void {
        leaf.progress?.destroy();
        leaf.progress = undefined;

        if (leaf.branchProgress != null) {
            for (const handle of leaf.branchProgress) {
                handle.destroy();
            }
            leaf.branchProgress = undefined;
        }
    }

    private ensureMenuItem(leaf: ResourceLeaf, label: string): void {
        if (leaf.progress != null) {
            leaf.progress.setLabel(label);
            return;
        }

        leaf.progress = this.notificationIcon.mapItem(label, {
            onRetry: () => {
                void this.start(leaf);
            },
            onCancel: () => {
                this.cancel(leaf);
            },
        });
    }

    private resolveLeafUrl(leaf: ResourceLeaf): string | null {
        const mapping = this.mappings[leaf.mappedBy];
        if (mapping == null || mapping.type !== "leaf") {
            return null;
        }

        return resolveUrlFromSources(leaf.element, mapping.urlSources);
    }

    private completeLeaf(leaf: ResourceLeaf): void {
        leaf.state = ItemState.DONE;
        this.applyButtonState(leaf);
        this.destroyAllProgressItems(leaf);
    }

    private applyState(resource: Resource, state: ItemState): void {
        resource.state = state;
        this.applyButtonState(resource);

        if (resource.type === "leaf") {
            resource.progress?.setStatus(state);
            resource.branchProgress?.forEach((handle) => handle.setStatus(state));
        }
    }

    private applyButtonState(resource: Resource): void {
        applyDataState(resource.downloadButton, resource.state);
        resource.element.setAttribute(RESOURCE_STATE_ATTR, resource.state);
    }

    private bubble(resource: Resource): void {
        const parent = resource.parent;
        if (parent == null) {
            return;
        }

        const next = DownloadOrchestrator.aggregateChildren(parent.children);
        if (next !== parent.state) {
            this.applyState(parent, next);
        }

        this.bubble(parent);
    }

    private static aggregateChildren(children: readonly Resource[]): ItemState {
        let hasProgress = false;
        let hasError = false;
        let hasPending = false;

        for (const child of children) {
            if (child.state === ItemState.PROGRESS) {
                hasProgress = true;
            } else if (child.state === ItemState.ERROR) {
                hasError = true;
            } else if (
                child.state === ItemState.PENDING
                || child.state === ItemState.CANCELLED
            ) {
                hasPending = true;
            }
        }

        if (hasProgress) {
            return ItemState.PROGRESS;
        }
        if (hasError) {
            return ItemState.ERROR;
        }
        if (hasPending) {
            return ItemState.PENDING;
        }
        return ItemState.DONE;
    }

    private syncNotification(): void {
        this.notificationIcon.state = this.aggregateSession();
    }

    private aggregateSession(): ItemState {
        let hasProgress = false;
        let hasError = false;
        let hasDone = false;

        for (const root of this.roots) {
            for (const node of DownloadOrchestrator.walk(root)) {
                if (node.state === ItemState.PROGRESS) {
                    hasProgress = true;
                } else if (node.state === ItemState.ERROR) {
                    hasError = true;
                } else if (
                    node.state === ItemState.DONE
                    || node.state === ItemState.SKIPPED
                ) {
                    hasDone = true;
                }
            }
        }

        if (hasProgress) {
            return ItemState.PROGRESS;
        }
        if (hasError) {
            return ItemState.ERROR;
        }
        if (hasDone) {
            return ItemState.DONE;
        }
        return ItemState.PENDING;
    }

    private collectSessionLeaves(): ResourceLeaf[] {
        return this.roots.flatMap((root) => DownloadOrchestrator.collectDescendantLeaves(root));
    }

    private static collectDescendantLeaves(resource: Resource): ResourceLeaf[] {
        if (resource.type === "leaf") {
            return [resource];
        }

        return resource.children.flatMap((child) => DownloadOrchestrator.collectDescendantLeaves(child));
    }

    private static *walk(resource: Resource): Generator<Resource> {
        yield resource;

        if (resource.type !== "collection") {
            return;
        }

        for (const child of resource.children) {
            yield* DownloadOrchestrator.walk(child);
        }
    }

    private resolveParallelSlots(): number {
        const configured = this.parallelDownloadsConfiguration?.value ?? 10;
        return Math.min(50, Math.max(1, configured));
    }

    private async runWithConcurrency<T>(
        items: readonly T[],
        worker: (item: T) => Promise<void>,
        settle = true,
    ): Promise<void> {
        if (items.length === 0) {
            return;
        }

        const slots = this.resolveParallelSlots();
        let nextIndex = 0;

        const runners = Array.from({ length: Math.min(slots, items.length) }, async () => {
            while (nextIndex < items.length) {
                const index = nextIndex;
                nextIndex += 1;
                await worker(items[index]!);
            }
        });

        if (settle) {
            await Promise.allSettled(runners);
            return;
        }

        await Promise.all(runners);
    }

    private static reportHttpProgress(
        httpProgress: HttpProgress,
        rangeStart: number,
        rangeEnd: number,
        setProgress: ProgressReporter,
    ): void {
        if (httpProgress.totalBytes == null) {
            setProgress(rangeStart, formatByteSize(httpProgress.bytesFetched));
            return;
        }

        setProgress(
            rangeStart + (httpProgress.progress / 100) * (rangeEnd - rangeStart),
        );
    }

    private takeUniqueUrlLeaves(leaves: readonly ResourceLeaf[]): ResourceLeaf[] {
        const seen = new Set<string>();
        const toDownload: ResourceLeaf[] = [];

        for (const leaf of leaves) {
            const url = this.resolveLeafUrl(leaf);
            if (url == null) {
                toDownload.push(leaf);
                continue;
            }

            if (seen.has(url)) {
                this.destroyAllProgressItems(leaf);
                this.applyState(leaf, ItemState.SKIPPED);
                this.bubble(leaf);
                continue;
            }

            seen.add(url);
            toDownload.push(leaf);
        }

        this.syncNotification();
        return toDownload;
    }

    private static dedupeUrls(urls: readonly string[]): string[] {
        const seen = new Set<string>();
        const result: string[] = [];

        for (const url of urls) {
            const trimmed = url.trim();
            if (trimmed.length === 0 || seen.has(trimmed)) {
                continue;
            }

            seen.add(trimmed);
            result.push(trimmed);
        }

        return result;
    }

    private static dedupeBranches(branches: readonly DownloadBranch[]): DownloadBranch[] {
        const seen = new Set<string>();
        const result: DownloadBranch[] = [];

        for (const branch of branches) {
            if (seen.has(branch.url)) {
                branch.progress.destroy();
                continue;
            }

            seen.add(branch.url);
            result.push(branch);
        }

        return result;
    }
}

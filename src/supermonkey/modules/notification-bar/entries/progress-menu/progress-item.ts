import { ItemState } from "../../../../utils/item-state";

export type ProgressItemHandle = {
    setStatus(state: ItemState): void;
    setProgress(progress: number, statusText?: string): void;
    setLabel(label: string): void;
    destroy(): void;
};

/* tslint:disable */
/* eslint-disable */

export class Engine {
    free(): void;
    [Symbol.dispose](): void;
    evaluate(): number;
    fen(): string;
    go_movetime(ms: number, multi_pv: number, on_info?: Function | null): void;
    go_uci(depth: number, nodes: number, multi_pv: number, on_info?: Function | null): void;
    last_bestmove(): string;
    last_depth(): number;
    last_nodes(): bigint;
    last_score(): number;
    make_move(uci_move: string): void;
    constructor();
    reset(): void;
    set_dispatch(dispatch?: Function | null): void;
    set_position(fen: string): void;
    set_threads(n: number): void;
    take_output(): string;
}

export function run_helper_thread(ptr: number, thread_count: number): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_engine_free: (a: number, b: number) => void;
    readonly engine_evaluate: (a: number) => number;
    readonly engine_fen: (a: number) => [number, number];
    readonly engine_go_movetime: (a: number, b: number, c: number, d: number) => void;
    readonly engine_go_uci: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly engine_last_bestmove: (a: number) => [number, number];
    readonly engine_last_depth: (a: number) => number;
    readonly engine_last_nodes: (a: number) => bigint;
    readonly engine_last_score: (a: number) => number;
    readonly engine_make_move: (a: number, b: number, c: number) => void;
    readonly engine_new: () => number;
    readonly engine_reset: (a: number) => void;
    readonly engine_set_dispatch: (a: number, b: number) => void;
    readonly engine_set_position: (a: number, b: number, c: number) => void;
    readonly engine_set_threads: (a: number, b: number) => void;
    readonly engine_take_output: (a: number) => [number, number];
    readonly run_helper_thread: (a: number, b: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

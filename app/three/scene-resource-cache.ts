export interface SceneResourceLoader<T> {
  readonly load: (url: string, signal: AbortSignal) => Promise<T>;
  readonly dispose: (value: T) => void;
}

interface SceneResourceEntry<T> {
  readonly controller: AbortController;
  promise: Promise<T>;
  status: "pending" | "resolved" | "rejected";
  value?: T;
}

function abortError() {
  const error = new Error("Scene resource ownership was released");
  error.name = "AbortError";
  return error;
}

export class SceneResourceCache<T> {
  readonly #entries = new Map<string, SceneResourceEntry<T>>();
  readonly #activeOwners = new Map<string, Set<string>>();
  #hostLease: symbol | null = null;

  constructor(private readonly loader: SceneResourceLoader<T>) {}

  get size() {
    return this.#entries.size;
  }

  acquireHostLease(): symbol {
    const lease = Symbol("scene-resource-host");
    this.#hostLease = lease;
    return lease;
  }

  releaseHostLease(lease: symbol): boolean {
    if (this.#hostLease !== lease) return false;
    this.#hostLease = null;
    this.clearAll();
    return true;
  }

  activate(url: string, owner: string): Promise<T> {
    let owners = this.#activeOwners.get(url);
    const existing = this.#entries.get(url);
    if (existing?.status === "resolved") {
      if (!owners) this.#activeOwners.set(url, new Set([owner]));
      return existing.promise;
    }
    const newOwner = !owners?.has(owner);
    if (newOwner) {
      if (existing?.status === "rejected") {
        this.deleteEntry(url);
        owners = new Set();
        this.#activeOwners.set(url, owners);
      }
      if (!owners) {
        owners = new Set();
        this.#activeOwners.set(url, owners);
      }
      owners.add(owner);
    }
    return this.load(url);
  }

  load(url: string): Promise<T> {
    const existing = this.#entries.get(url);
    if (existing) return existing.promise;

    const controller = new AbortController();
    const entry: SceneResourceEntry<T> = {
      controller,
      promise: undefined as unknown as Promise<T>,
      status: "pending",
    };
    this.#entries.set(url, entry);

    let source: Promise<T>;
    try {
      source = this.loader.load(url, controller.signal);
    } catch (error) {
      source = Promise.reject(error);
    }

    entry.promise = source.then(
      (value) => {
        if (
          controller.signal.aborted ||
          this.#entries.get(url) !== entry
        ) {
          this.safeDispose(value);
          throw abortError();
        }
        entry.value = value;
        entry.status = "resolved";
        const owners = this.#activeOwners.get(url);
        if (owners && owners.size > 1) {
          const firstOwner = owners.values().next().value;
          if (firstOwner !== undefined) {
            this.#activeOwners.set(url, new Set([firstOwner]));
          }
        }
        return value;
      },
      (error: unknown) => {
        const stale =
          controller.signal.aborted || this.#entries.get(url) !== entry;
        const active = this.#activeOwners.has(url);
        if (this.#entries.get(url) === entry && active) {
          entry.status = "rejected";
        } else if (this.#entries.get(url) === entry) {
          this.#entries.delete(url);
        }
        throw stale ? abortError() : error;
      },
    ) as Promise<T>;
    void entry.promise.catch(() => undefined);
    return entry.promise;
  }

  preload(url: string): Promise<T> {
    return this.load(url);
  }

  peek(url: string): T | undefined {
    return this.#entries.get(url)?.value;
  }

  clear(url: string): void {
    this.#activeOwners.delete(url);
    this.deleteEntry(url);
  }

  clearAll(): void {
    for (const url of [...this.#entries.keys()]) this.deleteEntry(url);
    this.#activeOwners.clear();
  }

  private deleteEntry(url: string): void {
    const entry = this.#entries.get(url);
    if (!entry) return;
    this.#entries.delete(url);
    entry.controller.abort();
    if (entry.value !== undefined) this.safeDispose(entry.value);
  }

  private safeDispose(value: T): void {
    try {
      this.loader.dispose(value);
    } catch {
      // Eviction is best-effort and must not destabilize the active page.
    }
  }
}

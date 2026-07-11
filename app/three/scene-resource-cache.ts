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
  #activeOwner: string | null = null;
  #activeUrl: string | null = null;
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
    if (this.#activeOwner !== owner || this.#activeUrl !== url) {
      for (const cachedUrl of [...this.#entries.keys()]) {
        if (cachedUrl !== url) this.clear(cachedUrl);
      }
      if (this.#entries.get(url)?.status === "rejected") {
        this.clear(url);
      }
      this.#activeOwner = owner;
      this.#activeUrl = url;
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
        return value;
      },
      (error: unknown) => {
        const stale =
          controller.signal.aborted || this.#entries.get(url) !== entry;
        const active = this.#activeUrl === url;
        if (this.#entries.get(url) === entry && !active) {
          this.#entries.delete(url);
        } else if (this.#entries.get(url) === entry) {
          entry.status = "rejected";
        }
        throw stale ? abortError() : error;
      },
    ) as Promise<T>;
    void entry.promise.catch(() => undefined);
    return entry.promise;
  }

  preload(url: string): Promise<T> {
    for (const cachedUrl of [...this.#entries.keys()]) {
      if (cachedUrl !== this.#activeUrl && cachedUrl !== url) {
        this.clear(cachedUrl);
      }
    }
    return this.load(url);
  }

  peek(url: string): T | undefined {
    return this.#entries.get(url)?.value;
  }

  clear(url: string): void {
    const entry = this.#entries.get(url);
    if (this.#activeUrl === url) {
      this.#activeOwner = null;
      this.#activeUrl = null;
    }
    if (!entry) return;
    this.#entries.delete(url);
    entry.controller.abort();
    if (entry.value !== undefined) this.safeDispose(entry.value);
  }

  clearAll(): void {
    for (const url of [...this.#entries.keys()]) this.clear(url);
    this.#activeOwner = null;
    this.#activeUrl = null;
  }

  private safeDispose(value: T): void {
    try {
      this.loader.dispose(value);
    } catch {
      // Eviction is best-effort and must not destabilize the active page.
    }
  }
}

// Local image store (IndexedDB). Upload images in the browser; they persist
// per-origin, are shared across tabs (Content Factory + Studio), and resolve by
// filename. No server, no keys. Falls back to /jsonfileImages/{name} for images
// shipped in the repo.

const DB_NAME = 'js-images'
const STORE = 'images'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function reqToPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function putBlob(name: string, blob: Blob): Promise<void> {
  const db = await openDB()
  await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, name) as IDBRequest)
  db.close()
}

async function getAll(): Promise<{ name: string; blob: Blob }[]> {
  const db = await openDB()
  const store = db.transaction(STORE, 'readonly').objectStore(STORE)
  const [keys, vals] = await Promise.all([
    reqToPromise(store.getAllKeys() as IDBRequest<IDBValidKey[]>),
    reqToPromise(store.getAll() as IDBRequest<Blob[]>),
  ])
  db.close()
  return keys.map((k, i) => ({ name: String(k), blob: vals[i] }))
}

async function clearStore(): Promise<void> {
  const db = await openDB()
  await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).clear() as IDBRequest)
  db.close()
}

// ── in-memory filename → objectURL map (sync access for rendering) ──
const urlMap = new Map<string, string>()
let loaded = false

/** Build the filename→URL map from IndexedDB. Call once on mount. */
export async function loadImageMap(): Promise<void> {
  if (loaded) return
  const all = await getAll().catch(() => [])
  for (const { name, blob } of all) {
    if (!urlMap.has(name)) urlMap.set(name, URL.createObjectURL(blob))
  }
  loaded = true
}

/** Resolve a filename to a URL: uploaded blob first, else repo path. */
export function resolveImage(name?: string): string | null {
  if (!name) return null
  return urlMap.get(name) ?? `/jsonfileImages/${name}`
}

/** Is this filename available as an uploaded image? */
export function isUploaded(name?: string): boolean {
  return !!name && urlMap.has(name)
}

export function uploadedNames(): string[] {
  return [...urlMap.keys()].sort()
}

/** Store an uploaded file and make it immediately resolvable. */
export async function addUpload(file: File): Promise<void> {
  await putBlob(file.name, file)
  const prev = urlMap.get(file.name)
  if (prev) URL.revokeObjectURL(prev)
  urlMap.set(file.name, URL.createObjectURL(file))
}

export async function clearUploads(): Promise<void> {
  await clearStore()
  for (const u of urlMap.values()) URL.revokeObjectURL(u)
  urlMap.clear()
}

window.MorzsaCache = (() => {
  const memory = /* @__PURE__ */ new Map(), flights = /* @__PURE__ */ new Map(), urls = /* @__PURE__ */ new Map(), epochs = /* @__PURE__ */ new Map(), scopeEpochs = /* @__PURE__ */ new Map();
  let db = null, writes = Promise.resolve();
  const MAX_RECORDS = 256, MAX_BYTES = 48 * 1024 * 1024;
  const counts = { hits: 0, misses: 0, coalesced: 0 };
  const clone = (v) => typeof structuredClone === "function" ? structuredClone(v) : v instanceof Blob ? v.slice(0, v.size, v.type) : JSON.parse(JSON.stringify(v)), epoch = (a) => epochs.get(a) || 0;
  const scope = (accountId, householdId) => ({ accountId: accountId || "guest", householdId: householdId || "local", epoch: epoch(accountId || "guest"), scopeEpoch: scopeEpochs.get(JSON.stringify([accountId || "guest", householdId || "local"])) || 0 });
  const current = () => scope(window.household?.userId(), window.household?.active);
  const valid = (s) => s && epoch(s.accountId) === s.epoch && (scopeEpochs.get(JSON.stringify([s.accountId, s.householdId])) || 0) === s.scopeEpoch;
  const id = (s, type, key) => JSON.stringify([s.accountId, s.householdId, type, key]);
  function prune() {
    let bytes = 0;
    for (const r of memory.values()) bytes += r.bytes || 0;
    for (const [key, r] of memory) {
      if (r.staleUntil < Date.now() || memory.size > MAX_RECORDS || bytes > MAX_BYTES) {
        memory.delete(key);
        bytes -= r.bytes || 0;
        if (urls.has(key)) {
          URL.revokeObjectURL(urls.get(key));
          urls.delete(key);
        }
      }
    }
  }
  const ready = new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve();
      return;
    }
    let request;
    try {
      request = indexedDB.open("morzsa-device-cache", 1);
    } catch {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 500);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    request.onupgradeneeded = () => request.result.createObjectStore("entries", { keyPath: "id" });
    request.onerror = request.onblocked = finish;
    request.onsuccess = () => {
      db = request.result;
      db.onversionchange = () => {
        db.close();
        db = null;
      };
      finish();
    };
  });
  function persist(work) {
    writes = writes.then(() => ready).then(() => new Promise((resolve) => {
      if (!db) {
        resolve();
        return;
      }
      try {
        const tx = db.transaction("entries", "readwrite");
        work(tx.objectStore("entries"));
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    }));
    return writes;
  }
  function peek(s, type, key, { stale = false } = {}) {
    if (!valid(s)) return null;
    const k = id(s, type, key), r = memory.get(k);
    if (!r || (stale ? r.staleUntil : r.expiresAt) < Date.now()) {
      counts.misses++;
      return null;
    }
    memory.delete(k);
    memory.set(k, r);
    counts.hits++;
    return clone(r.value);
  }
  async function get(s, type, key, options = {}) {
    await ready;
    const cached = peek(s, type, key, options);
    if (cached !== null || !db || !valid(s)) return cached;
    await writes;
    if (!valid(s)) return null;
    return new Promise((resolve) => {
      try {
        const request = db.transaction("entries").objectStore("entries").get(id(s, type, key));
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const r = request.result;
          if (!valid(s) || !r || (options.stale ? r.staleUntil : r.expiresAt) < Date.now()) {
            resolve(null);
            return;
          }
          memory.set(r.id, r);
          prune();
          counts.hits++;
          resolve(clone(r.value));
        };
      } catch {
        resolve(null);
      }
    });
  }
  function put(s, type, key, value, { ttl = 6e4, staleTtl = 864e5 } = {}) {
    if (!valid(s) || value === void 0) return;
    const k = id(s, type, key), now = Date.now(), bytes = value instanceof Blob ? value.size : JSON.stringify(value).length * 2;
    if (bytes > 4 * 1024 * 1024) return;
    const r = { id: k, accountId: s.accountId, householdId: s.householdId, value: clone(value), bytes, expiresAt: now + ttl, staleUntil: now + Math.max(ttl, staleTtl), savedAt: now };
    memory.delete(k);
    memory.set(k, r);
    prune();
    persist((store) => {
      if (!valid(s)) return;
      store.put(r);
      const request = store.getAll();
      request.onsuccess = () => {
        const records = request.result.sort((a, b) => b.savedAt - a.savedAt);
        let total = 0;
        records.forEach((old, index) => {
          total += old.bytes || 0;
          if (index >= MAX_RECORDS || total > MAX_BYTES || old.staleUntil < Date.now()) store.delete(old.id);
        });
      };
    });
  }
  function clearScope(s) {
    if (!s) return;
    const sk = JSON.stringify([s.accountId, s.householdId]);
    scopeEpochs.set(sk, (scopeEpochs.get(sk) || 0) + 1);
    for (const [k, r] of memory) if (r.accountId === s.accountId && r.householdId === s.householdId) {
      memory.delete(k);
      if (urls.has(k)) {
        URL.revokeObjectURL(urls.get(k));
        urls.delete(k);
      }
    }
    return persist((store) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          if (c.value.accountId === s.accountId && c.value.householdId === s.householdId) c.delete();
          c.continue();
        }
      };
    });
  }
  function remove(s, type, key) {
    const k = id(s, type, key);
    memory.delete(k);
    if (urls.has(k)) {
      URL.revokeObjectURL(urls.get(k));
      urls.delete(k);
    }
    return persist((store) => store.delete(k));
  }
  function clearAccount(accountId) {
    if (!accountId) return;
    epochs.set(accountId, epoch(accountId) + 1);
    for (const [k, r] of memory) if (r.accountId === accountId) {
      memory.delete(k);
      if (urls.has(k)) {
        URL.revokeObjectURL(urls.get(k));
        urls.delete(k);
      }
    }
    return persist((store) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          if (c.value.accountId === accountId) c.delete();
          c.continue();
        }
      };
    });
  }
  async function run(s, type, key, work) {
    if (!valid(s)) throw Error("Account changed");
    const k = id(s, type, key) + ":" + s.epoch + ":" + s.scopeEpoch;
    if (flights.has(k)) {
      counts.coalesced++;
      return clone(await flights.get(k));
    }
    const promise = Promise.resolve().then(work).then((v) => {
      if (!valid(s)) throw Error("Account changed");
      return v;
    });
    flights.set(k, promise);
    try {
      return clone(await promise);
    } finally {
      if (flights.get(k) === promise) flights.delete(k);
    }
  }
  async function image(s, url) {
    const asset = new URL(url), key = asset.origin + asset.pathname, k = id(s, "image", key);
    let blob = await get(s, "image", key);
    if (!blob) blob = await run(s, "image", key, async () => {
      const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(15e3) });
      if (!response.ok) throw Error("Image unavailable");
      const value = await response.blob();
      if (!value.type.startsWith("image/") || value.size > 4 * 1024 * 1024) throw Error("Invalid image");
      put(s, "image", key, value, { ttl: 7 * 864e5 });
      return value;
    });
    if (!valid(s)) throw Error("Account changed");
    if (!urls.has(k)) urls.set(k, URL.createObjectURL(blob));
    return urls.get(k);
  }
  return { scope, current, valid, ready, peek, get, put, remove, clearScope, clearAccount, run, image, stats: () => ({ ...counts, entries: memory.size }) };
})();

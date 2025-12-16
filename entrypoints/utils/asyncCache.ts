/**
 * IndexedDB 异步缓存模块
 * 替代 localStorage 避免阻塞主线程
 */

import { openDB, type IDBPDatabase } from 'idb';
import { config } from "@/entrypoints/utils/config";
import { customModelString } from "./option";

const DB_NAME = 'FluentReadCache';
const DB_VERSION = 1;
const STORE_NAME = 'translations';
const MAX_CACHE_ITEMS = 2000;
const prefix = "flcache_";

let dbInstance: IDBPDatabase | null = null;
let dbInitPromise: Promise<IDBPDatabase> | null = null;

/**
 * 获取数据库实例（单例）
 */
async function getDB(): Promise<IDBPDatabase> {
    if (dbInstance) return dbInstance;

    if (!dbInitPromise) {
        dbInitPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp');
                }
            },
        });
    }

    dbInstance = await dbInitPromise;
    return dbInstance;
}

/**
 * 构建缓存 key
 */
function buildKey(message: string): string {
    const { service, model, to, style, customModel } = config;
    const selectedModel = model[service] === customModelString ? customModel[service] : model[service];
    return [prefix, style, service, selectedModel, to, message].join('_');
}

/**
 * 异步获取缓存
 */
export async function asyncGet(origin: string): Promise<string | null> {
    if (!config.useCache) return null;

    try {
        const db = await getDB();
        const key = buildKey(origin);
        const record = await db.get(STORE_NAME, key);
        return record?.value ?? null;
    } catch (error) {
        console.warn('[FluentRead] IndexedDB get failed, falling back:', error);
        // Fallback to localStorage
        return localStorage.getItem(buildKey(origin));
    }
}

/**
 * 异步设置缓存
 */
export async function asyncSet(origin: string, value: string): Promise<void> {
    if (!config.useCache) return;

    try {
        const db = await getDB();
        const key = buildKey(origin);
        await db.put(STORE_NAME, {
            key,
            value,
            timestamp: Date.now(),
        });

        // 异步清理过期缓存
        enforceLimit().catch(() => { });
    } catch (error) {
        console.warn('[FluentRead] IndexedDB set failed, falling back:', error);
        // Fallback to localStorage
        localStorage.setItem(buildKey(origin), value);
    }
}

/**
 * 异步双向设置缓存（原文→译文，译文→原文）
 */
export async function asyncSetDual(origin: string, translated: string): Promise<void> {
    await Promise.all([
        asyncSet(origin, translated),
        asyncSet(translated, origin),
    ]);
}

/**
 * 异步删除缓存
 */
export async function asyncRemove(origin: string): Promise<void> {
    try {
        const db = await getDB();
        const key = buildKey(origin);

        // 获取对应的译文
        const record = await db.get(STORE_NAME, key);

        // 删除原文和译文的缓存
        await db.delete(STORE_NAME, key);
        if (record?.value) {
            await db.delete(STORE_NAME, buildKey(record.value));
        }
    } catch (error) {
        console.warn('[FluentRead] IndexedDB remove failed:', error);
    }
}

/**
 * 清理超出限制的缓存（按时间戳删除最老的）
 */
async function enforceLimit(): Promise<void> {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const count = await store.count();

        if (count <= MAX_CACHE_ITEMS) return;

        // 获取最老的记录
        const index = store.index('timestamp');
        let cursor = await index.openCursor();
        let deleteCount = count - MAX_CACHE_ITEMS;

        while (cursor && deleteCount > 0) {
            await cursor.delete();
            deleteCount--;
            cursor = await cursor.continue();
        }

        await tx.done;
    } catch (error) {
        console.warn('[FluentRead] Cache cleanup failed:', error);
    }
}

/**
 * 清空所有缓存
 */
export async function asyncClear(): Promise<void> {
    try {
        const db = await getDB();
        await db.clear(STORE_NAME);
    } catch (error) {
        console.warn('[FluentRead] IndexedDB clear failed:', error);
    }

    // 同时清理 localStorage 中的旧缓存
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) keysToDelete.push(key);
    }
    keysToDelete.forEach(key => localStorage.removeItem(key));
}

/**
 * 24小时清理一次过期缓存
 */
export async function scheduledCleanup(): Promise<void> {
    const lastCleanup = localStorage.getItem('flLastCacheCleanup');
    const now = Date.now();

    if (!lastCleanup || now - parseInt(lastCleanup) > 24 * 3600000) {
        await enforceLimit();
        localStorage.setItem('flLastCacheCleanup', now.toString());
    }
}

// ==================== 兼容层 ====================
// 保留原有同步 API，内部使用异步实现

/**
 * 同步获取（内部转异步，用于向后兼容）
 * 注意：首次调用可能返回 null，等待异步加载完成后才返回正确值
 */
const syncCache = new Map<string, string>();
let syncCacheLoaded = false;

export async function preloadCache(): Promise<void> {
    try {
        const db = await getDB();
        const allRecords = await db.getAll(STORE_NAME);
        allRecords.forEach(record => {
            syncCache.set(record.key, record.value);
        });
        syncCacheLoaded = true;
    } catch (error) {
        console.warn('[FluentRead] Cache preload failed:', error);
    }
}

export function syncGet(origin: string): string | null {
    if (!config.useCache) return null;
    const key = buildKey(origin);

    // 优先从内存缓存读取
    if (syncCache.has(key)) {
        return syncCache.get(key) ?? null;
    }

    // Fallback to localStorage
    return localStorage.getItem(key);
}

export function syncSet(origin: string, value: string): void {
    if (!config.useCache) return;
    const key = buildKey(origin);

    // 写入内存缓存
    syncCache.set(key, value);

    // 异步写入 IndexedDB
    asyncSet(origin, value).catch(() => { });
}

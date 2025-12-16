import { customModelString } from "./option";
import { config } from "@/entrypoints/utils/config";
import {
    asyncGet,
    asyncSet,
    asyncSetDual,
    asyncRemove,
    asyncClear,
    scheduledCleanup,
    syncGet,
    syncSet,
    preloadCache
} from "./asyncCache";

const prefix = "flcache_"; // fluent read cache

// 构建缓存 key (仅用于向后兼容)
function buildKey(message: string) {
    const { service, model, to, style, customModel } = config;
    const selectedModel = model[service] === customModelString ? customModel[service] : model[service];
    return [prefix, style, service, selectedModel, to, message].join('_');
}

export const cache = {
    // 存入缓存并设置过期时间（用于防抖 Set）
    set(set: Set<any>, key: any, expire: number) {
        if (!config.useCache) return;

        set.add(key);
        if (expire >= 0) {
            setTimeout(() => set.delete(key), expire);
        }
    },

    // ==================== 异步 API（推荐） ====================

    /** 异步获取缓存 */
    async get(origin: string): Promise<string | null> {
        return asyncGet(origin);
    },

    /** 异步设置缓存 */
    async setAsync(origin: string, value: string): Promise<void> {
        return asyncSet(origin, value);
    },

    /** 异步双向设置（原文↔译文） */
    async setDualAsync(origin: string, translated: string): Promise<void> {
        return asyncSetDual(origin, translated);
    },

    /** 异步删除缓存 */
    async remove(origin: string): Promise<void> {
        return asyncRemove(origin);
    },

    // ==================== 同步 API（向后兼容） ====================

    /** 同步获取（优先内存缓存，fallback localStorage） */
    localGet(origin: string): string | null {
        return syncGet(origin);
    },

    /** 同步设置（写内存 + 异步写 IndexedDB） */
    localSet(key: string, value: string): void {
        syncSet(key, value);
    },

    /** 同步双向设置 */
    localSetDual(key: string, value: string): void {
        if (!config.useCache) return;
        this.localSet(value, key);
        this.localSet(key, value);
    },

    /** 删除缓存 */
    localRemove(origin: string): void {
        const key = buildKey(origin);
        const result = localStorage.getItem(key);
        localStorage.removeItem(key);
        if (result) {
            localStorage.removeItem(buildKey(result));
        }
        // 异步删除 IndexedDB
        asyncRemove(origin).catch(() => { });
    },

    // ==================== 清理 API ====================

    /** 24h 清理一次缓存（页面加载时调用） */
    cleaner(): void {
        scheduledCleanup().catch(() => { });
    },

    /** 清除所有翻译缓存 */
    clean(): void {
        asyncClear().catch(() => { });
    },

    /** 预加载缓存到内存（提升同步 API 性能） */
    preload(): void {
        preloadCache().catch(() => { });
    },

    // 不再需要 enforceLimit，由 asyncCache 内部处理
    enforceLimit(): void {
        // No-op, handled internally by asyncCache
    }
};

// 用于节点序列化
export function stringifyNode(node: any): string {
    const serializer = new XMLSerializer();
    let outerHTML = serializer.serializeToString(node);
    return outerHTML.replace(/\s{2,}/g, ' ').trim();
}
import { services, models, customModelString } from './option';
import { config } from './config';

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface SiliconCloudResponse {
  object: string;
  data: ModelInfo[];
}

type ProviderFn = (apiKey: string, baseUrl?: string) => Promise<string[]>;

class ModelService {
  private static instance: ModelService;
  private cache = new Map<string, { models: string[]; timestamp: number }>();
  private cacheDuration = 1000 * 60 * 60; // 1小时缓存
  private providers = new Map<string, ProviderFn>();

  private constructor() {
    // 注册默认的动态模型提供者：硅基流动
    this.providers.set(services.siliconCloud, async (apiKey: string) => {
      const response = await fetch('https://api.siliconflow.cn/v1/models?type=text', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SiliconCloudResponse = await response.json();
      const list = data.data
        .filter((model: ModelInfo) => 
          model.id && 
          !model.id.toLowerCase().includes('embedding') && 
          !model.id.toLowerCase().includes('reranker') &&
          !model.id.toLowerCase().includes('bge')
        )
        .map((model: ModelInfo) => model.id)
        .sort();
      return list;
    });

    // 注册默认的动态模型提供者：New API
    this.providers.set(services.newapi, async (apiKey: string, baseUrl?: string) => {
      const apiBaseUrl = baseUrl || config.newApiUrl;
      if (!apiBaseUrl) {
        throw new Error('New API地址未配置');
      }

      let url = apiBaseUrl;
      if (url.endsWith('/')) {
        url = url.slice(0, -1); // 删除末尾的斜杠
      }
      url += '/api/models';

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'New-Api-User': `Bearer ${apiKey}` // 使用相同的token作为用户ID
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || '获取模型列表失败');
      }

      // 将嵌套的对象结构转换为模型名称数组
      const models: string[] = [];
      Object.values(data.data).forEach((modelList: any) => {
        if (Array.isArray(modelList)) {
          models.push(...modelList);
        }
      });

      return models.sort();
    });
  }

  static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService();
    }
    return ModelService.instance;
  }

  hasProvider(service: string): boolean {
    return this.providers.has(service);
  }

  /**
   * 对外暴露的注册接口：新增服务商的模型获取逻辑
   * 使用方式：modelService.registerProvider(services.xxx, async (apiKey, baseUrl) => { ...return string[] })
   */
  registerProvider(service: string, provider: ProviderFn): void {
    this.providers.set(service, provider);
  }

  /**
   * 可选：移除已有的动态提供者
   */
  unregisterProvider(service: string): void {
    this.providers.delete(service);
  }

  /**
   * 缓存封装：根据 service + apiKey 构建键
   */
  private buildCacheKey(service: string, apiKey: string) {
    const suffix = apiKey ? apiKey.slice(-8) : 'anonymous';
    return `${service}_${suffix}`;
  }

  /**
   * 通过注册表获取动态模型列表
   */
  private async fetchByProvider(service: string, apiKey: string, baseUrl?: string): Promise<string[]> {
    const provider = this.providers.get(service);
    if (!provider) return [];

    const cacheKey = this.buildCacheKey(service, apiKey);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const list = await provider(apiKey, baseUrl);
    this.setCache(cacheKey, list);
    return list;
  }

  /**
   * 从缓存获取模型列表
   */
  private getFromCache(key: string): string[] | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.models;
    }
    return null;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, models: string[]): void {
    this.cache.set(key, {
      models,
      timestamp: Date.now(),
    });
  }

  /**
   * 清除缓存
   */
  clearCache(service: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(service));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * 获取模型列表（优先使用API，失败则使用本地预设）
   */
  async getDynamicModels(service: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    if (this.hasProvider(service) && apiKey) {
      try {
        const list = await this.fetchByProvider(service, apiKey, baseUrl);
        return [...list, customModelString];
      } catch (error) {
        console.warn('Failed to fetch models from API, using local preset:', error);
        return this.getLocalModels(service);
      }
    }
    return this.getLocalModels(service);
  }

  /**
   * 获取本地预设模型列表
   */
  private getLocalModels(service: string): string[] {
    const preset = models.get(service);
    return preset && preset.length > 0 ? preset : [customModelString];
  }

  /**
   * 强制刷新模型列表
   */
  async refreshModels(service: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    this.clearCache(service);
    return this.getDynamicModels(service, apiKey, baseUrl);
  }
}

export const modelService = ModelService.getInstance();

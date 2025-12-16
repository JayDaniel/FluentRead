/**
 * 翻译队列管理模块 v2
 * 支持三级优先级、请求去重、取消机制
 */

import { config } from './config';

// ==================== 类型定义 ====================

export type Priority = 'high' | 'normal' | 'low';

interface Task {
  id: string;
  priority: Priority;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  controller: AbortController;
  cacheKey?: string;
}

// ==================== 队列状态 ====================

let activeTranslations = 0;

// 三级优先级队列
const highPriorityQueue: Task[] = [];
const normalQueue: Task[] = [];
const lowPriorityQueue: Task[] = [];

// 请求去重 Map: cacheKey -> Promise
const inFlightRequests = new Map<string, Promise<any>>();

// 活跃任务 Map: taskId -> Task
const activeTasks = new Map<string, Task>();

let taskIdCounter = 0;

// ==================== 配置 ====================

function getMaxConcurrent(): number {
  return config.maxConcurrentTranslations || 6;
}

function getMaxQueueLength(): number {
  return getMaxConcurrent() * 5; // 提高队列容量
}

// ==================== 核心 API ====================

/**
 * 入队翻译任务（支持优先级和去重）
 */
export function enqueueTranslation<T>(
  translationTask: () => Promise<T>,
  options: {
    priority?: Priority;
    cacheKey?: string;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const { priority = 'normal', cacheKey, signal } = options;

  // 请求去重：如果相同内容正在翻译，复用结果
  if (cacheKey && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  // 检查外部取消信号
  if (signal?.aborted) {
    return Promise.reject(new Error('翻译已取消'));
  }

  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    const taskId = `task-${++taskIdCounter}`;

    // 监听外部取消信号
    if (signal) {
      signal.addEventListener('abort', () => {
        controller.abort();
        cancelTask(taskId);
      });
    }

    const task: Task = {
      id: taskId,
      priority,
      fn: translationTask,
      resolve,
      reject,
      controller,
      cacheKey,
    };

    // 检查队列容量
    const totalPending = getTotalPending();
    if (totalPending >= getMaxQueueLength()) {
      // 队列满时，低优先级任务直接拒绝
      if (priority === 'low') {
        reject(new Error('翻译队列已满'));
        return;
      }
      // 高/中优先级挤掉最老的低优先级任务
      if (lowPriorityQueue.length > 0) {
        const dropped = lowPriorityQueue.shift();
        dropped?.reject(new Error('被高优先级任务挤出队列'));
      } else if (totalPending >= getMaxQueueLength()) {
        reject(new Error('翻译队列已满'));
        return;
      }
    }

    // 入队
    getQueueByPriority(priority).push(task);

    // 注册去重
    if (cacheKey) {
      const promise = new Promise<T>((res, rej) => {
        task.resolve = (v) => { res(v); resolve(v); };
        task.reject = (e) => { rej(e); reject(e); };
      }).finally(() => {
        inFlightRequests.delete(cacheKey);
      });
      inFlightRequests.set(cacheKey, promise);
    }

    // 尝试处理队列
    processQueue();
  });
}

/**
 * 处理队列
 */
function processQueue(): void {
  while (activeTranslations < getMaxConcurrent()) {
    const task = dequeue();
    if (!task) break;

    if (task.controller.signal.aborted) {
      task.reject(new Error('翻译已取消'));
      continue;
    }

    activeTranslations++;
    activeTasks.set(task.id, task);

    executeTask(task);
  }
}

/**
 * 执行任务
 */
async function executeTask(task: Task): Promise<void> {
  try {
    const result = await task.fn();
    task.resolve(result);
  } catch (error) {
    task.reject(error);
  } finally {
    activeTranslations--;
    activeTasks.delete(task.id);
    processQueue();
  }
}

/**
 * 优先级出队：高 > 中 > 低
 */
function dequeue(): Task | undefined {
  return highPriorityQueue.shift()
    ?? normalQueue.shift()
    ?? lowPriorityQueue.shift();
}

/**
 * 取消单个任务
 */
function cancelTask(taskId: string): boolean {
  // 从队列中移除
  for (const queue of [highPriorityQueue, normalQueue, lowPriorityQueue]) {
    const index = queue.findIndex(t => t.id === taskId);
    if (index !== -1) {
      const task = queue.splice(index, 1)[0];
      task.controller.abort();
      task.reject(new Error('翻译已取消'));
      return true;
    }
  }

  // 取消活跃任务
  const activeTask = activeTasks.get(taskId);
  if (activeTask) {
    activeTask.controller.abort();
    return true;
  }

  return false;
}

// ==================== 公共 API ====================

/**
 * 清空翻译队列（保留活跃任务）
 */
export function clearTranslationQueue(): void {
  // 取消所有等待中的任务
  for (const queue of [highPriorityQueue, normalQueue, lowPriorityQueue]) {
    while (queue.length > 0) {
      const task = queue.shift();
      task?.controller.abort();
      task?.reject(new Error('队列已清空'));
    }
  }
  inFlightRequests.clear();
}

/**
 * 取消所有任务（包括活跃任务）
 */
export function cancelAllTranslations(): void {
  clearTranslationQueue();

  // 取消所有活跃任务
  for (const task of activeTasks.values()) {
    task.controller.abort();
  }
}

/**
 * 获取队列状态
 */
export function getQueueStatus() {
  return {
    activeTranslations,
    highPriority: highPriorityQueue.length,
    normalPriority: normalQueue.length,
    lowPriority: lowPriorityQueue.length,
    pendingTranslations: getTotalPending(),
    maxConcurrent: getMaxConcurrent(),
    isQueueFull: getTotalPending() >= getMaxQueueLength(),
    totalTasksInProcess: activeTranslations + getTotalPending(),
    inFlightRequests: inFlightRequests.size,
  };
}

/**
 * 检查是否可以添加更多任务
 */
export function canAcceptMoreTasks(priority: Priority = 'normal'): boolean {
  const total = getTotalPending();
  const max = getMaxQueueLength();

  // 高优先级总是可以入队（会挤掉低优先级）
  if (priority === 'high') return true;

  // 其他按容量判断
  return total < max;
}

/**
 * 获取 AbortSignal（供外部使用）
 */
export function createAbortController(): AbortController {
  return new AbortController();
}

// ==================== 内部辅助 ====================

function getQueueByPriority(priority: Priority): Task[] {
  switch (priority) {
    case 'high': return highPriorityQueue;
    case 'low': return lowPriorityQueue;
    default: return normalQueue;
  }
}

function getTotalPending(): number {
  return highPriorityQueue.length + normalQueue.length + lowPriorityQueue.length;
}


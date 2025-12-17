<template>
  <div class="modern-container">
    
    <!-- 全局开关卡片 -->
    <div class="setting-card">
      <div class="setting-item">
        <div class="setting-label-group">
          <span class="setting-label">插件状态</span>
          <span class="setting-description">开启或关闭所有翻译功能</span>
        </div>
        <div class="setting-control">
          <el-switch v-model="config.on" inline-prompt active-text="开" inactive-text="关" @change="handlePluginStateChange" />
        </div>
      </div>
    </div>

    <!-- 占位符 -->
    <div v-if="!config.on" style="padding: 20px 0;">
      <el-empty description="插件处于禁用状态" />
    </div>

    <div v-show="config.on">
      
      <!-- 核心设置分组 -->
      <div class="section-title">核心设置</div>
      <div class="setting-card">
        
        <!-- 翻译模式 -->
        <div class="setting-item">
          <div class="setting-label-group">
            <span class="setting-label">翻译模式</span>
          </div>
          <div class="setting-control">
            <el-select v-model="config.display" placeholder="请选择翻译模式" style="width: 140px">
              <el-option v-for="item in options.display" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>

        <!-- 译文样式 (仅双语模式显示) -->
        <div class="setting-item" v-show="config.display === 1">
          <div class="setting-label-group">
            <span class="setting-label">
              译文样式
              <el-tooltip content="选择双语模式下译文的显示样式，提供多种美观的效果" placement="top" :show-after="500">
                <el-icon class="setting-icon"><InfoFilled /></el-icon>
              </el-tooltip>
            </span>
          </div>
          <div class="setting-control">
            <el-select v-model="config.style" placeholder="请选择样式" style="width: 140px">
              <el-option-group v-for="group in styleGroups" :key="group.value" :label="group.label">
                <el-option v-for="item in group.options" :key="item.value" :label="item.label" :value="item.value" />
              </el-option-group>
            </el-select>
          </div>
        </div>

        <!-- 翻译服务 -->
        <div class="setting-item">
          <div class="setting-label-group">
            <span class="setting-label">
              翻译服务
              <el-tooltip content="机器翻译快速稳定；AI翻译更自然流畅" placement="top" :show-after="500">
                <el-icon class="setting-icon"><InfoFilled /></el-icon>
              </el-tooltip>
            </span>
          </div>
          <div class="setting-control">
            <el-select v-model="config.service" placeholder="请选择服务" style="width: 140px">
              <el-option v-for="item in compute.filteredServices" :key="item.value" :label="item.label" :value="item.value"
                :disabled="item.disabled" :class="{ 'select-divider': item.disabled }" />
            </el-select>
          </div>
        </div>

        <!-- 目标语言 -->
        <div class="setting-item">
          <div class="setting-label-group">
            <span class="setting-label">目标语言</span>
          </div>
          <div class="setting-control">
            <el-select v-model="config.to" placeholder="请选择语言" style="width: 140px">
              <el-option v-for="item in options.to" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>
      </div>

      <!-- 服务详情设置 (动态显示) -->
      <div class="section-title" v-if="compute.showToken || compute.showModel || compute.showAzureOpenaiEndpoint || compute.showDeepLX || compute.showAkSk || compute.showYoudao || compute.showTencent || compute.showRobotId || compute.showCustom || compute.showNewAPI || compute.showCustomModel">服务配置</div>
      <div class="setting-card" v-if="compute.showToken || compute.showModel || compute.showAzureOpenaiEndpoint || compute.showDeepLX || compute.showAkSk || compute.showYoudao || compute.showTencent || compute.showRobotId || compute.showCustom || compute.showNewAPI || compute.showCustomModel">
        
        <!-- Token -->
        <div class="setting-item" v-show="compute.showToken">
          <div class="setting-label-group">
            <span class="setting-label">
              访问令牌 (Token)
              <el-tooltip content="API访问令牌，ollama可填任意值" placement="top" :show-after="500">
                <el-icon class="setting-icon"><InfoFilled /></el-icon>
              </el-tooltip>
            </span>
          </div>
          <div class="setting-control" style="width: 60%">
            <el-input v-model="config.token[config.service]" type="password" show-password placeholder="请输入 Token" />
          </div>
        </div>

        <!-- Azure Endpoint -->
        <div class="setting-item" v-show="compute.showAzureOpenaiEndpoint" style="align-items: flex-start;">
            <div class="setting-label-group">
                <span class="setting-label">Azure 端点</span>
                <span class="setting-description" style="font-size: 10px; opacity: 0.6;">包含 openai.azure.com 和 /chat/completions</span>
            </div>
            <div class="setting-control" style="width: 60%; flex-direction: column; align-items: flex-end;">
                <el-input v-model="config.azureOpenaiEndpoint" placeholder="https://..." :class="{ 'input-error': config.azureOpenaiEndpoint && !isValidAzureEndpoint(config.azureOpenaiEndpoint) }" />
                 <div v-if="config.azureOpenaiEndpoint && !isValidAzureEndpoint(config.azureOpenaiEndpoint)" class="error-text" style="font-size: 10px; text-align: right;">
                    格式不正确
                </div>
            </div>
        </div>

        <!-- DeepLX -->
         <div class="setting-item" v-show="compute.showDeepLX">
          <div class="setting-label-group">
            <span class="setting-label">DeepLX 地址</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.deeplx" placeholder="http://localhost:1188/translate" />
          </div>
        </div>

        <!-- AK/SK (Baidu) -->
         <div class="setting-item" v-show="compute.showAkSk">
          <div class="setting-label-group">
            <span class="setting-label">API Key</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.ak" placeholder="Access Key" />
          </div>
        </div>
        <div class="setting-item" v-show="compute.showAkSk">
          <div class="setting-label-group">
            <span class="setting-label">Secret Key</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.sk" type="password" placeholder="Secret Key" />
          </div>
        </div>

        <!-- Youdao -->
         <div class="setting-item" v-show="compute.showYoudao">
          <div class="setting-label-group">
            <span class="setting-label">App Key</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.youdaoAppKey" placeholder="App Key" />
          </div>
        </div>
        <div class="setting-item" v-show="compute.showYoudao">
          <div class="setting-label-group">
            <span class="setting-label">App Secret</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.youdaoAppSecret" type="password" show-password placeholder="App Secret" />
          </div>
        </div>
        
        <!-- Tencent -->
         <div class="setting-item" v-show="compute.showTencent">
          <div class="setting-label-group">
            <span class="setting-label">Secret ID</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.tencentSecretId" placeholder="Secret ID" />
          </div>
        </div>
        <div class="setting-item" v-show="compute.showTencent">
          <div class="setting-label-group">
            <span class="setting-label">Secret Key</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.tencentSecretKey" type="password" show-password placeholder="Secret Key" />
          </div>
        </div>

        <!-- Coze Robot ID -->
         <div class="setting-item" v-show="compute.showRobotId">
          <div class="setting-label-group">
            <span class="setting-label">Robot ID</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.robot_id[config.service]" placeholder="Coze Robot ID" />
          </div>
        </div>

        <!-- Custom Interface -->
         <div class="setting-item" v-show="compute.showCustom">
          <div class="setting-label-group">
            <span class="setting-label">接口地址</span>
             <span class="setting-description">OpenAI 兼容格式</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.custom" placeholder="http://localhost:11434/v1/chat/completions" />
          </div>
        </div>

         <!-- NewAPI -->
         <div class="setting-item" v-show="compute.showNewAPI">
          <div class="setting-label-group">
            <span class="setting-label">NewAPI 地址</span>
          </div>
          <div class="setting-control" style="width: 60%">
             <el-input v-model="config.newApiUrl" placeholder="http://localhost:3000" />
          </div>
        </div>

        <!-- Model Selection -->
        <div class="setting-item" v-show="compute.showModel">
          <div class="setting-label-group">
            <span class="setting-label">模型</span>
          </div>
          <div class="setting-control" style="width: 60%; justify-content: flex-end;">
             <div class="model-selector-container" style="display: flex; gap: 8px; width: 100%;">
              <el-select 
                v-model="config.model[config.service]" 
                placeholder="选择模型"
                :loading="isLoadingModels"
                style="flex: 1;"
              >
                <el-option v-for="item in compute.model" :key="item" :label="item" :value="item" />
              </el-select>
              <el-button 
                v-if="hasDynamicProvider && config.token[config.service]"
                :icon="Refresh"
                circle
                size="small"
                :loading="isLoadingModels"
                @click="refreshModels"
                title="刷新模型"
              />
            </div>
             <div v-if="modelError" class="error-text" style="width: 100%; text-align: right; margin-top: 4px;">{{ modelError }}</div>
          </div>
        </div>

        <!-- Custom Model Name -->
        <div class="setting-item" v-show="compute.showCustomModel">
          <div class="setting-label-group">
             <span class="setting-label">{{ config.service === 'doubao' ? '接入点 ID' : '自定义模型名' }}</span>
          </div>
           <div class="setting-control" style="width: 60%">
             <el-input v-model="config.customModel[config.service]" placeholder="例如：gemma:7b" />
          </div>
        </div>

      </div>

      <!-- 快捷键设置 -->
      <div class="section-title">快捷操作</div>
      <div class="setting-card">
        
        <!-- 鼠标悬浮快捷键 -->
        <div class="setting-item">
          <div class="setting-label-group">
            <span class="setting-label">鼠标悬浮翻译</span>
            <span class="setting-description">按住快捷键并悬停翻译</span>
          </div>
          <div class="setting-control">
             <div class="hotkey-config" style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <el-select v-model="config.hotkey" placeholder="选择快捷键" size="small" style="width: 120px" @change="handleMouseHotkeyChange">
                <el-option v-for="item in options.keys" :key="item.value" :label="item.label" :value="item.value" :disabled="item.disabled" :class="{ 'select-divider': item.disabled }" />
              </el-select>
              <div v-if="config.hotkey === 'custom'" class="custom-hotkey-display" style="font-size: 12px; display: flex; align-items: center; gap: 4px;">
                  <span class="hotkey-text" style="color: var(--el-color-primary);">{{ config.customHotkey ? getCustomMouseHotkeyDisplayName() : '未设置' }}</span>
                  <el-button size="small" type="text" @click="openCustomMouseHotkeyDialog" style="padding: 0;"><el-icon><Edit /></el-icon></el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 全文翻译快捷键 -->
        <div class="setting-item">
          <div class="setting-label-group">
            <span class="setting-label">全文翻译快捷键</span>
          </div>
          <div class="setting-control">
               <div class="hotkey-config" style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <el-select v-model="config.floatingBallHotkey" placeholder="选择快捷键" size="small" style="width: 120px" @change="handleHotkeyChange">
                <el-option v-for="item in options.floatingBallHotkeys" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
               <div v-if="config.floatingBallHotkey === 'custom'" class="custom-hotkey-display" style="font-size: 12px; display: flex; align-items: center; gap: 4px;">
                  <span class="hotkey-text" style="color: var(--el-color-primary);">{{ config.customFloatingBallHotkey ? getCustomHotkeyDisplayName() : '未设置' }}</span>
                  <el-button size="small" type="text" @click="openCustomHotkeyDialog" style="padding: 0;"><el-icon><Edit /></el-icon></el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 划词翻译模式 -->
        <div class="setting-item">
          <div class="setting-label-group">
            <span class="setting-label">划词翻译</span>
            <span class="setting-description">选中文本后显示图标</span>
          </div>
           <div class="setting-control">
            <el-select v-model="config.selectionTranslatorMode" placeholder="模式" size="small" style="width: 120px">
              <el-option label="关闭" value="disabled" />
              <el-option label="双语显示" value="bilingual" />
              <el-option label="只显示译文" value="translation-only" />
            </el-select>
          </div>
        </div>

      </div>

      <!-- 高级选项 -->
      <el-collapse class="modern-collapse" style="border: none;">
        <el-collapse-item name="advanced">
           <template #title>
             <div class="section-title" style="margin: 0; padding: 12px 0 0 4px; cursor: pointer;">高级选项</div>
           </template>
           
           <div class="setting-card" style="margin-top: 8px;">
             <!-- 主题 -->
             <div class="setting-item">
                <div class="setting-label-group"><span class="setting-label">主题设置</span></div>
                <div class="setting-control">
                  <el-select v-model="config.theme" placeholder="主题" size="small" style="width: 100px">
                    <el-option v-for="item in options.theme" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </div>
             </div>

             <!-- 缓存 -->
             <div class="setting-item">
               <div class="setting-label-group">
                 <span class="setting-label">缓存翻译结果</span>
                 <span class="setting-description">加快再次访问速度</span>
               </div>
               <div class="setting-control">
                 <el-switch v-model="config.useCache" inline-prompt active-text="开" inactive-text="关"/>
               </div>
             </div>

             <!-- 始终翻译 -->
             <div class="setting-item">
               <div class="setting-label-group">
                 <span class="setting-label">始终翻译</span>
                 <span class="setting-description">跳过语言检测强制翻译</span>
               </div>
               <div class="setting-control">
                 <el-switch v-model="config.alwaysTranslate" inline-prompt active-text="开" inactive-text="关"/>
               </div>
             </div>
             
             <!-- 悬浮球 -->
             <div class="setting-item">
               <div class="setting-label-group">
                 <span class="setting-label">全文翻译悬浮球</span>
               </div>
               <div class="setting-control">
                 <el-switch v-model="floatingBallEnabled" inline-prompt active-text="开" inactive-text="关"/>
               </div>
             </div>

             <!-- 进度面板 -->
              <div class="setting-item">
               <div class="setting-label-group">
                 <span class="setting-label">翻译进度面板</span>
               </div>
               <div class="setting-control">
                 <el-switch v-model="config.translationStatus" inline-prompt active-text="开" inactive-text="关"/>
               </div>
             </div>

             <!-- 动画 -->
              <div class="setting-item">
               <div class="setting-label-group">
                 <span class="setting-label">界面动画效果</span>
               </div>
               <div class="setting-control">
                 <el-switch v-model="config.animations" inline-prompt active-text="开" inactive-text="关"/>
               </div>
             </div>

             <!-- 输入框翻译 -->
             <div class="setting-item">
               <div class="setting-label-group">
                  <span class="setting-label">输入框翻译触发</span>
               </div>
               <div class="setting-control">
                  <el-select v-model="config.inputBoxTranslationTrigger" placeholder="触发方式" size="small" style="width: 120px">
                    <el-option v-for="item in options.inputBoxTranslationTrigger" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
               </div>
             </div>
             <div class="setting-item" v-if="config.inputBoxTranslationTrigger !== 'disabled'">
                <div class="setting-label-group"><span class="setting-label">输入框目标语言</span></div>
                <div class="setting-control">
                   <el-select v-model="config.inputBoxTranslationTarget" placeholder="语言" size="small" style="width: 120px">
                      <el-option v-for="item in options.inputBoxTranslationTarget" :key="item.value" :label="item.label" :value="item.value" />
                    </el-select>
                </div>
             </div>

             <!-- 并发数 -->
             <div class="setting-item">
                <div class="setting-label-group">
                  <span class="setting-label">最大翻译并发数</span>
                  <span class="setting-description">建议值: 5-20</span>
                </div>
                <div class="setting-control">
                   <el-input-number v-model="config.maxConcurrentTranslations" :min="1" :max="100" size="small" style="width: 100px" controls-position="right"/>
                </div>
             </div>

              <!-- 代理 -->
             <div class="setting-item" v-show="compute.showProxy">
                <div class="setting-label-group">
                   <span class="setting-label">代理地址</span>
                </div>
                <div class="setting-control" style="width: 60%">
                   <el-input v-model="config.proxy[config.service]" placeholder="默认不使用代理" size="small"/>
                </div>
             </div>

            <!-- AI Prompts -->
            <div v-show="compute.showAI">
              <div class="setting-item" style="flex-direction: column; align-items: flex-start;">
                 <div class="setting-label-group" style="margin-bottom: 8px;"><span class="setting-label">System Role</span></div>
                 <el-input type="textarea" v-model="config.system_role[config.service]" :rows="2" placeholder="system message" />
              </div>
               <div class="setting-item" style="flex-direction: column; align-items: flex-start;">
                 <div class="setting-label-group" style="margin-bottom: 8px;">
                    <span class="setting-label">User Role Template</span> 
                    <span class="setting-description">须包含 {{origin}} 和 {{to}}</span>
                 </div>
                 <el-input type="textarea" v-model="config.user_role[config.service]" :rows="3" placeholder="user message template" />
              </div>
               <div class="setting-item" style="justify-content: flex-end;">
                  <el-button type="primary" link size="small" @click="resetTemplate"><el-icon><Refresh /></el-icon> 恢复默认模板</el-button>
               </div>
            </div>

            <!-- Config Management -->
             <div class="setting-item" style="justify-content: center; gap: 16px;">
                <el-button @click="handleExport" size="small"><el-icon><Download /></el-icon> 导出配置</el-button>
                <el-button @click="handleImport" size="small"><el-icon><Upload /></el-icon> 导入配置</el-button>
             </div>
              <!-- Export/Import Textarease -->
              <div v-if="showExportBox" style="padding: 0 16px 16px;">
                 <el-input v-model="exportData" type="textarea" :rows="5" readonly />
              </div>
              <div v-if="showImportBox" style="padding: 0 16px 16px;">
                 <el-input v-model="importData" type="textarea" :rows="5" placeholder="粘贴配置JSON" />
                 <div style="text-align: right; margin-top: 8px;"><el-button type="primary" size="small" @click="saveImport">保存</el-button></div>
              </div>

           </div>
        </el-collapse-item>
      </el-collapse>

    </div>
  </div>


  <!-- 自定义快捷键对话框 -->
  <CustomHotkeyInput
    v-model="showCustomHotkeyDialog"
    :current-value="config.customFloatingBallHotkey"
    @confirm="handleCustomHotkeyConfirm"
    @cancel="handleCustomHotkeyCancel"
  />

  <!-- 自定义鼠标悬浮快捷键对话框 -->
  <CustomHotkeyInput
    v-model="showCustomMouseHotkeyDialog"
    :current-value="config.customHotkey"
    @confirm="handleCustomMouseHotkeyConfirm"
    @cancel="handleCustomMouseHotkeyCancel"
  />



</template>

<script lang="ts" setup>

// Main 处理配置信息
import { computed, ref, watch, onUnmounted } from 'vue'
import { models, options, servicesType, services, defaultOption } from "../entrypoints/utils/option";
import { Config } from "@/entrypoints/utils/model";
import { storage } from '@wxt-dev/storage';
import { ChatDotRound, Refresh, Edit, Upload, Download } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElInputNumber } from 'element-plus'
import browser from 'webextension-polyfill';
import { defineAsyncComponent } from 'vue';
const CustomHotkeyInput = defineAsyncComponent(() => import('@/components/CustomHotkeyInput.vue'));
import { parseHotkey } from '@/entrypoints/utils/hotkey';
import { modelService } from '@/entrypoints/utils/modelService';

// 初始化深色模式媒体查询
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// 更新主题函数
function updateTheme(theme: string) {
  if (theme === 'auto') {
    // 自动模式下，直接使用系统主题
    const isDark = darkModeMediaQuery.matches;
    console.log('isDark', isDark);

    document.documentElement.classList.toggle('dark', isDark);
  } else {
    // 手动模式下，使用选择的主题
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

// 配置信息
let config = ref(new Config());

// 动态模型相关
const isLoadingModels = ref(false);
const modelError = ref('');
const dynamicModels = ref<string[]>([]);
const hasDynamicProvider = computed(() => modelService.hasProvider(config.value.service));

// 从 storage 中获取本地配置
storage.getItem('local:config').then((value: any) => {
  if (typeof value === 'string' && value) {
    const parsedConfig = JSON.parse(value);
    Object.assign(config.value, parsedConfig);
  }
  // 初始应用主题
  updateTheme(config.value.theme || 'auto');
});

// 监听 storage 中 'local:config' 的变化
// 当其他页面修改了配置时,会触发这个监听器
// newValue 是新的配置值,oldValue 是旧的配置值
storage.watch('local:config', (newValue: any, oldValue: any) => {
  // 检查 newValue 是否为非空字符串
  if (typeof newValue === 'string' && newValue) {
    // 将新的配置值解析为对象,并合并到当前的 config.value 中
    // 这样可以保持所有页面的配置同步
    Object.assign(config.value, JSON.parse(newValue));
  }
});

// 动态模型获取相关方法
async function loadDynamicModels() {
  // 重置错误和加载状态
  modelError.value = '';
  
  // 仅对支持动态获取的服务并且有Token时尝试拉取
  if (hasDynamicProvider.value && config.value.token[config.value.service]) {
    try {
      isLoadingModels.value = true;
      const list = await modelService.getDynamicModels(
        config.value.service,
        config.value.token[config.value.service]
      );

      dynamicModels.value = list;
      
      // 如果当前选择的模型不在新列表中，选择第一个
      if (!dynamicModels.value.includes(config.value.model[config.value.service]) && dynamicModels.value.length > 0) {
        config.value.model[config.value.service] = dynamicModels.value[0];
      }
    } catch (error) {
      console.warn('Failed to fetch dynamic models, using local preset:', error);
      modelError.value = '获取模型列表失败，使用本地预设';
      dynamicModels.value = []; // 清空动态模型，使用本地预设
    } finally {
      isLoadingModels.value = false;
    }
  } else {
    // 非硅基流动服务或没有API密钥，清空动态模型（使用本地预设）
    dynamicModels.value = [];
  }
}

async function refreshModels() {
  if (!hasDynamicProvider.value || !config.value.token[config.value.service]) {
    return;
  }
  
  try {
    isLoadingModels.value = true;
    modelError.value = '';
    
    const list = await modelService.refreshModels(
      config.value.service,
      config.value.token[config.value.service]
    );
    dynamicModels.value = list;
  } catch (error) {
    modelError.value = '刷新失败，请检查API密钥和网络连接';
    console.error('Failed to refresh models:', error);
  } finally {
    isLoadingModels.value = false;
  }
}

// 监听服务变化和API密钥变化
watch(() => [config.value.service, config.value.token[config.value.service]], () => {
  loadDynamicModels();
}, { immediate: true });

// 组件挂载时加载模型
storage.getItem('local:config').then((value: any) => {
  if (typeof value === 'string' && value) {
    const parsedConfig = JSON.parse(value);
    Object.assign(config.value, parsedConfig);
  }
  // 初始应用主题
  updateTheme(config.value.theme || 'auto');
  // 加载动态模型
  loadDynamicModels();
});

// 监听菜单栏配置变化
// 当配置发生改变时,将新的配置序列化为 JSON 字符串并保存到 storage 中
// deep: true 表示深度监听对象内部属性的变化
watch(config, (newValue: any, oldValue: any) => {
  // TODO 监听配置变化，显示刷新提示
  storage.setItem('local:config', JSON.stringify(newValue));
}, { deep: true });

// 计算属性
let compute = ref({
  // 1、是否是AI服务
  showAI: computed(() => servicesType.isAI(config.value.service)),
  // 2、是否需要token
  showToken: computed(() => servicesType.isUseToken(config.value.service)),
  // 3、是否需要model
  showModel: computed(() => servicesType.isUseModel(config.value.service)),
  // 4、是否需要自定义模型
  showCustomModel: computed(() => config.value.service === services.custom || config.value.service === services.doubao),
  // 5、是否需要自定义URL
  showCustom: computed(() => servicesType.isUseCustomUrl(config.value.service)),
  // 6、是否需要代理
  showProxy: computed(() => servicesType.isUseProxy(config.value.service)),
  // 7、是否是Azure OpenAI
  showAzureOpenaiEndpoint: computed(() => servicesType.isAzureOpenai(config.value.service)),
  // 8、是否是DeepLX
  showDeepLX: computed(() => config.value.service === services.deeplx),
  // 9、是否是有道
  showYoudao: computed(() => servicesType.isYoudao(config.value.service)),
  // 10、是否是腾讯云
  showTencent: computed(() => servicesType.isTencent(config.value.service)),
  // 11、是否是Coze
  showRobotId: computed(() => servicesType.isCoze(config.value.service)),
  // 12、是否是NewAPI
  showNewAPI: computed(() => servicesType.isNewApi(config.value.service)),
  // 13、是否是AkSk
  showAkSk: computed(() => servicesType.isUseAkSk(config.value.service)),
  // 14、过滤后的服务列表
  filteredServices: computed(() => options.services),
  // 15、模型列表 - 优先使用动态模型，否则使用本地预设
  model: computed(() => {
    // 如果当前服务支持动态模型且有API密钥，使用动态模型
    if (hasDynamicProvider.value && config.value.token[config.value.service] && dynamicModels.value.length > 0) {
      return dynamicModels.value;
    }
    // 其他服务使用本地预设模型列表
    return models.get(config.value.service) || ["自定义模型"];
  }),
  // 刷新按钮可见性
  showRefreshButton: computed(() => hasDynamicProvider.value && config.value.token[config.value.service])
});

// 监听主题变化
watch(() => config.value.theme, (newTheme) => {
  updateTheme(newTheme || 'auto');
});

// 使用 onchange 监听系统主题变化
darkModeMediaQuery.onchange = (e) => {
  if (config.value.theme === 'auto') {
    updateTheme('auto');
  }
};

// 组件卸载时清理
onUnmounted(() => {
  darkModeMediaQuery.onchange = null;
});

// 计算样式分组
const styleGroups = computed(() => {
  const groups = options.styles.filter(item => item.disabled);
  return groups.map(group => ({
    ...group,
    options: options.styles.filter(item => !item.disabled && item.group === group.value)
  }));
});

// 恢复默认模板
const resetTemplate = () => {
  ElMessageBox.confirm(
    '确定要恢复默认的 system 和 user 模板吗？此操作将覆盖当前的自定义模板。',
    '恢复默认模板',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    config.value.system_role[config.value.service] = defaultOption.system_role;
    config.value.user_role[config.value.service] = defaultOption.user_role;
    ElMessage({
      message: '已成功恢复默认翻译模板',
      type: 'success',
      duration: 2000
    });
  }).catch(() => {
    // 用户取消操作，不做任何处理
  });
};

// 悬浮球开关的计算属性
const floatingBallEnabled = computed({
  get: () => !config.value.disableFloatingBall && config.value.on,
  set: (value) => {
    config.value.disableFloatingBall = !value;
    // 向所有激活的标签页发送消息
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, { 
            type: 'toggleFloatingBall',
            isEnabled: value 
          }).catch(() => {
            // 忽略发送失败的错误（可能是页面未加载内容脚本）
          });
        }
      });
    });
  }
});

// 监听划词翻译模式变化
watch(() => config.value.selectionTranslatorMode, (newMode) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { 
          type: 'updateSelectionTranslatorMode',
          mode: newMode 
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
});

// 监听开关变化
const handleSwitchChange = () => {
  showRefreshTip.value = true;
};

// 处理插件状态变化
const handlePluginStateChange = (val: boolean) => {
  // 如果插件被关闭，确保悬浮球和划词翻译也被关闭
  if (!val) {
    // 处理悬浮球
    if (!config.value.disableFloatingBall) {
      config.value.disableFloatingBall = true;
      // 向所有激活的标签页发送消息，关闭悬浮球
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { 
              type: 'toggleFloatingBall',
              isEnabled: false
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
    
    // 处理划词翻译
    if (config.value.selectionTranslatorMode !== 'disabled') {
      config.value.selectionTranslatorMode = 'disabled';
      // 向所有激活的标签页发送消息，关闭划词翻译
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { 
              type: 'updateSelectionTranslatorMode',
              mode: 'disabled'
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
  }
};

// 处理悬浮球开关变化
const toggleFloatingBall = (val: boolean) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { 
          type: 'toggleFloatingBall',
          isEnabled: val 
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
};

// 自定义快捷键相关
const showCustomHotkeyDialog = ref(false);
const showCustomMouseHotkeyDialog = ref(false);

// 配置导入导出相关
const showExportConfig = ref(false);
const showImportConfig = ref(false);
const exportedConfig = ref('');
const importConfigText = ref('');
const importLoading = ref(false);

// 处理快捷键选择变化
const handleHotkeyChange = (value: string) => {
  if (value === 'custom') {
    // 选择自定义后，如果没有设置过自定义快捷键，自动打开设置对话框
    if (!config.value.customFloatingBallHotkey) {
      // 延迟一下，让选择框先完成状态更新
      setTimeout(() => {
        openCustomHotkeyDialog();
      }, 100);
    }
  }
};

// 打开自定义快捷键对话框
const openCustomHotkeyDialog = () => {
  showCustomHotkeyDialog.value = true;
};

// 确认自定义快捷键
const handleCustomHotkeyConfirm = (hotkey: string) => {
  config.value.customFloatingBallHotkey = hotkey;
  config.value.floatingBallHotkey = 'custom';
  
  ElMessage({
    message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomHotkeyDisplayName()}`,
    type: 'success',
    duration: 2000
  });
};

// 取消自定义快捷键
const handleCustomHotkeyCancel = () => {
  // 如果没有自定义快捷键，回退到默认选项
  if (!config.value.customFloatingBallHotkey) {
    config.value.floatingBallHotkey = 'Alt+T';
  }
};

// 获取自定义快捷键显示名称
const getCustomHotkeyDisplayName = () => {
  if (!config.value.customFloatingBallHotkey) return '';
  
  if (config.value.customFloatingBallHotkey === 'none') {
    return '已禁用';
  }
  
  const parsed = parseHotkey(config.value.customFloatingBallHotkey);
  return parsed.isValid ? parsed.displayName : config.value.customFloatingBallHotkey;
};

// 处理鼠标悬浮快捷键选择变化
const handleMouseHotkeyChange = (value: string) => {
  if (value === 'custom') {
    // 选择自定义后，如果没有设置过自定义快捷键，自动打开设置对话框
    if (!config.value.customHotkey) {
      // 延迟一下，让选择框先完成状态更新
      setTimeout(() => {
        openCustomMouseHotkeyDialog();
      }, 100);
    }
  }
};

// 打开自定义鼠标悬浮快捷键对话框
const openCustomMouseHotkeyDialog = () => {
  showCustomMouseHotkeyDialog.value = true;
};

// 确认自定义鼠标悬浮快捷键
const handleCustomMouseHotkeyConfirm = (hotkey: string) => {
  config.value.customHotkey = hotkey;
  config.value.hotkey = 'custom';
  
  ElMessage({
    message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomMouseHotkeyDisplayName()}`,
    type: 'success',
    duration: 2000
  });
};

// 取消自定义鼠标悬浮快捷键
const handleCustomMouseHotkeyCancel = () => {
  // 如果没有自定义快捷键，回退到默认选项
  if (!config.value.customHotkey) {
    config.value.hotkey = 'Control';
  }
};

// 获取自定义鼠标悬浮快捷键显示名称
const getCustomMouseHotkeyDisplayName = () => {
  if (!config.value.customHotkey) return '';
  
  if (config.value.customHotkey === 'none') {
    return '已禁用';
  }
  
  const parsed = parseHotkey(config.value.customHotkey);
  return parsed.isValid ? parsed.displayName : config.value.customHotkey;
};

// 处理并发数量变化
const handleConcurrentChange = (currentValue: number | undefined, oldValue: number | undefined) => {
  // 验证并发数量的有效性
  if (currentValue === undefined || currentValue < 1 || currentValue > 100) {
    ElMessage({
      message: '并发数量必须在 1-100 之间',
      type: 'warning',
      duration: 2000
    });
    // 恢复默认值
    config.value.maxConcurrentTranslations = 6;
    return;
  }
  
  // 显示设置已更新的提示
  showRefreshTip.value = true;
  
  ElMessage({
    message: `并发数量已更新为 ${currentValue}`,
    type: 'success',
    duration: 2000
  });
};

// 显示刷新提示
const showRefreshTip = ref(false);

// 刷新页面
const refreshPage = async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    browser.tabs.reload(tabs[0].id);
    showRefreshTip.value = false; // 刷新后隐藏提示
  }
};

const showExportBox = ref(false);
const exportData = ref('');
const showImportBox = ref(false);
const importData = ref('');

// Azure OpenAI 端点地址验证函数
const isValidAzureEndpoint = (endpoint: string) => {
  if (!endpoint || endpoint.trim() === '') {
    return false;
  }

  // 检查是否包含必要的组件
  const hasAzureDomain = endpoint.includes('openai.azure.com');
  const hasChatCompletions = endpoint.includes('/chat/completions');
  const hasHttps = endpoint.startsWith('https://');

  return hasHttps && hasAzureDomain && hasChatCompletions;
};

const handleExport = async () => {
  const configStr = await storage.getItem('local:config');
  if (!configStr) {
    ElMessage({
      message: '没有找到配置信息',
      type: 'warning',
    });
    return;
  }

  const configToExport = JSON.parse(configStr as string);

  // Create a deep copy to avoid modifying the actual config
  const cleanedConfig = JSON.parse(JSON.stringify(configToExport));

  // Clean system_role and user_role if they are default
  if (cleanedConfig.system_role) {
    for (const service in cleanedConfig.system_role) {
      if (cleanedConfig.system_role[service] === defaultOption.system_role) {
        delete cleanedConfig.system_role[service];
      }
    }
    if (Object.keys(cleanedConfig.system_role).length === 0) {
      delete cleanedConfig.system_role;
    }
  }

  if (cleanedConfig.user_role) {
    for (const service in cleanedConfig.user_role) {
      if (cleanedConfig.user_role[service] === defaultOption.user_role) {
        delete cleanedConfig.user_role[service];
      }
    }
    if (Object.keys(cleanedConfig.user_role).length === 0) {
      delete cleanedConfig.user_role;
    }
  }

  exportData.value = JSON.stringify(cleanedConfig, null, 2);
  showExportBox.value = !showExportBox.value;
  showImportBox.value = false;
};

const handleImport = () => {
  showImportBox.value = !showImportBox.value;
  showExportBox.value = false;
};

const saveImport = async () => {
  try {
    const parsedConfig = JSON.parse(importData.value);
    // Add validation here
    if (!validateConfig(parsedConfig)) {
      ElMessage({
        message: '配置无效或格式不正确, 请检查!',
        type: 'error',
      });
      return;
    }
    await storage.setItem('local:config', JSON.stringify(parsedConfig));
    ElMessage({
      message: '配置导入成功!',
      type: 'success',
    });
    showImportBox.value = false;
    importData.value = '';
    // Optionally, reload the extension or relevant parts
  } catch (e) {
    ElMessage({
      message: '配置格式错误, 请检查!',
      type: 'error',
    });
  }
};


// 切换导出配置显示
const toggleExportConfig = async () => {
  if (showExportConfig.value) {
    // 如果已经显示，则隐藏
    showExportConfig.value = false;
    exportedConfig.value = '';
  } else {
    // 如果未显示，则显示并生成配置
    try {
      // 确保从storage获取最新的配置
      const latestConfig = await storage.getItem('local:config');
      let configToExport;

      if (latestConfig && typeof latestConfig === 'string') {
        // 使用storage中的最新配置
        configToExport = JSON.parse(latestConfig);
      } else {
        // 如果storage中没有，使用当前config.value
        configToExport = JSON.parse(JSON.stringify(config.value));
      }

      exportedConfig.value = JSON.stringify(configToExport, null, 2);
      showExportConfig.value = true;

      ElMessage({
        message: '配置已生成，请复制保存',
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      ElMessage({
         message: '导出配置失败：' + ((error as Error)?.message || '未知错误'),
         type: 'error',
         duration: 3000
       });
    }
  }
};

// 复制导出的配置到剪贴板
const copyExportedConfig = async () => {
  try {
    await navigator.clipboard.writeText(exportedConfig.value);
    ElMessage({
      message: '配置已复制到剪贴板',
      type: 'success',
      duration: 2000
    });
  } catch (error) {
    ElMessage({
      message: '复制失败，请手动复制',
      type: 'warning',
      duration: 2000
    });
  }
};

// 切换导入配置显示
const toggleImportConfig = () => {
  if (showImportConfig.value) {
    // 如果已经显示，则隐藏并清空内容
    showImportConfig.value = false;
    importConfigText.value = '';
  } else {
    // 如果未显示，则显示
    showImportConfig.value = true;
    importConfigText.value = '';
  }
};

// 取消导入
const cancelImport = () => {
  // 清空输入框并隐藏导入区域
  importConfigText.value = '';
  showImportConfig.value = false;
  importLoading.value = false;
};

// 导入配置
const importConfig = async () => {
  if (!importConfigText.value.trim()) {
    ElMessage({
      message: '请输入配置内容',
      type: 'warning',
      duration: 2000
    });
    return;
  }

  importLoading.value = true;

  try {
    // 解析JSON配置
    const importedConfig = JSON.parse(importConfigText.value);

    // 验证配置格式
    if (!validateConfig(importedConfig)) {
      throw new Error('配置格式不正确');
    }

    // 确认导入
    await ElMessageBox.confirm(
      '导入配置将覆盖当前所有设置，确定要继续吗？',
      '确认导入',
      {
        confirmButtonText: '确定导入',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // 应用新配置
    Object.assign(config.value, importedConfig);

    // 保存到storage
    await storage.setItem('local:config', JSON.stringify(config.value));

    // 隐藏导入区域并清空输入
    showImportConfig.value = false;
    importConfigText.value = '';

    ElMessage({
      message: '配置导入成功',
      type: 'success',
      duration: 2000
    });

  } catch (error) {
    if ((error as Error).message !== 'cancel') {
      ElMessage({
        message: '导入失败：' + ((error as Error).message || '配置格式错误'),
        type: 'error',
        duration: 3000
      });
    }
  } finally {
    importLoading.value = false;
  }
};

// 验证配置格式
const validateConfig = (configData: any): boolean => {
  try {
    // 检查是否是对象
    if (typeof configData !== 'object' || configData === null) {
      return false;
    }

    // 检查必要的配置字段
    const requiredFields = ['on', 'service', 'display', 'from', 'to'];
    for (const field of requiredFields) {
      if (!(field in configData)) {
        return false;
      }
    }

    // 检查服务配置
    if (typeof configData.service !== 'string') {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

</script>

<style scoped>
/* 设置滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

/* 保持 select 和 input 宽度自适应 (如果未被内联样式覆盖) */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-input) {
  width: 100%;
}

/* 下拉菜单分割线样式 */
.select-divider {
  background: #f2f6fc;
  color: #909399;
  font-size: 12px;
  padding: 4px 12px;
  cursor: default;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-bottom: 1px solid #ebeef5;
  margin: 4px 0;
  pointer-events: none;
  opacity: 0.9;
}

/* 自定义快捷键相关样式 */
.hotkey-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.custom-hotkey-display {
  display: flex;
  align-items: center;
  padding: 6px 6px 6px 10px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 4px;
  font-size: 12px;
  height: 32px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.hotkey-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 600;
  color: var(--el-color-primary);
  font-size: 13px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: calc(100% - 32px);
}

.placeholder-text {
  color: var(--el-text-color-placeholder) !important;
  font-style: italic;
  font-family: inherit !important;
  font-weight: normal !important;
}

.edit-button {
  padding: 2px 4px;
  margin-left: 4px;
  color: var(--el-color-primary);
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-button:hover {
  background: var(--el-color-primary-light-8);
  border-radius: 4px;
}

.edit-button .el-icon {
  font-size: 12px;
}

/* 自定义标识徽章 */
.custom-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: var(--el-color-primary);
  color: white;
  font-size: 10px;
  border-radius: 10px;
  font-weight: 500;
  margin-left: 6px;
  line-height: 1;
}

/* 错误样式 */
.input-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset !important;
}

.input-error:focus-within :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset, 0 0 0 2px rgba(245, 108, 108, 0.2) !important;
}

.error-text {
  color: #e74c3c;
  font-size: 12px;
  margin-top: 4px;
}

.model-selector-container {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>


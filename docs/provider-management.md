# Provider 管理系统说明

## 功能概述

用户可以添加、编辑、删除多个 AI Provider 配置，每个 Provider 有独立的名称和配置参数。Provider 以按钮形式排列在输入框下方，用户可以快速切换使用不同的 Provider 发起 AI 调用。

## 核心特性

### 1. Provider 管理
- ✅ 添加多个 Provider
- ✅ 为每个 Provider 命名
- ✅ 编辑 Provider 配置
- ✅ 删除 Provider
- ✅ 选择当前使用的 Provider

### 2. 配置项
每个 Provider 包含以下配置：
- **名称**: 自定义显示名称（必填）
- **类型**: Gemini 或 OpenAI
- **API Endpoint**: API 端点地址
- **API Key**: API 密钥
- **Model**: 模型名称
- **联网搜索**: 是否启用（仅 Gemini）

### 3. 数据持久化
- 所有 Provider 配置保存在 localStorage
- 当前选中的 Provider 也会保存
- 刷新页面后自动恢复

## UI 设计

### 1. Provider 选择器（固定位置）

```
┌─────────────────────────────────────────┐
│  输入框                                  │
└─────────────────────────────────────────┘
  ┌────┐ ┌────┐ ┌────┐ ┌──┐
  │ P1 │ │ P2 │ │ P3 │ │ + │  ← Provider 按钮
  └────┘ └────┘ └────┘ └──┘
```

**特点**:
- 固定在输入框下方
- 不会改变输入框位置
- 横向滚动显示所有 Provider
- 选中状态：蓝色背景 + 白色文字
- 未选中状态：白色背景 + 边框

### 2. 交互方式

#### 添加 Provider
- 点击 `+` 按钮
- 打开模态框
- 填写配置
- 点击保存

#### 选择 Provider
- 单击 Provider 按钮
- 立即切换为当前使用的 Provider
- 按钮变为选中状态

#### 编辑 Provider
- 双击 Provider 按钮
- 打开模态框（预填充当前配置）
- 修改配置
- 点击保存

#### 删除 Provider
- 双击 Provider 打开编辑模态框
- 点击"删除"按钮
- Provider 被移除

### 3. 模态框设计

```
┌─────────────────────────────────────┐
│ 新建 Provider              [×]      │
├─────────────────────────────────────┤
│ 名称 *                              │
│ [My OpenAI                       ]  │
│                                     │
│ 类型                                │
│ [Gemini] [OpenAI]                   │
│                                     │
│ API Endpoint                        │
│ [https://api.openai.com/v1       ]  │
│                                     │
│ API Key                             │
│ [••••••••••••••••••••••••••••••]   │
│                                     │
│ Model                               │
│ [gpt-4o-mini                     ]  │
│                                     │
│ 🌐 联网搜索              [开关]     │
├─────────────────────────────────────┤
│ [删除]              [取消] [保存]   │
└─────────────────────────────────────┘
```

**特点**:
- 居中显示
- 背景半透明黑色 + 模糊效果
- 点击外部关闭
- 动画效果：缩放 + 淡入淡出

## 数据结构

### Provider 对象
```typescript
interface AIProvider {
  id: string              // 唯一标识（时间戳）
  name: string            // 显示名称
  type: 'gemini' | 'openai'  // Provider 类型
  endpoint: string        // API 端点
  apiKey: string          // API 密钥
  model: string           // 模型名称
  enableSearch: boolean   // 联网搜索（仅 Gemini）
}
```

### localStorage 存储

#### Providers 列表
```javascript
// Key
'alice-providers'

// Value (JSON Array)
[
  {
    "id": "1699999999999",
    "name": "My OpenAI",
    "type": "openai",
    "endpoint": "https://api.openai.com/v1",
    "apiKey": "sk-proj-xxxxx",
    "model": "gpt-4o-mini",
    "enableSearch": false
  },
  {
    "id": "1700000000000",
    "name": "Gemini Pro",
    "type": "gemini",
    "endpoint": "",
    "apiKey": "",
    "model": "gemini-2.5-pro",
    "enableSearch": true
  }
]
```

#### 选中的 Provider
```javascript
// Key
'alice-selected-provider'

// Value (String)
"1699999999999"  // Provider ID
```

## 使用流程

### 场景 1: 首次使用（无配置）

1. 用户打开应用
2. 输入框下方没有 Provider 按钮，只有 `+` 按钮
3. 点击 `+` 添加第一个 Provider
4. 填写配置并保存
5. Provider 按钮出现，自动选中
6. 可以开始对话（使用该 Provider）

### 场景 2: 添加多个 Provider

1. 点击 `+` 按钮
2. 填写 Provider 配置：
   - 名称: "OpenAI GPT-4"
   - 类型: OpenAI
   - Endpoint: https://api.openai.com/v1
   - API Key: sk-proj-xxxxx
   - Model: gpt-4o
3. 保存后，新 Provider 出现在列表中
4. 重复步骤添加更多 Provider

### 场景 3: 切换 Provider

1. 查看输入框下方的 Provider 按钮列表
2. 点击想要使用的 Provider
3. 按钮变为选中状态（蓝色背景）
4. 后续对话使用该 Provider

### 场景 4: 编辑 Provider

1. 双击要编辑的 Provider 按钮
2. 模态框打开，显示当前配置
3. 修改配置（如更换 API Key）
4. 点击保存
5. 配置更新，模态框关闭

### 场景 5: 删除 Provider

1. 双击要删除的 Provider
2. 模态框打开
3. 点击"删除"按钮
4. Provider 从列表中移除
5. 如果删除的是当前选中的 Provider，自动取消选中

### 场景 6: 无配置时的行为

- 如果用户没有配置任何 Provider
- API 调用时 `aiConfig` 为 `undefined`
- 后端使用服务器环境变量配置
- 这是默认的回退行为

## 配置优先级

```
选中的 Provider 配置 > 服务器环境变量 > 代码默认值
```

### 示例

#### 情况 1: 用户选中了 Provider
```typescript
// 前端发送
aiConfig: {
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1',
  apiKey: 'sk-user-key',
  model: 'gpt-4o',
  enableSearch: false
}

// 后端使用用户配置
```

#### 情况 2: 用户未选中 Provider
```typescript
// 前端发送
aiConfig: undefined

// 后端使用服务器环境变量
USE_OPENAI=true
API_KEY=sk-server-key
MODEL=gpt-4o-mini
```

## 技术实现

### 状态管理
```typescript
// Provider 列表
const [providers, setProviders] = useState<AIProvider[]>([])

// 选中的 Provider ID
const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)

// 模态框显示状态
const [showProviderModal, setShowProviderModal] = useState(false)

// 正在编辑的 Provider
const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)
```

### 核心函数

#### 添加 Provider
```typescript
const handleAddProvider = () => {
  setEditingProvider({
    id: Date.now().toString(),
    name: '',
    type: 'openai',
    endpoint: '',
    apiKey: '',
    model: '',
    enableSearch: false,
  })
  setShowProviderModal(true)
}
```

#### 保存 Provider
```typescript
const handleSaveProvider = () => {
  if (!editingProvider || !editingProvider.name.trim()) return

  const existingIndex = providers.findIndex((p) => p.id === editingProvider.id)
  if (existingIndex >= 0) {
    // 更新现有 Provider
    const newProviders = [...providers]
    newProviders[existingIndex] = editingProvider
    setProviders(newProviders)
  } else {
    // 添加新 Provider
    setProviders([...providers, editingProvider])
    setSelectedProviderId(editingProvider.id)  // 自动选中
  }
  setShowProviderModal(false)
}
```

#### 删除 Provider
```typescript
const handleDeleteProvider = (id: string) => {
  setProviders(providers.filter((p) => p.id !== id))
  if (selectedProviderId === id) {
    setSelectedProviderId(null)  // 取消选中
  }
}
```

### API 调用
```typescript
// 获取选中的 Provider 配置
const selectedProvider = selectedProviderId 
  ? providers.find((p) => p.id === selectedProviderId) 
  : null

// 发送请求
await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    input: message,
    history: history,
    aiConfig: selectedProvider ? {
      provider: selectedProvider.type,
      endpoint: selectedProvider.endpoint,
      apiKey: selectedProvider.apiKey,
      model: selectedProvider.model,
      enableSearch: selectedProvider.enableSearch,
    } : undefined
  })
})
```

## UI 样式规范

### Provider 按钮
```css
/* 未选中 */
bg-white dark:bg-gray-800
text-gray-700 dark:text-gray-300
border border-gray-200 dark:border-gray-700
hover:border-blue-300

/* 选中 */
bg-blue-500
text-white
shadow-sm
```

### 添加按钮
```css
border border-dashed border-gray-300
hover:border-blue-400
hover:text-blue-600
```

### 模态框
```css
/* 背景 */
bg-black/50 backdrop-blur-sm

/* 内容 */
bg-white dark:bg-gray-800
rounded-2xl
shadow-2xl
max-w-md
```

## 最佳实践

### 1. Provider 命名
- ✅ 使用描述性名称: "OpenAI GPT-4", "Gemini Pro"
- ✅ 包含关键信息: "Azure OpenAI", "Local LLaMA"
- ❌ 避免模糊名称: "Provider 1", "Test"

### 2. 配置管理
- ✅ 为不同用途创建不同 Provider
- ✅ 测试 Provider: "OpenAI Test"
- ✅ 生产 Provider: "OpenAI Production"

### 3. 安全建议
- ⚠️ API Key 存储在 localStorage
- ✅ 仅在个人设备使用
- ✅ 定期更换 API Key
- ✅ 使用受限权限的 Key

### 4. 性能优化
- ✅ Provider 列表横向滚动
- ✅ 模态框按需渲染
- ✅ 配置自动保存

## 常见问题

### Q: 如何快速切换 Provider？
A: 直接点击输入框下方的 Provider 按钮即可立即切换。

### Q: 可以添加多少个 Provider？
A: 理论上无限制，但建议不超过 10 个以保持界面整洁。

### Q: 删除 Provider 后能恢复吗？
A: 不能，删除是永久性的。建议重要配置做好备份。

### Q: Provider 配置会同步到其他设备吗？
A: 不会，配置仅保存在当前浏览器的 localStorage 中。

### Q: 如果没有配置 Provider 会怎样？
A: 系统会使用服务器环境变量中的默认配置。

### Q: 可以导出/导入 Provider 配置吗？
A: 当前版本不支持，这是计划中的未来功能。

## 未来扩展

### 计划功能
- [ ] Provider 配置导入/导出
- [ ] Provider 分组管理
- [ ] Provider 使用统计
- [ ] 快捷键切换 Provider
- [ ] Provider 配置模板
- [ ] 批量编辑 Provider
- [ ] Provider 配置加密

### 可能的改进
- [ ] 拖拽排序 Provider
- [ ] Provider 图标自定义
- [ ] Provider 颜色标记
- [ ] Provider 使用历史
- [ ] Provider 性能监控


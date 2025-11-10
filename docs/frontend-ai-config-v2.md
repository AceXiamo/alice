# 前端 AI 配置功能说明 v2

## 功能概述

用户可以在前端界面直接配置 AI 的 Endpoint、API Key 和 Model，支持 Gemini 和 OpenAI 两种格式。配置保存在浏览器 localStorage 中，下次访问自动恢复。

## 配置项说明

### 1. Provider（提供商）
- **Gemini**: Google Gemini API
- **OpenAI**: OpenAI 兼容 API（支持 OpenAI、Azure OpenAI、本地 LLM 等）

### 2. API Endpoint
- **用途**: 自定义 API 端点地址
- **Gemini**: 留空使用默认（Vertex AI）
- **OpenAI**: 
  - 默认: `https://api.openai.com/v1`
  - Azure OpenAI: `https://your-resource.openai.azure.com/openai/deployments/your-deployment`
  - 本地 LLM: `http://localhost:11434/v1` (Ollama)
- **留空**: 使用服务器配置

### 3. API Key
- **用途**: API 访问密钥
- **安全性**: 输入框类型为 `password`，不会明文显示
- **存储**: 保存在浏览器 localStorage（仅本地）
- **留空**: 使用服务器配置

### 4. Model
- **用途**: 指定使用的模型
- **Gemini 示例**:
  - `gemini-2.5-flash` (默认，快速)
  - `gemini-2.5-pro` (高级)
  - `gemini-1.5-flash`
- **OpenAI 示例**:
  - `gpt-4o-mini` (默认，推荐)
  - `gpt-4o`
  - `gpt-4-turbo`
  - `gpt-3.5-turbo`
- **留空**: 使用服务器配置

### 5. 联网搜索（仅 Gemini）
- **功能**: 启用 Google Search grounding
- **用途**: 获取实时信息、最新数据
- **限制**: 仅 Gemini 支持
- **快捷开关**: 输入框内 🌐 图标

## UI 设计

### 设置面板布局

```
┌─────────────────────────────────────────┐
│ Provider          [Gemini] [OpenAI]     │
├─────────────────────────────────────────┤
│ API Endpoint                            │
│ [https://api.openai.com/v1           ] │
├─────────────────────────────────────────┤
│ API Key                                 │
│ [••••••••••••••••••••••••••••••••••••] │
├─────────────────────────────────────────┤
│ Model                                   │
│ [gpt-4o-mini                          ] │
├─────────────────────────────────────────┤
│ 🌐 联网搜索              [开关]         │
├─────────────────────────────────────────┤
│ 留空的配置项将使用服务器默认值。        │
│ 配置保存在浏览器本地。                  │
└─────────────────────────────────────────┘
```

### 交互方式

1. **展开/收起**
   - 点击输入框下方的设置按钮 ⚙️
   - 动画: 淡入淡出 + 高度过渡

2. **Provider 切换**
   - 两个按钮: Gemini / OpenAI
   - 选中状态: 蓝色背景 + 白色文字
   - 切换时自动更新 placeholder

3. **输入框**
   - 圆角设计: `rounded-lg`
   - 聚焦效果: 蓝色边框
   - 暗色模式适配

4. **联网搜索**
   - Toggle 开关样式
   - 仅 Gemini 时显示
   - 快捷按钮: 输入框内 🌐 图标

## 数据流

### 前端 → 后端

```typescript
// 请求体
{
  input: string,
  history: Array<{ role, content }>,
  sessionId: string,
  aiConfig: {
    provider: 'gemini' | 'openai',
    endpoint: string,      // 可选
    apiKey: string,        // 可选
    model: string,         // 可选
    enableSearch: boolean  // 仅 Gemini
  }
}
```

### 后端处理逻辑

```typescript
// 1. 合并配置（客户端优先）
const provider = aiConfig?.provider || serverDefault
const endpoint = aiConfig?.endpoint || serverDefault
const apiKey = aiConfig?.apiKey || serverDefault
const model = aiConfig?.model || serverDefault

// 2. 创建 AI 客户端
if (provider === 'openai') {
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: endpoint
  })
  // 使用 client 和 model 生成响应
}

// 3. Gemini 使用 model 参数
if (provider === 'gemini') {
  await genai.models.generateContent({
    model: model,
    contents: contents,
    config: { tools: enableSearch ? [groundingTool] : [] }
  })
}
```

## 配置优先级

```
客户端配置 > 服务器环境变量 > 默认值
```

### 示例场景

#### 场景 1: 完全使用服务器配置
```typescript
// 前端不传 aiConfig 或传空对象
aiConfig: {}

// 后端使用环境变量
USE_OPENAI=true
API_KEY=sk-xxx
MODEL=gpt-4o-mini
```

#### 场景 2: 客户端覆盖部分配置
```typescript
// 前端传部分配置
aiConfig: {
  provider: 'openai',
  model: 'gpt-4o',  // 覆盖
  // endpoint 和 apiKey 留空，使用服务器配置
}
```

#### 场景 3: 客户端完全自定义
```typescript
// 前端传完整配置
aiConfig: {
  provider: 'openai',
  endpoint: 'https://my-custom-api.com/v1',
  apiKey: 'my-custom-key',
  model: 'my-custom-model'
}
```

## 存储格式

### localStorage Key
```javascript
'alice-ai-config'
```

### 存储内容
```json
{
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1",
  "apiKey": "sk-proj-xxxxx",
  "model": "gpt-4o-mini",
  "enableSearch": false
}
```

## 安全考虑

### 1. API Key 存储
- ⚠️ **警告**: API Key 存储在浏览器 localStorage 中
- 🔒 **风险**: 可被 JavaScript 访问
- ✅ **建议**: 
  - 仅在个人设备使用
  - 定期更换 API Key
  - 使用受限权限的 API Key

### 2. 数据传输
- 所有配置通过 HTTPS 传输
- API Key 在传输过程中加密

### 3. 服务器端验证
- 服务器不存储客户端 API Key
- 每次请求独立验证
- 失败时返回明确错误信息

## 使用示例

### 示例 1: 使用 OpenAI 官方 API

```
Provider: OpenAI
API Endpoint: https://api.openai.com/v1
API Key: sk-proj-xxxxxxxxxxxxx
Model: gpt-4o-mini
```

### 示例 2: 使用 Azure OpenAI

```
Provider: OpenAI
API Endpoint: https://my-resource.openai.azure.com/openai/deployments/gpt-4
API Key: your-azure-key
Model: gpt-4
```

### 示例 3: 使用本地 Ollama

```
Provider: OpenAI
API Endpoint: http://localhost:11434/v1
API Key: (留空)
Model: llama2
```

### 示例 4: 使用 Gemini + 联网搜索

```
Provider: Gemini
API Endpoint: (留空)
API Key: (留空)
Model: gemini-2.5-flash
联网搜索: 开启 ✓
```

## 故障排查

### 问题 1: API Key 错误
- **症状**: 返回 401 或 403 错误
- **解决**: 
  1. 检查 API Key 是否正确
  2. 确认 API Key 有效期
  3. 验证 API Key 权限

### 问题 2: Endpoint 无法访问
- **症状**: 连接超时或网络错误
- **解决**:
  1. 检查 Endpoint URL 格式
  2. 确认网络连接
  3. 验证防火墙设置

### 问题 3: Model 不存在
- **症状**: 返回 model not found 错误
- **解决**:
  1. 确认 Model 名称正确
  2. 检查 API 账户权限
  3. 查看 API 文档确认可用模型

### 问题 4: 配置未保存
- **症状**: 刷新页面后配置丢失
- **解决**:
  1. 检查浏览器是否允许 localStorage
  2. 清除浏览器缓存后重试
  3. 检查浏览器隐私模式设置

## 最佳实践

### 1. 配置管理
- ✅ 为不同用途创建不同配置
- ✅ 定期备份重要配置
- ✅ 使用环境变量管理敏感信息

### 2. 性能优化
- ✅ 选择合适的模型（速度 vs 质量）
- ✅ 按需开启联网搜索
- ✅ 使用本地 LLM 减少延迟

### 3. 成本控制
- ✅ 使用 mini 模型降低成本
- ✅ 限制对话历史长度
- ✅ 监控 API 使用量

### 4. 安全建议
- ✅ 不要在公共设备上保存 API Key
- ✅ 使用只读或受限权限的 API Key
- ✅ 定期轮换 API Key
- ✅ 清除浏览器数据时删除配置

## 技术细节

### 前端状态管理
```typescript
const [aiConfig, setAiConfig] = useState({
  provider: 'gemini',
  endpoint: '',
  apiKey: '',
  model: '',
  enableSearch: false,
})

// 自动保存到 localStorage
useEffect(() => {
  localStorage.setItem('alice-ai-config', JSON.stringify(aiConfig))
}, [aiConfig])
```

### 后端配置合并
```typescript
const provider = aiConfig?.provider || (USE_OPENAI ? 'openai' : 'gemini')
const endpoint = aiConfig?.endpoint || OPENAI_API_ENDPOINT
const apiKey = aiConfig?.apiKey || OPENAI_API_KEY
const model = aiConfig?.model || OPENAI_MODEL
```

### OpenAI 客户端创建
```typescript
const client = config?.endpoint || config?.apiKey
  ? new OpenAI({
      apiKey: config.apiKey || OPENAI_API_KEY,
      baseURL: config.endpoint || OPENAI_API_ENDPOINT,
    })
  : openai  // 使用默认客户端
```

## 未来扩展

### 计划功能
- [ ] 配置预设（快速切换）
- [ ] 配置导入/导出
- [ ] API 使用统计
- [ ] 成本估算
- [ ] 多账户管理
- [ ] 配置加密存储

### 可能支持的提供商
- [ ] Anthropic Claude
- [ ] Cohere
- [ ] Hugging Face
- [ ] 本地 LLaMA
- [ ] 其他 OpenAI 兼容 API


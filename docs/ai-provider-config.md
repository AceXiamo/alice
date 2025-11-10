# AI Provider Configuration Guide

本文档说明如何配置 Alice 使用不同的 AI 提供商（OpenAI 或 Gemini）。

## 环境变量配置

### OpenAI 配置

如果要使用 OpenAI（包括 OpenAI 兼容的 API），请设置以下环境变量：

```bash
# 启用 OpenAI
USE_OPENAI=true

# OpenAI API 配置
API_ENDPOINT=https://api.openai.com/v1
API_KEY=your-openai-api-key
MODEL=gpt-4o-mini
```

#### 支持的模型示例

- `gpt-4o` - GPT-4 Optimized
- `gpt-4o-mini` - GPT-4 Optimized Mini（推荐，性价比高）
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-3.5-turbo` - GPT-3.5 Turbo

#### OpenAI 兼容 API

如果使用 OpenAI 兼容的 API（如 Azure OpenAI、本地部署的模型等），只需修改 `API_ENDPOINT`：

```bash
# 示例：Azure OpenAI
API_ENDPOINT=https://your-resource.openai.azure.com/openai/deployments/your-deployment
API_KEY=your-azure-api-key
MODEL=gpt-4

# 示例：本地 LLM（如 Ollama、LocalAI）
API_ENDPOINT=http://localhost:11434/v1
API_KEY=not-needed
MODEL=llama2
```

### Gemini 配置（默认）

如果不设置 `USE_OPENAI=true`，系统将使用 Gemini（Google Vertex AI）：

```bash
# 不设置 USE_OPENAI 或设置为 false
USE_OPENAI=false

# Gemini 配置
GEMINI_MODEL=gemini-2.5-flash
VERTEXAI_PROJECT_ID=your-gcp-project-id
```

## 配置验证

系统会在启动时验证配置：

- 如果 `USE_OPENAI=true` 但未设置 `API_KEY`，将返回 `missing_openai_api_key` 错误
- 如果 `USE_OPENAI=false` 但未设置 Vertex AI 配置，将返回 `missing_vertex_ai_config` 错误

## 切换提供商

要在 OpenAI 和 Gemini 之间切换，只需修改 `USE_OPENAI` 环境变量：

```bash
# 使用 OpenAI
USE_OPENAI=true

# 使用 Gemini
USE_OPENAI=false
```

重启应用后生效。

## API 响应格式

无论使用哪个提供商，API 响应格式保持一致：

```json
{
  "text": "AI 生成的回复文本",
  "audioUrl": "/api/audio-proxy?url=...",
  "duration": 1.2
}
```

## 功能对比

| 功能 | OpenAI | Gemini |
|------|--------|--------|
| 对话历史 | ✅ 支持（最近 5 条） | ✅ 支持（最近 5 条） |
| 系统提示词 | ✅ 支持 | ✅ 支持 |
| 温度控制 | ✅ 0.7 | ✅ 0.7 |
| 搜索增强 | ❌ 不支持 | ✅ 支持（Google Search） |
| 流式响应 | ❌ 当前不支持 | ❌ 当前不支持 |

## 故障排查

### OpenAI 连接失败

1. 检查 `API_KEY` 是否正确
2. 检查 `API_ENDPOINT` 是否可访问
3. 检查 `MODEL` 名称是否正确
4. 查看服务器日志中的详细错误信息

### Gemini 连接失败

1. 检查 GCP 服务账号凭据是否正确
2. 检查 Vertex AI API 是否已启用
3. 检查项目 ID 是否正确

## 性能建议

- **OpenAI**: 推荐使用 `gpt-4o-mini`，响应速度快，成本低
- **Gemini**: 推荐使用 `gemini-2.5-flash`，响应速度快，支持搜索增强

## 成本估算

### OpenAI (gpt-4o-mini)
- 输入：$0.15 / 1M tokens
- 输出：$0.60 / 1M tokens
- 平均每次对话：~$0.001

### Gemini (gemini-2.5-flash)
- 输入：免费（有配额限制）
- 输出：免费（有配额限制）
- 超出配额后按量计费

## 示例配置文件

完整的 `.env` 配置示例：

```bash
# 使用 OpenAI
USE_OPENAI=true
API_ENDPOINT=https://api.openai.com/v1
API_KEY=sk-proj-xxxxxxxxxxxxx
MODEL=gpt-4o-mini

# TTS 配置
USE_AZURE=true
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_REGION=eastasia
AZURE_VOICE_NAME=zh-CN-XiaoyiNeural

# R2 存储配置
R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-key-id
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=alice-audio
R2_PUBLIC_URL_BASE=https://audio.yourdomain.com

# 数据库配置
DATABASE_URL=postgresql://user:pass@host:5432/db
```


-- Basic Configuration Insert Statements
-- 核心配置：讨论组和网站描述

-- 1. 讨论组配置 (图片 URL)
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'config_discussion_groups_001',
  'discussion_groups',
  'https://example.com/discussion-groups-qr.png',
  'url',
  '社区讨论群组二维码或图片',
  NOW(),
  NOW()
);

-- 2. 网站描述 (Markdown 格式)
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'config_site_description_001',
  'site_description',
  '# 欢迎使用 Alice

Alice 是您的语音优先 AI 聊天伴侣，提供自然的对话体验。

## 主要功能
- **语音交互** - 先进的语音识别和合成技术
- **持久化聊天记录** - 您的对话会被保存
- **现代化界面** - 美观、响应式的用户界面
- **实时响应** - 快速智能的 AI 回复

## 开始使用
点击麦克风按钮或输入消息即可开始与 Alice 聊天。',
  'markdown',
  '网站主描述',
  NOW(),
  NOW()
);

-- 如果需要更新已存在的配置，使用以下语句：

-- 更新讨论组
-- UPDATE "configurations"
-- SET "value" = 'https://example.com/new-discussion-groups-qr.png',
--     "updatedAt" = NOW()
-- WHERE "key" = 'discussion_groups';

-- 更新网站描述
-- UPDATE "configurations"
-- SET "value" = '# 新的描述内容',
--     "updatedAt" = NOW()
-- WHERE "key" = 'site_description';

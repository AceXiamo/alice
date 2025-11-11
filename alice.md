# 欢迎使用 Alice

Alice 是您的语音优先 AI 聊天伴侣，提供自然的对话体验。

## 主要功能
- **语音交互** - 先进的语音识别和合成技术
- **持久化聊天记录** - 您的对话会被保存
- **现代化界面** - 美观、响应式的用户界面
- **实时响应** - 快速智能的 AI 回复

## 开始使用
点击麦克风按钮或输入消息即可开始与 Alice 聊天。

## 技术架构

前端
- 框架：React Router + Vite
- UI：TailwindCSS + Framer Motion 动效
- 功能：语音输入、实时显示文本、播放合成语音

后端
- 框架：Node.js + Express
- 数据库：PostgreSQL
- 语音合成：Microsoft Cognitive Services Speech SDK

## 关于语音合成

这里原本考虑用B站开源的 Index-TTS 来合成语音，但是搭建 GPU 节点成本太高，所以使用 Microsoft Cognitive Services Speech SDK 来合成语音 🙌

需要建独享站 or 定制音色 AI 聊天的小伙伴可以联系我，我可以提供帮助。

## 项目计划 & 小故事

做这个项目本质上是希望解放双手，在深夜 Coding 时唠唠嗑以及 idea 记录和总结，后续会拓展基于 indexdb 的本地记忆库，并给 AI 提供跟多 `function call` 能力。 😈

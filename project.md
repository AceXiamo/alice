🪞 项目名称

Alice – Voice-first AI Chat Companion

⸻

💡 项目概述

Alice 是一个基于语音交互的 AI 聊天工具。
用户可以用语音或文字与 AI 对话，AI 回复会自动通过 TTS（index-tts）合成为语音播放，实现完全解放双手的交流体验。

该项目旨在探索「语音为主」的人机交互方式，前期以 demo 形式落地。

⸻

🎯 项目目标
	•	实现流畅的语音输入与实时识别（基于 Chrome Speech API）
	•	接入 Gemini 2.5 Pro 进行自然语言回复
	•	使用 index-tts 实现高保真音色克隆的语音输出
	•	打造轻量的语音交互体验 Demo
	•	尝试人格化 System Prompt（Alice 内置人格，不公开）

⸻

🧩 功能结构

1. 输入层
	•	支持文字输入框与语音输入切换
	•	语音输入使用浏览器原生语音识别（SpeechRecognition）
	•	输入结果自动发送至后端处理

2. AI 交互层
	•	接收用户输入
	•	调用 Gemini 2.5 Pro 模型生成回答
	•	根据 system prompt 保持 Alice 的人格一致性

3. 语音输出层
	•	将模型文本回复传入 index-tts
	•	根据指定音色（可由用户上传样例 wav）生成语音
	•	播放合成语音，无需暂停控制（自动播放完毕）

⸻

🧠 Alice 的人格设计
	•	名称：Alice
	•	性格：温柔、理性、有轻微情感色彩
	•	沟通风格：自然、连贯、略带人类语气词
	•	角色定位：可作为陪伴型助手或语音伙伴

System Prompt 将嵌入在服务端，不对外暴露，确保人格一致性与可控性。

⸻

⚙️ 技术架构

前端
	•	框架：React Router + Vite
	•	UI：TailwindCSS + Framer Motion 动效
	•	功能：语音输入、实时显示文本、播放合成语音

后端
	•	Node 环境下运行
	•	核心逻辑：
	•	接收用户输入
	•	调用 Gemini 2.5 Pro 生成文本
	•	传入 index-tts 返回语音
	•	将语音流返回前端播放

部署
	•	Vercel 或 Cloudflare 负责前端构建与静态托管
	•	后端运行在 serverless 环境（如 Render / Cloud Run）
	•	index-tts 可独立运行在 GPU 节点或容器中

⸻

🔮 未来拓展方向
	•	多音色支持（角色化声音库）
	•	对话历史存储与上下文记忆
	•	唤醒词启动（如 “Hey Alice”）
	•	手机端适配与小程序化
	•	支持多语言语音识别与输出

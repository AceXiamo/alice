# 修改记录 - Demo 模式与 AudioContext 修复

## 版本信息

- **日期**: 2025-11-09
- **类型**: 功能调整 & Bug 修复
- **影响范围**: 音频播放、可视化动画

---

## 修改概述

将项目从完整 AI 交互模式调整为 Demo 演示模式，并修复了 AudioContext 创建时机导致的粒子球动画不联动问题。

---

## 详细修改

### 1. `app/routes/_main._index.tsx`

#### 修改 1.1: handleSend 函数改为 Demo 模式

**位置**: 第 133-218 行

**改动前**:
```typescript
const handleSend = () => {
  // 调用 /api/genai 获取 AI 回复
  // 调用 TTS 服务生成语音
  // 播放生成的音频
}
```

**改动后**:
```typescript
const handleSend = async () => {
  // 1. 在用户交互上下文中立即初始化 AudioContext
  const audioEl = ttsAudioRef.current
  if (audioEl) {
    const audioUrl = 'https://axm-dev.acexiamo.com/tf.m4a'
    const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`
    audioEl.src = proxyUrl
    audioEl.muted = true
    const playPromise = audioEl.play()  // 触发 AudioContext 创建
    if (playPromise !== undefined) {
      await playPromise
      audioEl.pause()  // 立即暂停
      audioEl.currentTime = 0
    }
  }

  // 2. 等待 3 秒
  await new Promise(resolve => setTimeout(resolve, 3000))

  // 3. 播放固定的 demo 音频
  if (audioEl) {
    audioEl.muted = false
    audioEl.volume = 1
    audioEl.currentTime = 0
    await audioEl.play()
  }
}
```

**修改原因**:
1. 移除 AI API 调用，简化为 Demo 演示模式
2. **关键修复**: 在用户点击时立即静音播放，解决 AudioContext 创建时机问题
3. 固定播放 `https://axm-dev.acexiamo.com/tf.m4a` 音频文件

**影响**:
- ✅ 解决了刷新页面后直接发送消息粒子球不律动的问题
- ✅ 确保 AudioContext 在用户交互上下文中创建
- ✅ Demo 模式下音频可视化正常工作

---

### 2. `app/components/ParticleSphere.tsx`

#### 修改 2.1: 动态获取 analyser (CRITICAL FIX)

**位置**: 第 150-175 行

**改动前**:
```typescript
const draw = () => {
  const analyser = analyserRef.current  // ← 在 draw() 开始时捕获（可能为 null）
  const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

  const render = () => {
    // 使用上面捕获的 analyser（已固定为 null）
    if (analyser && freq && bandE && bands && playing) {
      // 这段代码永远不会执行
    }
  }
}
```

**改动后**:
```typescript
const draw = () => {
  // 不在这里捕获 analyser

  const render = () => {
    // CRITICAL: 每帧从 ref 动态获取最新的 analyser
    const analyser = analyserRef.current
    const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    if (analyser && freq && bandE && bands && playing) {
      // 现在可以正常执行了！
      analyser.getByteFrequencyData(freq)
      // ...
    }
  }
}
```

**修改原因**:
- `draw()` 在组件挂载时就被调用，此时 `analyserRef.current` 为 `null`
- AudioContext 在用户点击播放时才创建，晚于 `draw()` 执行
- 如果在 `draw()` 中捕获 analyser，会永远是 `null`
- **必须在每一帧中从 ref 动态获取最新的 analyser**

**影响**:
- ✅ 修复了 `analyserRef.current = true` 但 `hasAnalyser = false` 的问题
- ✅ 频谱分析逻辑能够正常执行
- ✅ 粒子球能够根据音频频谱数据实时律动

#### 修改 2.2: 移除调试日志

**位置**: 第 84, 165, 176-184 行

**改动**:
```diff
- console.log('el', el)
- console.log('analyserRef.current', !!analyserRef.current)
- console.log('Debug:', { hasAnalyser, hasFreq, ... })
```

**修改原因**:
- 调试完成，清理控制台输出

---

### 3. `app/routes/api.audio-proxy.ts`

#### 修改 3.1: 添加允许的域名

**位置**: 第 23-27 行

**改动前**:
```typescript
const allowedDomains = [
  'axm-dev.acexiamo.com',
  '70uoabtdcq08ye-7865.proxy.runpod.net'
]
```

**改动后**:
```typescript
const allowedDomains = [
  'axm-dev.acexiamo.com',
  '70uoabtdcq08ye-7865.proxy.runpod.net',
  'lxa43eyg6x78cq-8188.proxy.runpod.net'
]
```

**修改原因**:
- 添加 TTS 服务域名到白名单
- 确保代理服务能够访问 demo 音频文件

---

## 问题修复总结

### 问题 1: AudioContext 创建失败

**症状**:
- 刷新页面后直接发送消息，粒子球不律动
- 先手动选择音频再发送消息，粒子球正常律动

**根本原因**:
浏览器的自动播放策略要求 AudioContext 必须在**直接的用户交互**中创建。原代码的 3 秒延迟后才播放音频，此时已失去用户交互上下文。

**解决方案**:
在用户点击发送按钮时，立即：
1. 设置 `audio.src`
2. 静音播放 `audio.play()`（触发 AudioContext 创建）
3. 立即暂停
4. 3 秒后再真正播放

**代码位置**: `_main._index.tsx:145-166`

---

### 问题 2: analyser 被过早捕获

**症状**:
- `analyserRef.current` 为 `true`
- 但 `hasAnalyser` 为 `false`
- 频谱分析逻辑不执行

**根本原因**:
```
时间线：
1. 组件挂载 → draw() 执行 → analyser = null (捕获)
2. 用户点击 → AudioContext 创建 → analyserRef.current = AnalyserNode
3. render() 每帧执行 → 使用之前捕获的 analyser (仍是 null)
```

**解决方案**:
在 `render()` 函数内每一帧都从 `analyserRef` 动态获取最新的 analyser，而不是在 `draw()` 开始时捕获一次。

**代码位置**: `ParticleSphere.tsx:170-171`

---

### 问题 3: 跨域资源访问

**症状**:
直接访问 `https://axm-dev.acexiamo.com/tf.m4a` 可能触发 CORS 错误。

**解决方案**:
通过 `/api/audio-proxy` 代理请求，服务端添加 `Access-Control-Allow-Origin: *` 响应头。

**代码位置**: `api.audio-proxy.ts`

---

## 测试验证

### 测试场景 1: 刷新后直接发送

**步骤**:
1. 刷新页面
2. 输入任意文字
3. 点击发送

**预期结果**:
- ✅ 等待 3 秒
- ✅ 播放音频
- ✅ 粒子球随音频律动

**实际结果**: ✅ 通过

---

### 测试场景 2: 手动选择音频后发送

**步骤**:
1. 点击音频图标，选择本地音频文件
2. 播放并验证粒子球律动
3. 输入文字并发送

**预期结果**:
- ✅ 两次播放都能正常律动

**实际结果**: ✅ 通过

---

### 测试场景 3: 连续多次发送

**步骤**:
1. 发送消息 A
2. 等待播放结束
3. 发送消息 B
4. 重复多次

**预期结果**:
- ✅ 每次播放都能正常律动
- ✅ 没有内存泄漏
- ✅ AudioContext 保持单例

**实际结果**: ✅ 通过

---

## 性能影响

### 内存占用
- 无显著变化
- AudioContext 保持单例，不会重复创建

### CPU 占用
- 每帧创建 `Uint8Array(512)` 的开销可忽略
- 频谱分析逻辑高效，无性能问题

### 网络请求
- Demo 音频文件通过 proxy 缓存 1 小时
- 减少重复请求

---

## 回滚计划

如需回滚到 AI 模式，需要：

1. 恢复 `handleSend` 中的 API 调用：
```typescript
// 恢复 /api/genai 调用
// 恢复 TTS 服务调用
```

2. 保留 AudioContext 初始化逻辑：
```typescript
// 保留静音播放的修复方案
```

3. 移除 3 秒延迟：
```typescript
// 直接在 API 返回后播放
```

---

## 相关文件

| 文件 | 修改类型 | 行数变化 |
|------|---------|---------|
| `app/routes/_main._index.tsx` | 重构 + 修复 | ~85 行 |
| `app/components/ParticleSphere.tsx` | Bug 修复 | ~25 行 |
| `app/routes/api.audio-proxy.ts` | 配置调整 | +1 行 |

---

## 后续优化建议

### 1. 预加载音频文件
```typescript
// 在应用启动时预加载 demo 音频
const audio = new Audio(proxyUrl)
audio.preload = 'auto'
```

### 2. 添加加载进度提示
```typescript
// 显示音频加载进度
audioEl.addEventListener('progress', (e) => {
  const loaded = audioEl.buffered.end(0)
  const total = audioEl.duration
  console.log(`Loaded: ${(loaded / total * 100).toFixed(2)}%`)
})
```

### 3. 错误处理增强
```typescript
// 更详细的错误提示
try {
  await audioEl.play()
} catch (err) {
  if (err.name === 'NotAllowedError') {
    alert('请允许音频自动播放权限')
  } else if (err.name === 'NotSupportedError') {
    alert('浏览器不支持该音频格式')
  }
}
```

---

## 参考 Issue

- 浏览器自动播放策略: https://developer.chrome.com/blog/autoplay/
- Web Audio API 最佳实践: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices

---

最后更新：2025-11-09
作者：Claude Code

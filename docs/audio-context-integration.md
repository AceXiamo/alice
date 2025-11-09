# AudioContext 集成说明文档

## 概述

本项目实现了基于 Web Audio API 的音频可视化功能，通过 AudioContext 分析音频频谱数据，驱动 3D 粒子球动画与音频同步律动。

---

## 核心架构

### 1. 音频处理链路

```
<audio> 元素
  ↓
MediaElementAudioSourceNode (音频源)
  ↓
AnalyserNode (频谱分析器)
  ↓
AudioDestinationNode (扬声器输出)
```

### 2. 组件关系

- **`app/routes/_main._index.tsx`**: 主页面组件，负责音频播放控制
- **`app/components/ParticleSphere.tsx`**: 粒子球可视化组件，负责音频分析和动画渲染
- **`app/routes/api.audio-proxy.ts`**: 音频代理 API，解决跨域问题

---

## AudioContext 创建机制

### 触发时机

AudioContext 的创建**必须**在用户交互事件的同步上下文中进行，否则会因浏览器自动播放策略而失败。

#### 实现方式（`_main._index.tsx:145-166`）

```typescript
const handleSend = async () => {
  // ...

  // CRITICAL: 在用户点击时立即播放静音音频，建立 AudioContext
  const audioEl = ttsAudioRef.current
  if (audioEl) {
    audioEl.src = proxyUrl
    audioEl.muted = true
    const playPromise = audioEl.play()  // ← 触发 'play' 事件
    await playPromise
    audioEl.pause()  // 立即暂停
    audioEl.currentTime = 0
  }

  // 3 秒后真正播放音频...
}
```

**关键点：**
1. 在用户点击的**同步上下文**中调用 `play()`
2. 静音播放，用户无感知
3. 触发 `ParticleSphere` 组件的 `'play'` 事件监听器
4. 创建 AudioContext 及相关节点
5. 立即暂停，等待后续播放

---

## ParticleSphere 组件详解

### 音频节点初始化（`ParticleSphere.tsx:91-117`）

```typescript
const init = () => {
  // 1. 创建 AudioContext（如果不存在）
  if (!audioCtxRef.current) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioCtxRef.current = new Ctx()
  }

  // 2. 创建 MediaElementSource（只能创建一次）
  if (!sourceRef.current) {
    sourceRef.current = audioCtx.createMediaElementSource(el)
  }

  // 3. 创建并连接 AnalyserNode
  if (!analyserRef.current && sourceRef.current) {
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024  // FFT 采样大小
    analyser.smoothingTimeConstant = 0.85  // 平滑系数
    analyserRef.current = analyser
    sourceRef.current.connect(analyser)
    analyser.connect(audioCtx.destination)  // 连接到扬声器
  }
}
```

### 事件监听器（`ParticleSphere.tsx:119-131`）

```typescript
const onPlay = () => {
  audioCtxRef.current?.resume()  // 恢复 AudioContext（应对自动播放限制）
  init()  // 初始化音频节点
}

el.addEventListener('play', onPlay)  // 监听 play 事件
```

### 频谱分析与动画渲染（`ParticleSphere.tsx:162-207`）

**关键修复：每帧动态获取 analyser**

```typescript
const render = () => {
  // CRITICAL: 每帧从 ref 获取最新的 analyser（可能在 draw() 之后才创建）
  const analyser = analyserRef.current
  const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

  const audioEl = audioRef?.current
  const playing = !!audioEl && !audioEl.paused

  if (analyser && freq && bandE && bands && playing) {
    // 获取频谱数据
    analyser.getByteFrequencyData(freq)

    // 分成 12 个频段
    const bucket = Math.floor(freq.length / bandCount) || 1
    for (let b = 0; b < bandCount; b++) {
      // 计算每个频段的平均能量
      // 应用软压缩避免饱和
      const comp = Math.tanh(avg / BAND_COMPRESS_K)
      bandE[b] = bandE[b] * 0.85 + comp * 0.15
    }
  }
}
```

---

## 音频代理 API

### 用途

解决直接访问外部音频 URL 的 CORS 跨域问题。

### 实现（`api.audio-proxy.ts`）

```typescript
export async function loader({ request }: Route.LoaderFunctionArgs) {
  const url = new URL(request.url)
  const audioUrl = url.searchParams.get('url')

  // 域名白名单验证
  const allowedDomains = [
    'axm-dev.acexiamo.com',
    '70uoabtdcq08ye-7865.proxy.runpod.net',
    'lxa43eyg6x78cq-8188.proxy.runpod.net'
  ]

  // 代理请求并返回
  const response = await fetch(audioUrl)
  const audioBuffer = await response.arrayBuffer()

  return new Response(audioBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'  // 允许跨域
    }
  })
}
```

### 使用方式

```typescript
const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`
audioEl.src = proxyUrl
```

---

## 完整交互流程

### Demo 模式播放流程

```
1. 用户输入文字并点击发送
   ↓
2. handleSend 执行
   ↓
3. 设置 audio.src = proxyUrl（代理 URL）
   ↓
4. 静音播放 audio.play() ← 用户交互上下文
   ↓
5. 触发 'play' 事件
   ↓
6. ParticleSphere: onPlay → init()
   ↓
7. 创建 AudioContext + MediaElementSource + AnalyserNode
   ↓
8. 立即 pause() 并重置 currentTime = 0
   ↓
9. 用户无感知，等待 3 秒...
   ↓
10. 3 秒后取消静音，再次 play()
   ↓
11. AudioContext 已就绪，开始分析频谱
   ↓
12. 每帧获取频谱数据 → 计算 12 个频段能量
   ↓
13. 根据频段能量控制粒子位移
   ↓
14. 粒子球实时律动 🎵✨
```

---

## 关键问题与解决方案

### 问题 1: 延迟播放导致 AudioContext 创建失败

**现象：**
- 刷新页面后直接发送消息，粒子球不律动
- 先手动选择音频再发送消息，粒子球正常律动

**原因：**
- 3 秒延迟后的 `play()` 调用已失去用户交互上下文
- 浏览器拒绝创建 AudioContext

**解决：**
- 在用户点击时立即静音播放，建立 AudioContext
- 3 秒后再真正播放音频

### 问题 2: analyser 在 draw() 中被过早捕获

**现象：**
- `analyserRef.current` 为 `true`，但 `hasAnalyser` 为 `false`
- 频谱分析逻辑永远不执行

**原因：**
```typescript
const draw = () => {
  const analyser = analyserRef.current  // ← 此时为 null
  const render = () => {
    if (analyser ...) { ... }  // ← 永远是 null
  }
}
```

**解决：**
```typescript
const draw = () => {
  const render = () => {
    const analyser = analyserRef.current  // ← 每帧动态获取
    if (analyser ...) { ... }  // ← 现在可以正常工作
  }
}
```

### 问题 3: MediaElementSource 重复创建

**现象：**
- 抛出异常：`Failed to construct 'MediaElementAudioSourceNode'`

**原因：**
- 每个 `<audio>` 元素只能创建一次 MediaElementSource

**解决：**
```typescript
if (!sourceRef.current) {
  try {
    sourceRef.current = audioCtx.createMediaElementSource(el)
  } catch (e) {
    console.warn('media element source init failed:', e)
  }
}
```

---

## 配置参数

### ParticleSphere 可调参数

```typescript
// 粒子球大小
export const DEFAULT_SIZE_SCALE = 0.6

// 粒子移动幅度（律动强度）
export const DEFAULT_MOVE_AMP_SCALE = 8

// 粒子大小
export const DEFAULT_PARTICLE_SIZE = 0.3

// 粒子数量（建议为 bandCount 的倍数）
export const DEFAULT_PARTICLE_COUNT = 2400

// 频段能量压缩系数（越大越不易饱和）
const BAND_COMPRESS_K = 0.9

// 局部位移软饱和阈值
const LOCAL_SAT_K = 0.5

// 绝对安全上限
const SAFE_LOCAL_CAP = 2
```

### AnalyserNode 配置

```typescript
analyser.fftSize = 1024  // FFT 采样大小（必须是 2 的幂次）
analyser.smoothingTimeConstant = 0.85  // 平滑系数 (0-1)
analyser.frequencyBinCount  // = fftSize / 2 = 512 个频段
```

---

## 性能优化

### 1. 设备像素比限制

```typescript
const dpr = Math.min(window.devicePixelRatio || 1, 2)
```

避免在高 DPI 屏幕上性能开销过大。

### 2. 频谱数据平滑

```typescript
bandE[b] = bandE[b] * 0.85 + comp * 0.15
```

使用加权平均避免动画突变。

### 3. 软饱和压缩

```typescript
const comp = Math.tanh(avg / BAND_COMPRESS_K)
const local = (localRaw / (localRaw + LOCAL_SAT_K)) * maxLocal
```

防止能量值硬截断导致的视觉不连续。

### 4. 深度排序

```typescript
projected.sort((a, b) => a.z - b.z)
```

从后向前渲染粒子，提供正确的深度视觉。

---

## 浏览器兼容性

### AudioContext

- Chrome/Edge: ✅ 支持
- Firefox: ✅ 支持
- Safari: ✅ 需要 `webkitAudioContext` 前缀

### 自动播放策略

所有现代浏览器都要求用户交互才能播放音频和创建 AudioContext。

### 处理方式

```typescript
const Ctx = window.AudioContext || window.webkitAudioContext
audioCtxRef.current = new Ctx()
audioCtxRef.current?.resume()  // 应对 suspended 状态
```

---

## 调试技巧

### 1. 检查 AudioContext 状态

```typescript
console.log('AudioContext state:', audioCtxRef.current?.state)
// 'running' | 'suspended' | 'closed'
```

### 2. 检查频谱数据

```typescript
console.log('Frequency data:', freq)
console.log('Band energies:', bandE)
```

### 3. 检查音频播放状态

```typescript
console.log('Audio playing:', !audioEl.paused)
console.log('Current time:', audioEl.currentTime)
```

### 4. 检查节点连接

```typescript
console.log('Has source:', !!sourceRef.current)
console.log('Has analyser:', !!analyserRef.current)
```

---

## 未来扩展

### 1. 多音频源支持

当前实现假设单一音频源。如需支持多音频源，需要：
- 为每个音频元素创建独立的 MediaElementSource
- 使用 GainNode 混合多个音频源

### 2. 可视化预设

可添加不同的可视化模式：
- 波形模式（使用 `getByteTimeDomainData`）
- 频谱条模式（类似传统音乐播放器）
- 自定义粒子形状和颜色

### 3. 音频效果处理

可在音频链路中添加效果节点：
- BiquadFilterNode（均衡器）
- ConvolverNode（混响）
- DynamicsCompressorNode（压缩器）

---

## 参考资料

- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AnalyserNode - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [Autoplay Policy - Chrome Developers](https://developer.chrome.com/blog/autoplay/)
- [Fibonacci Sphere](https://extremelearning.com.au/how-to-evenly-distribute-points-on-a-sphere-more-effectively-than-the-canonical-fibonacci-lattice/)

---

最后更新：2025-11-09

import sdk from 'microsoft-cognitiveservices-speech-sdk'
import fs from 'fs'

// ==== 配置部分 ====
const SPEECH_KEY = process.env.AZURE_SPEECH_KEY || 'G8vX8KgIr6RVzglj6T81U86h9TnQ22LxSoiCWqIrLeZUZ3hxCIHuJQQJ99BEAC3pKaRXJ3w3AAAYACOGe8ea'
const SERVICE_REGION = process.env.AZURE_SPEECH_REGION || 'eastasia'
const VOICE_NAME = process.env.AZURE_VOICE_NAME || 'zh-CN-XiaochenNeural' // 你的自定义语音名

// 输出文件路径
const OUTPUT_PATH = './output.mp3'

// ==== 初始化 ====
const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SERVICE_REGION)
speechConfig.speechSynthesisVoiceName = VOICE_NAME
speechConfig
speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3

// 输出到文件
const audioConfig = sdk.AudioConfig.fromAudioFileOutput(OUTPUT_PATH)
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig)

// ==== 调用 TTS ====
const text = '你好，这是使用 Bun 调用 Azure 自定义语音的示例。'

function buildCheerfulSSML(text: string) {
  return `
  <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis'
         xmlns:mstts='https://www.w3.org/2001/mstts'
         xml:lang='zh-CN'>
    <voice name='${VOICE_NAME}'>
      <mstts:express-as style='cheerful' styledegree='1.0'>
        <prosody rate='1.05' pitch='+2Hz'>
          ${text}
        </prosody>
      </mstts:express-as>
    </voice>
  </speak>`
}

console.log('🎤 Generating speech...')
synthesizer.speakSsmlAsync(
  buildCheerfulSSML(text),
  (result) => {
    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      console.log(`✅ 已保存音频：${OUTPUT_PATH}`)
    } else {
      console.error('❌ 合成失败：', result.errorDetails)
    }
    synthesizer.close()
  },
  (err) => {
    console.error('❌ SDK Error:', err)
    synthesizer.close()
  }
)

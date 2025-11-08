this.projectId = process.env.VERTEXAI_PROJECT_ID || 'framio-474722'
    this.location = process.env.VERTEXAI_LOCATION || 'global'

    const credentials = {
      type: '',
      project_id: '',
      private_key_id: '',
      private_key: '',
      client_email: '',
      client_id: '',
      auth_uri: '',
      token_uri: '',
      auth_provider_x509_cert_url: '',
      client_x509_cert_url: '',
      universe_domain: '',
    }

    this.genai = new GoogleGenAI({
      vertexai: true,
      project: this.projectId,
      location: this.location,
      googleAuthOptions: {
        credentials: credentials,
      },
    })

    const response = await this.genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config,
    })

    // 从 Gemini API 响应中获取文本内容
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      throw new Error('AI response is empty')
    }

    // 解析返回的内容，提取正文和标签
    const { aiInsight, impactTags } = this.parseContentAndTags(content)

    const result: AIInsightResult = {
      aiInsight,
      impactTags,
    }

    // 处理 grounding metadata
    const groundingMetadata = this.extractGroundingMetadata(response)
    if (groundingMetadata) {
      result.groundingMetadata = groundingMetadata
      console.log(`🔍 Found ${groundingMetadata.sources.length} grounding sources for: ${news.title}`)
    }

    console.log(`✨ Generated insight for: ${news.title}`)

    // 提取 grounding metadata
  private extractGroundingMetadata(response: any): GroundingMetadata | null {
    try {
      // 检查 Gemini 响应中是否包含引用信息
      const candidates = response.candidates
      if (!candidates || candidates.length === 0) return null

      const candidate = candidates[0]
      const groundingMetadata = candidate.groundingMetadata

      if (!groundingMetadata) return null

      const sources: GroundingSource[] = []
      const searchQueries: string[] = []

      // 从 webSearchQueries 提取搜索查询
      if (groundingMetadata.webSearchQueries) {
        searchQueries.push(...groundingMetadata.webSearchQueries)
      }

      // 从 groundingChunks 提取引用来源
      if (groundingMetadata.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web) {
            sources.push({
              title: chunk.web.title || chunk.web.domain || 'Web Source',
              url: chunk.web.uri || '#',
              snippet: chunk.web.snippet || undefined,
            })
          }
        }
      }

      // 从 citationMetadata 提取引用来源（如果存在）
      const citationMetadata = candidate.citationMetadata
      if (citationMetadata && citationMetadata.citationSources) {
        for (const citation of citationMetadata.citationSources) {
          sources.push({
            title: citation.title || 'Citation Source',
            url: citation.uri || '#',
            snippet: citation.license || undefined,
          })
        }
      }

      if (sources.length === 0 && searchQueries.length === 0) {
        return null
      }

      return {
        searchQueries,
        sources,
        retrievalMetadata: groundingMetadata,
      }
    } catch (error) {
      console.warn('Failed to extract grounding metadata:', error)
      return null
    }
  }

import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import "~style.css"

interface AIProvider {
  id: string
  name: string
  apiKeyLabel: string
  baseUrl?: string
  models: string[]
  defaultModel: string
  modelsEndpoint?: string
  supportsModelFetch?: boolean
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    apiKeyLabel: "API Key",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    defaultModel: "gpt-3.5-turbo",
    modelsEndpoint: "/models",
    supportsModelFetch: true
  },
  {
    id: "gemini",
    name: "Google Gemini",
    apiKeyLabel: "API Key",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"],
    defaultModel: "gemini-1.5-flash",
    modelsEndpoint: "/models",
    supportsModelFetch: true
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    apiKeyLabel: "API Key",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
    defaultModel: "claude-3-haiku-20240307",
    supportsModelFetch: false
  },
  {
    id: "openai-compatible",
    name: "OpenAI兼容API",
    apiKeyLabel: "API Key",
    baseUrl: "https://api.example.com/v1",
    models: ["gpt-3.5-turbo", "gpt-4"],
    defaultModel: "gpt-3.5-turbo",
    modelsEndpoint: "/models",
    supportsModelFetch: true
  }
]

interface AIConfig {
  provider: string
  apiKeys: {
    openai?: string
    gemini?: string
    claude?: string
    "openai-compatible"?: string
  }
  model: string
  baseUrl?: string
  enabled: boolean
  customModel?: string
}

function OptionsPage() {
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: "openai",
    apiKeys: {},
    model: "gpt-3.5-turbo",
    enabled: false
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [availableModels, setAvailableModels] = useState<{[key: string]: string[]}>({})
  const [fetchingModels, setFetchingModels] = useState(false)
  const [useCustomModel, setUseCustomModel] = useState(false)
  const storage = new Storage()

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const config = await storage.get<AIConfig>("aiConfig")
      if (config) {
        setAiConfig(config)
        // 检查是否使用自定义模型
        if (config.customModel) {
          setUseCustomModel(true)
        }
        
        // 如果有API Key且支持获取模型，尝试获取模型列表
        const provider = AI_PROVIDERS.find(p => p.id === config.provider)
        const apiKey = config.apiKeys?.[config.provider as keyof typeof config.apiKeys]
        if (provider && apiKey && provider.supportsModelFetch) {
          fetchModels(provider, apiKey).then(models => {
            setAvailableModels(prev => ({
              ...prev,
              [provider.id]: models
            }))
          })
        }
      }
    } catch (error) {
      console.error("加载配置失败:", error)
    }
  }

  const saveConfig = async () => {
    try {
      setSaving(true)
      
      // 构建要保存的配置
      const configToSave = {
        ...aiConfig,
        customModel: useCustomModel ? aiConfig.model : undefined
      }
      
      await storage.set("aiConfig", configToSave)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error("保存配置失败:", error)
    } finally {
      setSaving(false)
    }
  }

  const fetchModels = async (provider: AIProvider, apiKey: string) => {
    if (!provider.supportsModelFetch || !provider.modelsEndpoint || !apiKey) {
      return provider.models
    }

    try {
      setFetchingModels(true)
      const baseUrl = aiConfig.baseUrl || provider.baseUrl
      const url = `${baseUrl}${provider.modelsEndpoint}`
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (provider.id === 'openai' || provider.id === 'openai-compatible') {
        headers['Authorization'] = `Bearer ${apiKey}`
      } else if (provider.id === 'gemini') {
        // Gemini uses API key as query parameter and different endpoint
        const geminiUrl = `${provider.baseUrl}/models?key=${apiKey}`
        const response = await fetch(geminiUrl, { headers })
        const data = await response.json()
        // 过滤出支持 generateContent 的模型
        const supportedModels = data.models?.filter((m: any) => 
          m.supportedGenerationMethods?.includes('generateContent')
        ).map((m: any) => m.name.replace('models/', '')) || provider.models
        return supportedModels
      }

      const response = await fetch(url, { headers })
      const data = await response.json()
      
      if (provider.id === 'openai' || provider.id === 'openai-compatible') {
        return data.data?.map((m: any) => m.id).filter((id: string) => 
          id.includes('gpt') || id.includes('text-davinci') || id.includes('claude') || id.includes('llama')
        ) || provider.models
      }
      
      return provider.models
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return provider.models
    } finally {
      setFetchingModels(false)
    }
  }

  const handleProviderChange = (providerId: string) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId)
    if (provider) {
      setAiConfig({
        ...aiConfig,
        provider: providerId,
        model: provider.defaultModel,
        baseUrl: provider.baseUrl
      })
      setUseCustomModel(false)
      
      // 如果有API Key，尝试获取模型列表
      const apiKey = aiConfig.apiKeys?.[providerId as keyof typeof aiConfig.apiKeys]
      if (apiKey && provider.supportsModelFetch) {
        fetchModels(provider, apiKey).then(models => {
          setAvailableModels(prev => ({
            ...prev,
            [providerId]: models
          }))
        })
      }
    }
  }

  const handleApiKeyChange = (apiKey: string) => {
    const newApiKeys = {
      ...aiConfig.apiKeys,
      [aiConfig.provider]: apiKey
    }
    setAiConfig({ ...aiConfig, apiKeys: newApiKeys })
    
    const provider = AI_PROVIDERS.find(p => p.id === aiConfig.provider)
    if (provider && apiKey && provider.supportsModelFetch) {
      fetchModels(provider, apiKey).then(models => {
        setAvailableModels(prev => ({
          ...prev,
          [provider.id]: models
        }))
      })
    }
  }

  const handleModelChange = (model: string) => {
    setAiConfig({ ...aiConfig, model, customModel: useCustomModel ? model : undefined })
  }

  const currentProvider = AI_PROVIDERS.find(p => p.id === aiConfig.provider)

  return (
    <div className="max-w-3xl mx-auto p-5 font-sans">
      <h1 className="text-2xl mb-5 text-gray-800">视频字幕AI总结 - 配置</h1>

      <div className="bg-gray-50 p-4 rounded-lg mb-5">
        <h2 className="text-lg mb-4 text-gray-800">AI服务配置</h2>

        <div className="mb-4">
          <label className="block mb-2 font-medium text-gray-600">启用AI总结功能</label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aiConfig.enabled}
              onChange={(e) => setAiConfig({ ...aiConfig, enabled: e.target.checked })}
              className="mr-2"
            />
            启用字幕AI总结
          </label>
        </div>

        {aiConfig.enabled && (
          <>
            <div className="mb-4">
              <label className="block mb-2 font-medium text-gray-600">AI服务商</label>
              <select
                value={aiConfig.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded text-sm"
              >
                {AI_PROVIDERS.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium text-gray-600">{currentProvider?.apiKeyLabel || "API Key"}</label>
              <input
                type="password"
                value={aiConfig.apiKeys?.[aiConfig.provider as keyof typeof aiConfig.apiKeys] || ""}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={`请输入${currentProvider?.name}的API Key`}
                className="w-full py-2 px-3 border border-gray-300 rounded text-sm"
              />
              {currentProvider?.supportsModelFetch && (
                <small className="text-gray-600 text-xs block mt-1">
                  填写API Key后将自动获取可用模型列表
                </small>
              )}
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium text-gray-600">模型选择</label>
              
              <div className="mb-3">
                <label className="flex items-center cursor-pointer mb-2">
                  <input
                    type="radio"
                    name="modelType"
                    checked={!useCustomModel}
                    onChange={() => setUseCustomModel(false)}
                    className="mr-2"
                  />
                  使用预设模型
                </label>
                
                {!useCustomModel && (
                   <div className="ml-6">
                     <div className="flex gap-2 items-center">
                       <select
                         value={aiConfig.model}
                         onChange={(e) => handleModelChange(e.target.value)}
                         disabled={fetchingModels}
                         className="flex-1 py-2 px-3 border border-gray-300 rounded text-sm"
                       >
                         {(availableModels[aiConfig.provider] || currentProvider?.models || []).map(model => (
                           <option key={model} value={model}>
                             {model}
                           </option>
                         ))}
                       </select>
                       
                       {currentProvider?.supportsModelFetch && aiConfig.apiKeys?.[aiConfig.provider as keyof typeof aiConfig.apiKeys] && (
                         <button
                           onClick={() => {
                             const provider = AI_PROVIDERS.find(p => p.id === aiConfig.provider)
                             const apiKey = aiConfig.apiKeys?.[aiConfig.provider as keyof typeof aiConfig.apiKeys]
                             if (provider && apiKey) {
                               fetchModels(provider, apiKey).then(models => {
                                 setAvailableModels(prev => ({
                                   ...prev,
                                   [provider.id]: models
                                 }))
                               })
                             }
                           }}
                           disabled={fetchingModels}
                           className={`py-2 px-3 border border-gray-300 rounded bg-gray-50 text-xs ${
                             fetchingModels ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-100'
                           }`}
                         >
                           {fetchingModels ? "获取中..." : "刷新"}
                         </button>
                       )}
                     </div>
                   </div>
                 )}
                
                {fetchingModels && (
                  <small className="text-gray-600 text-xs block mt-1 ml-6">
                    正在获取模型列表...
                  </small>
                )}
              </div>
              
              <div>
                <label className="flex items-center cursor-pointer mb-2">
                  <input
                    type="radio"
                    name="modelType"
                    checked={useCustomModel}
                    onChange={() => setUseCustomModel(true)}
                    className="mr-2"
                  />
                  自定义模型名称
                </label>
                
                {useCustomModel && (
                  <input
                    type="text"
                    value={aiConfig.customModel || aiConfig.model}
                    onChange={(e) => handleModelChange(e.target.value)}
                    placeholder="请输入模型名称，如: gpt-4-1106-preview"
                    className="w-full py-2 px-3 border border-gray-300 rounded text-sm ml-6"
                  />
                )}
              </div>
              
              <small className="text-gray-600 text-xs block mt-2">
                {currentProvider?.supportsModelFetch 
                  ? "支持自动获取模型列表，也可手动输入模型名称" 
                  : "该服务商暂不支持自动获取模型列表，可手动输入模型名称"}
              </small>
            </div>

            {currentProvider?.baseUrl && (
              <div className="mb-4">
                <label className="block mb-2 font-medium text-gray-600">API地址 (可选)</label>
                <input
                  type="text"
                  value={aiConfig.baseUrl || ""}
                  onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value || undefined })}
                  placeholder={currentProvider.baseUrl}
                  className="w-full py-2 px-3 border border-gray-300 rounded text-sm"
                />
                <small className="text-gray-600 text-xs block mt-1">
                  如需使用自定义API地址，请在此修改
                </small>
              </div>
            )}
          </>
        )}

        <button
          onClick={saveConfig}
          disabled={saving}
          className={`${saved ? 'bg-green-600' : 'bg-blue-600'} text-white border-none py-2 px-5 rounded text-sm ${
            saving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
        >
          {saving ? "保存中..." : saved ? "已保存" : "保存配置"}
        </button>
      </div>

      <div className="bg-gray-200 p-4 rounded-lg text-sm text-gray-600">
        <h3 className="mt-0 text-base text-gray-800">使用说明</h3>
        <ul className="mb-0 pl-5">
          <li>启用AI总结功能后，在观看视频时会自动显示"AI总结"按钮</li>
          <li>点击按钮后，AI会分析视频字幕并生成内容摘要</li>
          <li>请确保API Key有效且有足够的配额</li>
          <li><strong>模型选择说明：</strong>
            <ul>
              <li><strong>预设模型：</strong>选择服务商提供的标准模型，部分服务商支持自动获取最新模型列表</li>
              <li><strong>自定义模型：</strong>手动输入模型名称，适用于使用最新模型或特殊模型的情况</li>
              <li>OpenAI和Gemini支持自动获取模型列表，填写API Key后会自动刷新</li>
              <li>可以点击"刷新"按钮手动更新模型列表</li>
            </ul>
          </li>
          <li>不同服务商的API Key获取方式：
            <ul>
              <li>OpenAI: 访问 platform.openai.com</li>
              <li>Google Gemini: 访问 ai.google.dev</li>
              <li>Anthropic Claude: 访问 console.anthropic.com</li>
              <li>OpenAI兼容API: 根据具体服务商要求获取</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default OptionsPage
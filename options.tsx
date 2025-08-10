import { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import { Button } from "~components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "~components/ui/card"
import { Checkbox } from "~components/ui/checkbox"
import { Input } from "~components/ui/input"
import { Label } from "~components/ui/label"
import { RadioGroup, RadioGroupItem } from "~components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "~components/ui/select"
import { t } from "~utils/i18n"

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
    models: [
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307"
    ],
    defaultModel: "claude-3-haiku-20240307",
    supportsModelFetch: false
  },
  {
    id: "openai-compatible",
    name: "OpenAI Compatible API",
    apiKeyLabel: "API Key",
    baseUrl: "https://api.example.com/v1",
    models: ["gpt-3.5-turbo", "gpt-4"],
    defaultModel: "gpt-3.5-turbo",
    modelsEndpoint: "/models",
    supportsModelFetch: true
  }
]

const REPLY_LANGUAGES = [
  { id: "auto", name: "Auto Detect" },
  { id: "en", name: "English" },
  { id: "zh-CN", name: "中文" },
  { id: "ja", name: "日本語" },
  { id: "ko", name: "한국어" },
  { id: "fr", name: "Français" },
  { id: "de", name: "Deutsch" },
  { id: "es", name: "Español" },
  { id: "pt", name: "Português" },
  { id: "ru", name: "Русский" }
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
  baseUrls?: {
    openai?: string
    gemini?: string
    claude?: string
    "openai-compatible"?: string
  }
  enabled: boolean
  customModel?: string
  replyLanguage?: string
}

function OptionsPage() {
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: "openai",
    apiKeys: {},
    model: "gpt-3.5-turbo",
    enabled: false,
    baseUrls: {},
    replyLanguage: "auto"
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [availableModels, setAvailableModels] = useState<{
    [key: string]: string[]
  }>({})
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
        const provider = AI_PROVIDERS.find((p) => p.id === config.provider)
        const apiKey =
          config.apiKeys?.[config.provider as keyof typeof config.apiKeys]
        if (provider && apiKey && provider.supportsModelFetch) {
          fetchModels(provider, apiKey).then((models) => {
            setAvailableModels((prev) => ({
              ...prev,
              [provider.id]: models
            }))
          })
        }
      }
    } catch (error) {
      console.error(t("loadConfigFailed"), error)
    }
  }

  const saveConfig = async () => {
    try {
      setSaving(true)

      // 构建要保存的配置
      const configToSave = {
        ...aiConfig,
        customModel: useCustomModel ? aiConfig.model : undefined,
        // 保存当前服务商的baseUrl到baseUrls对象中
        baseUrls: {
          ...aiConfig.baseUrls,
          [aiConfig.provider]: aiConfig.baseUrl
        }
      }

      await storage.set("aiConfig", configToSave)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error(t("saveConfigFailed"), error)
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
        "Content-Type": "application/json"
      }

      if (provider.id === "openai" || provider.id === "openai-compatible") {
        headers["Authorization"] = `Bearer ${apiKey}`
      } else if (provider.id === "gemini") {
        // Gemini uses API key as query parameter and different endpoint
        const geminiUrl = `${provider.baseUrl}/models?key=${apiKey}`
        const response = await fetch(geminiUrl, { headers })
        const data = await response.json()
        // 过滤出支持 generateContent 的模型
        const supportedModels =
          data.models
            ?.filter((m: any) =>
              m.supportedGenerationMethods?.includes("generateContent")
            )
            .map((m: any) => m.name.replace("models/", "")) || provider.models
        return supportedModels
      }

      const response = await fetch(url, { headers })
      const data = await response.json()

      if (provider.id === "openai" || provider.id === "openai-compatible") {
        return (
          data.data
            ?.map((m: any) => m.id)
            .filter(
              (id: string) =>
                id.includes("gpt") ||
                id.includes("text-davinci") ||
                id.includes("claude") ||
                id.includes("llama")
            ) || provider.models
        )
      }

      return provider.models
    } catch (error) {
      console.error(t("fetchModelsFailed"), error)
      return provider.models
    } finally {
      setFetchingModels(false)
    }
  }

  const handleProviderChange = async (providerId: string) => {
    const provider = AI_PROVIDERS.find((p) => p.id === providerId)
    if (provider) {
      // 从存储中加载完整配置，以获取该服务商之前保存的baseUrl
      const savedConfig = await storage.get<AIConfig>("aiConfig")

      // 优先使用该服务商之前保存的baseUrl，否则使用默认的baseUrl
      let newBaseUrl = provider.baseUrl
      if (
        savedConfig?.baseUrls?.[providerId as keyof typeof savedConfig.baseUrls]
      ) {
        newBaseUrl =
          savedConfig.baseUrls[providerId as keyof typeof savedConfig.baseUrls]
      }

      setAiConfig({
        ...aiConfig,
        provider: providerId,
        model: provider.defaultModel,
        baseUrl: newBaseUrl
      })
      setUseCustomModel(false)

      // 如果有API Key，尝试获取模型列表
      const apiKey =
        aiConfig.apiKeys?.[providerId as keyof typeof aiConfig.apiKeys]
      if (apiKey && provider.supportsModelFetch) {
        fetchModels(provider, apiKey).then((models) => {
          setAvailableModels((prev) => ({
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

    const provider = AI_PROVIDERS.find((p) => p.id === aiConfig.provider)
    if (provider && apiKey && provider.supportsModelFetch) {
      fetchModels(provider, apiKey).then((models) => {
        setAvailableModels((prev) => ({
          ...prev,
          [provider.id]: models
        }))
      })
    }
  }

  const handleModelChange = (model: string) => {
    setAiConfig({
      ...aiConfig,
      model,
      customModel: useCustomModel ? model : undefined
    })
  }

  const currentProvider = AI_PROVIDERS.find((p) => p.id === aiConfig.provider)

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("optionsTitle")}
        </h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("aiServiceConfig")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-medium">
              {t("enableAiSummary")}
            </Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-ai"
                checked={aiConfig.enabled}
                onCheckedChange={(checked) =>
                  setAiConfig({ ...aiConfig, enabled: !!checked })
                }
              />
              <Label htmlFor="enable-ai" className="cursor-pointer">
                {t("enableSubtitleAiSummary")}
              </Label>
            </div>
          </div>

          {aiConfig.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ai-provider">{t("aiProvider")}</Label>
                <Select
                  value={aiConfig.provider}
                  onValueChange={handleProviderChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">
                  {currentProvider?.apiKeyLabel || "API Key"}
                </Label>
                <Input
                  id="api-key"
                  type="password"
                  value={
                    aiConfig.apiKeys?.[
                      aiConfig.provider as keyof typeof aiConfig.apiKeys
                    ] || ""
                  }
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder={t(
                    "enterApiKeyPlaceholder",
                    currentProvider?.name || ""
                  )}
                />
                {currentProvider?.supportsModelFetch && (
                  <p className="text-xs text-muted-foreground">
                    {t("autoFetchModelsTip")}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">
                  {t("modelSelection")}
                </Label>

                <RadioGroup
                  value={useCustomModel ? "custom" : "preset"}
                  onValueChange={(value) =>
                    setUseCustomModel(value === "custom")
                  }
                  className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="preset" id="preset-model" />
                      <Label htmlFor="preset-model" className="cursor-pointer">
                        {t("usePresetModel")}
                      </Label>
                    </div>

                    {!useCustomModel && (
                      <div className="ml-6 space-y-2">
                        <div className="flex gap-2 items-center">
                          <Select
                            value={aiConfig.model}
                            onValueChange={handleModelChange}
                            disabled={fetchingModels}>
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                availableModels[aiConfig.provider] ||
                                currentProvider?.models ||
                                []
                              ).map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {currentProvider?.supportsModelFetch &&
                            aiConfig.apiKeys?.[
                              aiConfig.provider as keyof typeof aiConfig.apiKeys
                            ] && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const provider = AI_PROVIDERS.find(
                                    (p) => p.id === aiConfig.provider
                                  )
                                  const apiKey =
                                    aiConfig.apiKeys?.[
                                      aiConfig.provider as keyof typeof aiConfig.apiKeys
                                    ]
                                  if (provider && apiKey) {
                                    fetchModels(provider, apiKey).then(
                                      (models) => {
                                        setAvailableModels((prev) => ({
                                          ...prev,
                                          [provider.id]: models
                                        }))
                                      }
                                    )
                                  }
                                }}
                                disabled={fetchingModels}>
                                {fetchingModels
                                  ? t("refreshing")
                                  : t("refresh")}
                              </Button>
                            )}
                        </div>

                        {fetchingModels && (
                          <p className="text-xs text-muted-foreground ml-0">
                            {t("fetchingModels")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="custom" id="custom-model" />
                      <Label htmlFor="custom-model" className="cursor-pointer">
                        {t("useCustomModel")}
                      </Label>
                    </div>

                    {useCustomModel && (
                      <div className="ml-6">
                        <Input
                          value={aiConfig.customModel || aiConfig.model}
                          onChange={(e) => handleModelChange(e.target.value)}
                          placeholder={t("enterCustomModelName")}
                        />
                      </div>
                    )}
                  </div>
                </RadioGroup>

                <p className="text-xs text-muted-foreground">
                  {currentProvider?.supportsModelFetch
                    ? t("supportsAutoFetchModels")
                    : t("notSupportsAutoFetchModels")}
                </p>
              </div>

              {currentProvider?.baseUrl && (
                <div className="space-y-2">
                  <Label htmlFor="api-address">{t("apiAddress")}</Label>
                  <Input
                    id="api-address"
                    type="text"
                    value={aiConfig.baseUrl || ""}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        baseUrl: e.target.value || undefined
                      })
                    }
                    placeholder={currentProvider.baseUrl}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("customApiAddressTip")}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reply-language">{t("aiReplyLanguage")}</Label>
                <Select
                  value={aiConfig.replyLanguage || "auto"}
                  onValueChange={(value) =>
                    setAiConfig({ ...aiConfig, replyLanguage: value })
                  }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPLY_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.id} value={lang.id}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("aiReplyLanguageTip")}
                </p>
              </div>
            </>
          )}

          <div className="pt-4">
            <Button
              onClick={saveConfig}
              disabled={saving}
              variant={saved ? "default" : "default"}
              className={saved ? "bg-green-600 hover:bg-green-700" : ""}>
              {saving ? t("saving") : saved ? t("saved") : t("saveConfig")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("usageInstructions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href="https://github.com/SSShooter/Video-Summary/blob/master/guide/index.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline">
            https://github.com/SSShooter/Video-Summary/blob/master/guide/index.md
          </a>
        </CardContent>
      </Card>
    </div>
  )
}

export default OptionsPage

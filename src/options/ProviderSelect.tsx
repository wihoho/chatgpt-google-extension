import { Button, Input, Select, Spinner, Tabs, useInput, useToasts } from '@geist-ui/core'
import { FC, useCallback, useState, useEffect } from 'react'
import useSWR from 'swr'
import { getProviderConfigs, ProviderConfigs, ProviderType, saveProviderConfigs, getKeyConfigInfo } from '../config'
import { isDefaultKey } from '../secure-keys'

interface ConfigProps {
  config: ProviderConfigs
  models: { gpt3: string[], gemini: string[] }
}

async function loadModels(): Promise<{ gpt3: string[], gemini: string[] }> {
  return {
    gpt3: ['gpt-3.5-turbo-instruct', 'babbage-002', 'davinci-002'],
    gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']
  }
}

const ConfigPanel: FC<ConfigProps> = ({ config, models }) => {
  const [tab, setTab] = useState<ProviderType>(config.provider)
  const { bindings: gpt3ApiKeyBindings } = useInput(config.configs[ProviderType.GPT3]?.apiKey ?? '')
  const { bindings: geminiApiKeyBindings } = useInput(config.configs[ProviderType.GEMINI]?.apiKey ?? '')
  const [gpt3Model, setGpt3Model] = useState(config.configs[ProviderType.GPT3]?.model ?? models.gpt3[0])
  const [geminiModel, setGeminiModel] = useState(config.configs[ProviderType.GEMINI]?.model ?? models.gemini[0])
  const [keyConfigInfo, setKeyConfigInfo] = useState<{
    isUsingDefault: boolean
    provider: ProviderType
    hasUserKey: boolean
  } | null>(null)
  const { setToast } = useToasts()

  // Load key configuration info
  useEffect(() => {
    getKeyConfigInfo().then(setKeyConfigInfo).catch(console.error)
  }, [tab, gpt3ApiKeyBindings.value, geminiApiKeyBindings.value])

  // Helper function to check if current tab is using default key
  const isCurrentTabUsingDefault = useCallback(() => {
    if (!keyConfigInfo) return false

    if (tab === ProviderType.GPT3) {
      const userKey = gpt3ApiKeyBindings.value
      return !userKey || isDefaultKey(userKey)
    } else if (tab === ProviderType.GEMINI) {
      const userKey = geminiApiKeyBindings.value
      return !userKey || isDefaultKey(userKey)
    }

    return false
  }, [tab, gpt3ApiKeyBindings.value, geminiApiKeyBindings.value, keyConfigInfo])

  // Warning component for shared keys
  const SharedKeyWarning = () => {
    if (!isCurrentTabUsingDefault()) return null

    const isOpenAITab = tab === ProviderType.GPT3
    const hasWorkingKey = true // Both OpenAI and Gemini now have working default keys

    return (
      <div style={{
        backgroundColor: hasWorkingKey ? '#fff3cd' : '#fff3cd',
        border: `1px solid ${hasWorkingKey ? '#ffeaa7' : '#ffeaa7'}`,
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '16px',
        fontSize: '14px'
      }}>
        <div style={{ fontWeight: 'bold', color: '#856404', marginBottom: '8px' }}>
          ⚠️ Using Shared API Key
        </div>
        <div style={{ color: '#856404', lineHeight: '1.4' }}>
          You're currently using a shared API key. This may result in:
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Rate limiting during high usage periods</li>
            <li>Slower response times</li>
            <li>Potential service interruptions</li>
          </ul>
          <strong>For best performance, configure your own API key below.</strong>
        </div>
      </div>
    )
  }

  const save = useCallback(async () => {
    // Validate model selection (API keys are optional since we have defaults)
    if (tab === ProviderType.GPT3) {
      if (!gpt3Model || !models.gpt3.includes(gpt3Model)) {
        alert('Please select a valid OpenAI model')
        return
      }
    } else if (tab === ProviderType.GEMINI) {
      if (!geminiModel || !models.gemini.includes(geminiModel)) {
        alert('Please select a valid Gemini model')
        return
      }
    }

    await saveProviderConfigs(tab, {
      [ProviderType.GPT3]: tab === ProviderType.GPT3 ? {
        model: gpt3Model,
        apiKey: gpt3ApiKeyBindings.value,
      } : config.configs[ProviderType.GPT3],
      [ProviderType.GEMINI]: tab === ProviderType.GEMINI ? {
        model: geminiModel,
        apiKey: geminiApiKeyBindings.value,
      } : config.configs[ProviderType.GEMINI],
    })
    setToast({ text: 'Changes saved', type: 'success' })
  }, [gpt3ApiKeyBindings.value, geminiApiKeyBindings.value, gpt3Model, geminiModel, models, setToast, tab, config.configs])

  return (
    <div className="flex flex-col gap-3">
      <div style={{
        backgroundColor: '#e7f3ff',
        border: '1px solid #b3d9ff',
        borderRadius: '6px',
        padding: '12px',
        fontSize: '14px',
        marginBottom: '16px'
      }}>
        <div style={{ fontWeight: 'bold', color: '#0066cc', marginBottom: '4px' }}>
          ℹ️ AI Provider Selection
        </div>
        <div style={{ color: '#0066cc', lineHeight: '1.4' }}>
          You can choose any provider below. The extension will work immediately with default keys,
          but you can add your own API keys for better performance and no rate limiting.
        </div>
      </div>
      <Tabs value={tab} onChange={(v) => setTab(v as ProviderType)}>
        <Tabs.Item label="OpenAI API (Works Immediately)" value={ProviderType.GPT3}>
          <div className="flex flex-col gap-2">
            <SharedKeyWarning />
            <span>
              OpenAI official API, more stable,{' '}
              <span className="font-semibold">charge by usage</span>
              <br />
              <em style={{ color: '#28a745', fontSize: '12px' }}>
                ✓ Works immediately with default key - add your own for better performance
              </em>
            </span>
            <div className="flex flex-row gap-2">
              <Select
                scale={2 / 3}
                value={gpt3Model}
                onChange={(v) => setGpt3Model(v as string)}
                placeholder="model"
              >
                {models.gpt3.map((m) => (
                  <Select.Option key={m} value={m}>
                    {m}
                  </Select.Option>
                ))}
              </Select>
              <Input htmlType="password" label="API key" scale={2 / 3} {...gpt3ApiKeyBindings} />
            </div>
            <span className="italic text-xs">
              You can find or create your API key{' '}
              <a
                href="https://platform.openai.com/account/api-keys"
                target="_blank"
                rel="noreferrer"
              >
                here
              </a>
            </span>
          </div>
        </Tabs.Item>
        <Tabs.Item label="Gemini 2.5 (Works Immediately)" value={ProviderType.GEMINI}>
          <div className="flex flex-col gap-2">
            <SharedKeyWarning />
            <span>
              Google's Gemini API, potentially more accurate but possibly slower,{' '}
              <span className="font-semibold">charge by usage</span>
              <br />
              <em style={{ color: '#28a745', fontSize: '12px' }}>
                ✓ Works immediately with default key - add your own for better performance
              </em>
            </span>
            <div className="flex flex-row gap-2">
              <Select
                scale={2 / 3}
                value={geminiModel}
                onChange={(v) => setGeminiModel(v as string)}
                placeholder="model"
              >
                {models.gemini.map((m) => (
                  <Select.Option key={m} value={m}>
                    {m}
                  </Select.Option>
                ))}
              </Select>
              <Input htmlType="password" label="API key" scale={2 / 3} {...geminiApiKeyBindings} />
            </div>
            <span className="italic text-xs">
              You can get your API key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
              >
                Google AI Studio
              </a>
            </span>
          </div>
        </Tabs.Item>
      </Tabs>
      <Button scale={2 / 3} ghost style={{ width: 20 }} type="success" onClick={save}>
        Save
      </Button>
    </div>
  )
}

function ProviderSelect() {
  const query = useSWR('provider-configs', async () => {
    const [config, models] = await Promise.all([getProviderConfigs(), loadModels()])
    return { config, models }
  })
  if (query.isLoading) {
    return <Spinner />
  }
  return <ConfigPanel config={query.data!.config} models={query.data!.models} />
}

export default ProviderSelect

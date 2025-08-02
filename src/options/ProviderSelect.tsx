import { Button, Input, Select, Spinner, Tabs, useInput, useToasts } from '@geist-ui/core'
import { FC, useCallback, useState } from 'react'
import useSWR from 'swr'
import { getProviderConfigs, ProviderConfigs, ProviderType, saveProviderConfigs } from '../config'

interface ConfigProps {
  config: ProviderConfigs
  models: { gpt3: string[], gemini: string[] }
}

async function loadModels(): Promise<{ gpt3: string[], gemini: string[] }> {
  return {
    gpt3: ['gpt-3.5-turbo-instruct', 'babbage-002', 'davinci-002'],
    gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro']
  }
}

const ConfigPanel: FC<ConfigProps> = ({ config, models }) => {
  const [tab, setTab] = useState<ProviderType>(config.provider)
  const { bindings: gpt3ApiKeyBindings } = useInput(config.configs[ProviderType.GPT3]?.apiKey ?? '')
  const { bindings: geminiApiKeyBindings } = useInput(config.configs[ProviderType.GEMINI]?.apiKey ?? '')
  const [gpt3Model, setGpt3Model] = useState(config.configs[ProviderType.GPT3]?.model ?? models.gpt3[0])
  const [geminiModel, setGeminiModel] = useState(config.configs[ProviderType.GEMINI]?.model ?? models.gemini[0])
  const { setToast } = useToasts()

  const save = useCallback(async () => {
    if (tab === ProviderType.GPT3) {
      if (!gpt3ApiKeyBindings.value) {
        alert('Please enter your OpenAI API key')
        return
      }
      if (!gpt3Model || !models.gpt3.includes(gpt3Model)) {
        alert('Please select a valid OpenAI model')
        return
      }
    } else if (tab === ProviderType.GEMINI) {
      if (!geminiApiKeyBindings.value) {
        alert('Please enter your Gemini API key')
        return
      }
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
      <Tabs value={tab} onChange={(v) => setTab(v as ProviderType)}>
        <Tabs.Item label="OpenAI API" value={ProviderType.GPT3}>
          <div className="flex flex-col gap-2">
            <span>
              OpenAI official API, more stable,{' '}
              <span className="font-semibold">charge by usage</span>
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
        <Tabs.Item label="Gemini 2.5 Flash" value={ProviderType.GEMINI}>
          <div className="flex flex-col gap-2">
            <span>
              Google's Gemini API, potentially more accurate but possibly slower,{' '}
              <span className="font-semibold">charge by usage</span>
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

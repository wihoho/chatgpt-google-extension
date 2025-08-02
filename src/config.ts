import { defaults } from 'lodash-es'
import Browser from 'webextension-polyfill'
import { OpenAIProvider } from './background/providers/openai'

export enum TriggerMode {
  Always = 'always',
  QuestionMark = 'questionMark',
  Manually = 'manually',
}

export const TRIGGER_MODE_TEXT = {
  [TriggerMode.Always]: { title: 'Always', desc: 'ChatGPT is queried on every search' },
  [TriggerMode.QuestionMark]: {
    title: 'Question Mark',
    desc: 'When your query ends with a question mark (?)',
  },
  [TriggerMode.Manually]: {
    title: 'Manually',
    desc: 'ChatGPT is queried when you manually click a button',
  },
}

export enum Theme {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

export enum Language {
  Auto = 'auto',
  English = 'english',
  Chinese = 'chinese',
  Spanish = 'spanish',
  French = 'french',
  Korean = 'korean',
  Japanese = 'japanese',
  German = 'german',
  Portuguese = 'portuguese',
}

const userConfigWithDefaultValue = {
  triggerMode: TriggerMode.Always,
  theme: Theme.Auto,
  language: Language.Auto,
}

export type UserConfig = typeof userConfigWithDefaultValue

export async function getUserConfig(): Promise<UserConfig> {
  const result = await Browser.storage.local.get(Object.keys(userConfigWithDefaultValue))
  return defaults(result, userConfigWithDefaultValue)
}

export async function updateUserConfig(updates: Partial<UserConfig>) {
  console.debug('update configs', updates)
  return Browser.storage.local.set(updates)
}

export enum ProviderType {
  GPT3 = 'gpt3',
  GEMINI = 'gemini',
}

interface GPT3ProviderConfig {
  model: string
  apiKey: string
}

interface GeminiProviderConfig {
  model: string
  apiKey: string
}

export interface ProviderConfigs {
  provider: ProviderType
  configs: {
    [ProviderType.GPT3]: GPT3ProviderConfig | undefined
    [ProviderType.GEMINI]: GeminiProviderConfig | undefined
  }
}

export async function getProviderConfigs(): Promise<ProviderConfigs> {
  const { provider = ProviderType.GPT3 } = await Browser.storage.local.get('provider')
  const gpt3ConfigKey = `provider:${ProviderType.GPT3}`
  const geminiConfigKey = `provider:${ProviderType.GEMINI}`
  const result = await Browser.storage.local.get([gpt3ConfigKey, geminiConfigKey])
  return {
    provider,
    configs: {
      [ProviderType.GPT3]: result[gpt3ConfigKey],
      [ProviderType.GEMINI]: result[geminiConfigKey],
    },
  }
}

export async function getProvider(): Promise<OpenAIProvider | import('./background/providers/gemini').GeminiProvider> {
  const configs = await getProviderConfigs()

  if (configs.provider === ProviderType.GEMINI && configs.configs[ProviderType.GEMINI]) {
    const { GeminiProvider } = await import('./background/providers/gemini')
    return new GeminiProvider(
      configs.configs[ProviderType.GEMINI].apiKey,
      configs.configs[ProviderType.GEMINI].model
    )
  }

  // Default to OpenAI (fallback or when GPT3 is selected)
  const gpt3Config = configs.configs[ProviderType.GPT3]
  if (gpt3Config && gpt3Config.apiKey) {
    return new OpenAIProvider(gpt3Config.apiKey, gpt3Config.model)
  }

  // No valid configuration found
  throw new Error('No AI provider configured. Please set up your API key in the extension settings.')
}

export async function saveProviderConfigs(
  provider: ProviderType,
  configs: ProviderConfigs['configs'],
) {
  return Browser.storage.local.set({
    provider,
    [`provider:${ProviderType.GPT3}`]: configs[ProviderType.GPT3],
    [`provider:${ProviderType.GEMINI}`]: configs[ProviderType.GEMINI],
  })
}

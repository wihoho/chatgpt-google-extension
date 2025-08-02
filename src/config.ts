import { defaults } from 'lodash-es'
import Browser from 'webextension-polyfill'
import { OpenAIProvider } from './background/providers/openai'
import { getDefaultKeyForProvider, isDefaultKey } from './secure-keys'

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

  console.log('[Config] Provider selection requested:', {
    selectedProvider: configs.provider,
    hasGeminiConfig: !!configs.configs[ProviderType.GEMINI],
    hasOpenAIConfig: !!configs.configs[ProviderType.GPT3]
  })

  if (configs.provider === ProviderType.GEMINI) {
    const { GeminiProvider } = await import('./background/providers/gemini')
    const geminiConfig = configs.configs[ProviderType.GEMINI]

    // Use user's API key if available, otherwise use default
    const apiKey = geminiConfig?.apiKey || getDefaultKeyForProvider('gemini')
    const model = geminiConfig?.model || 'gemini-2.5-flash'
    const isUsingDefaultKey = !geminiConfig?.apiKey

    console.log('[Config] Creating Gemini provider:', {
      model,
      isUsingDefaultKey,
      keySource: isUsingDefaultKey ? 'default' : 'user'
    })

    return new GeminiProvider(apiKey, model)
  }

  // For OpenAI provider
  const gpt3Config = configs.configs[ProviderType.GPT3]

  // Check if user has their own OpenAI key
  if (gpt3Config?.apiKey) {
    const model = gpt3Config.model || 'gpt-3.5-turbo-instruct'
    console.log('[Config] Creating OpenAI provider with user key:', {
      model,
      keySource: 'user',
      isUsingDefaultKey: false
    })
    return new OpenAIProvider(gpt3Config.apiKey, model)
  }

  // If no user OpenAI key, check if default key is valid
  const defaultOpenAIKey = getDefaultKeyForProvider('openai')
  const isValidOpenAIKey = defaultOpenAIKey && !defaultOpenAIKey.includes('demo') && defaultOpenAIKey.startsWith('sk-')

  if (!isValidOpenAIKey) {
    console.warn('[Config] No valid OpenAI key available (default is invalid), falling back to Gemini provider')
    const { GeminiProvider } = await import('./background/providers/gemini')
    const geminiConfig = configs.configs[ProviderType.GEMINI]
    const apiKey = geminiConfig?.apiKey || getDefaultKeyForProvider('gemini')
    const model = geminiConfig?.model || 'gemini-2.5-flash'
    const isUsingDefaultKey = !geminiConfig?.apiKey

    console.log('[Config] Creating Gemini provider (fallback from OpenAI):', {
      model,
      isUsingDefaultKey,
      keySource: isUsingDefaultKey ? 'default' : 'user',
      reason: 'OpenAI key unavailable'
    })

    return new GeminiProvider(apiKey, model)
  }

  // Use default OpenAI key as last resort (though this shouldn't happen with demo key)
  const model = gpt3Config?.model || 'gpt-3.5-turbo-instruct'
  console.log('[Config] Creating OpenAI provider with default key:', {
    model,
    keySource: 'default',
    isUsingDefaultKey: true,
    warning: 'Using demo key - may not work'
  })

  return new OpenAIProvider(defaultOpenAIKey, model)
}

/**
 * Checks if the current provider is using a default (shared) API key
 */
export async function isUsingDefaultKey(): Promise<boolean> {
  const configs = await getProviderConfigs()

  if (configs.provider === ProviderType.GEMINI) {
    const geminiConfig = configs.configs[ProviderType.GEMINI]
    const apiKey = geminiConfig?.apiKey || getDefaultKeyForProvider('gemini')
    return isDefaultKey(apiKey)
  } else {
    const gpt3Config = configs.configs[ProviderType.GPT3]
    const apiKey = gpt3Config?.apiKey || getDefaultKeyForProvider('openai')
    return isDefaultKey(apiKey)
  }
}

/**
 * Gets information about the current API key configuration
 */
export async function getKeyConfigInfo(): Promise<{
  isUsingDefault: boolean
  provider: ProviderType
  hasUserKey: boolean
}> {
  const configs = await getProviderConfigs()
  const isUsingDefault = await isUsingDefaultKey()

  let hasUserKey = false
  if (configs.provider === ProviderType.GEMINI) {
    hasUserKey = !!(configs.configs[ProviderType.GEMINI]?.apiKey)
  } else {
    hasUserKey = !!(configs.configs[ProviderType.GPT3]?.apiKey)
  }

  return {
    isUsingDefault,
    provider: configs.provider,
    hasUserKey
  }
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

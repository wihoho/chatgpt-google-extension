import Browser, { Menus } from 'webextension-polyfill'
import { getProviderConfigs, ProviderType } from '../config'
import { ChatGPTProvider, getChatGPTAccessToken, sendMessageFeedback } from './providers/chatgpt'
import { OpenAIProvider } from './providers/openai'
import { Provider } from './types'

async function generateAnswers(port: Browser.Runtime.Port, question: string) {
  const providerConfigs = await getProviderConfigs()

  let provider: Provider
  if (providerConfigs.provider === ProviderType.ChatGPT) {
    const token = await getChatGPTAccessToken()
    provider = new ChatGPTProvider(token)
  } else if (providerConfigs.provider === ProviderType.GPT3) {
    const { apiKey, model } = providerConfigs.configs[ProviderType.GPT3]!
    provider = new OpenAIProvider(apiKey, model)
  } else {
    throw new Error(`Unknown provider ${providerConfigs.provider}`)
  }

  const controller = new AbortController()
  port.onDisconnect.addListener(() => {
    controller.abort()
    cleanup?.()
  })

  const { cleanup } = await provider.generateAnswer({
    prompt: question,
    signal: controller.signal,
    onEvent(event) {
      if (event.type === 'done') {
        port.postMessage({ event: 'DONE' })
        return
      }
      port.postMessage(event.data)
    },
  })
}

Browser.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (msg) => {
    console.debug('received msg', msg)
    try {
      await generateAnswers(port, msg.question)
    } catch (err: any) {
      console.error(err)
      port.postMessage({ error: err.message })
    }
  })
})

Browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'FEEDBACK') {
    const token = await getChatGPTAccessToken()
    await sendMessageFeedback(token, message.data)
  } else if (message.type === 'OPEN_OPTIONS_PAGE') {
    Browser.runtime.openOptionsPage()
  } else if (message.type === 'GET_ACCESS_TOKEN') {
    return getChatGPTAccessToken()
  }
})

Browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    Browser.runtime.openOptionsPage()
  }
})

// Define the context menu properties
const contextMenuProperties: Menus.CreateCreatePropertiesType = {
  id: 'add-to-calendar',
  title: 'Add to calendar',
  contexts: ['page', 'selection'], // Contexts where the menu will appear
}

// Create the context menu item
Browser.contextMenus.create(contextMenuProperties)

// Define a function to open a new window
async function openNewWindow(url: string) {
  try {
    // Create a new window
    const windowInfo = await Browser.windows.create({
      type: 'panel', // You can use 'popup', 'normal', 'panel', or 'detached_panel'
      url: url,
    })

    // Log the window information (optional)
    console.log('New window created:', windowInfo)
  } catch (error) {
    console.error('Error opening a new window:', error)
  }
}

const prompt = `
Your output should use the following template in json:
{
startDate: "20201231T193000"
endDate: "20201231T203000"
title: "consulation visit"
}

Imaging you are trying to schedule some events based on text with below requirements:
1. Only output the date time and event title in json format
2. No other information except for this json. This is very important.
3. Try to make sure the title is as detailed as possible. 
4. Use the following content: {{CONTENT}}

Content:
`
let previousResult = ''

async function extractDate(info: string) {
  const providerConfigs = await getProviderConfigs()

  let provider: Provider
  if (providerConfigs.provider === ProviderType.ChatGPT) {
    const token = await getChatGPTAccessToken()
    provider = new ChatGPTProvider(token)
  } else if (providerConfigs.provider === ProviderType.GPT3) {
    const { apiKey, model } = providerConfigs.configs[ProviderType.GPT3]!
    provider = new OpenAIProvider(apiKey, model)
  } else {
    throw new Error(`Unknown provider ${providerConfigs.provider}`)
  }

  await provider.generateAnswer({
    prompt: prompt + info,
    onEvent(event) {
      console.log(event)

      if (event.type === 'done') {
        const jsonObject = JSON.parse(previousResult)
        console.log(jsonObject)

        const url =
          'https://www.google.com/calendar/event?action=TEMPLATE&text=' +
          encodeURIComponent(jsonObject.title) +
          '&dates=' +
          jsonObject.startDate +
          '/' +
          jsonObject.endDate
        openNewWindow(url)
        console.log(url)
      }

      if (event.type === 'answer') {
        previousResult = event.data.text
      }
    },
  })
}

// Add an event listener for when the menu item is clicked
Browser.contextMenus.onClicked.addListener((info, tab) => {
  const sText = info.selectionText || ''
  extractDate(sText)
})

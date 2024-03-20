import Browser, { Menus } from 'webextension-polyfill'
import { getProviderConfigs, ProviderType } from '../config'
import { ChatGPTProvider, getChatGPTAccessToken } from './providers/chatgpt'
import { OpenAIProvider } from './providers/openai'
import { Provider } from './types'

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
        const jsonObject = extractAndParseJSONFromString(previousResult)
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

function extractAndParseJSONFromString(inputString: string) {
  const jsonRegex = /{[^}]*}/
  const match = inputString.match(jsonRegex)

  if (match) {
    const jsonString = match[0]
    try {
      const jsonObject = JSON.parse(jsonString)
      return jsonObject
    } catch (error) {
      console.error('Invalid JSON string:', error)
      return null
    }
  } else {
    console.error('No JSON content found in the input string.')
    return null
  }
}

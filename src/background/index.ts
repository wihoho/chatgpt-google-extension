import Browser, { Menus } from 'webextension-polyfill'
import { getProviderConfigs, ProviderType } from '../config'
import { OpenAIProvider } from './providers/openai'
import { Provider } from './types'

const BADGE_COLOR_LOADING = '#FFA500' // Orange
const BADGE_COLOR_ERROR = '#FF0000' // Red
const BADGE_TEXT_LOADING = '...'
const BADGE_TEXT_ERROR = 'ERR'

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
Extract event details (title, start date/time, end date/time, location, description) from the following text.

**Output Requirements:**
1.  Format the output STRICTLY as a single JSON object. Do NOT include any other text, greetings, or explanations before or after the JSON object.
2.  The JSON object MUST contain the keys: "title", "startDate", "endDate", "location", "description".
3.  If a value for a key cannot be reasonably extracted from the text, use the JSON value \`null\` for that key (e.g., \`"location": null\`). Do not use empty strings "" unless the text explicitly implies an empty value.
4.  location MUST NOT be a nested JSON object.

**Date/Time Formatting Rules (CRITICAL - Follow Format Exactly):**
*   **For events with a specific time:**
    *   Use the **exact** format **\`YYYY-MM-DDTHH:mm:ss\`**.
    *   Include hyphens (-) between date parts and colons (:) between time parts.
    *   **CRITICAL: Do NOT include 'Z', '+HH:mm', '-HH:mm', or any other timezone suffix.** The output must represent the local time interpretation only. Ignore any timezone information like "UTC", "GMT", or numerical offsets found in the input text when formatting the output string.
    *   Example: If the text says "2 PM", output the time part as \`T14:00:00\`. If the text says "9 AM UTC" or "9 AM -05:00", still output the time part as \`T09:00:00\`.
*   **For all-day events** (where only a date is found), use the **exact** format **\`YYYY-MM-DD\`**.
    *   Example: \`"2024-08-15"\`
*   **Handling Missing Info:**
    *   If a start time is found but no end time, calculate the end time by adding exactly 1 hour to the start time. Format both \`startDate\` and \`endDate\` using the strict \`YYYY-MM-DDTHH:mm:ss\` rule above (no suffix).
    *   If only a start date (all-day) is found but no end date, use the same date for both \`startDate\` and \`endDate\` in \`YYYY-MM-DD\` format.
    *   If no year is specified in the text, assume the current year.

**Example Output Structures:**
*   Specific time event (e.g., from "Meeting 3pm"): \`{"title": "Meeting", "startDate": "2024-09-05T15:00:00", "endDate": "2024-09-05T16:00:00", "location": null, "description": null}\`
*   Specific time event (e.g., from "Webinar 10am UTC"): \`{"title": "Webinar", "startDate": "2024-09-06T10:00:00", "endDate": "2024-09-06T11:00:00", "location": "Online", "description": null}\` (Note: no 'Z' in output)
*   All-day event: \`{"title": "Public Holiday", "startDate": "2024-12-25", "endDate": "2024-12-25", "location": null, "description": null}\`
*   If NO details found: Return ONLY an empty JSON object: \`{}\`

Text to process:
'\${text}'
`

let previousResult = ''

async function extractDate(info: string) {
  // Clear any previous badge state immediately
  Browser.action.setBadgeText({ text: '' })

  // --- Show Spinner ---
  Browser.action.setBadgeText({ text: BADGE_TEXT_LOADING })
  Browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR_LOADING })

  const providerConfigs = await getProviderConfigs()

  let provider: Provider

  if (providerConfigs.provider === ProviderType.GPT3) {
    provider = new OpenAIProvider('', 'gpt-3.5-turbo-instruct')
  } else {
    throw new Error(`Unknown provider ${providerConfigs.provider}`)
  }

  await provider.generateAnswer({
    prompt: prompt + info, // Ensure prompt asks for JSON with keys: title, startDate, endDate, location, description
    onEvent(event) {
      console.log(event)

      if (event.type === 'done') {
        console.log('previousResult: %s', previousResult)
        const jsonObject = extractAndParseJSONFromString(previousResult)
        console.log('jsonObject:', jsonObject)

        if (!jsonObject || typeof jsonObject !== 'object' || Object.keys(jsonObject).length === 0) {
          console.error('Failed to parse valid JSON object or received empty object from AI.')
          // Notify user?
          return
        }

        // --- Format Dates using the new function ---
        const formattedStartDate = formatDateTimeForGoogle(jsonObject.startDate) // Handles parsing, year adjust, formatting
        const formattedEndDate = formatDateTimeForGoogle(jsonObject.endDate) // Handles parsing, year adjust, formatting

        // --- Refined URL Construction ---
        const calendarUrl = new URL('https://www.google.com/calendar/event')
        calendarUrl.searchParams.set('action', 'TEMPLATE')

        // Title
        if (jsonObject.title) {
          calendarUrl.searchParams.set('text', jsonObject.title)
        } else {
          calendarUrl.searchParams.set('text', 'Event from Text') // Default title
        }

        // Dates (Handling All-Day logic)
        let dateParamValue = null
        if (formattedStartDate) {
          const startIsAllDay = formattedStartDate.length === 8 // Check if format is YYYYMMDD

          if (formattedEndDate) {
            const endIsAllDay = formattedEndDate.length === 8
            if (startIsAllDay && endIsAllDay) {
              // All-day event range: Google needs YYYYMMDD/YYYYMMDD+1
              dateParamValue = `${formattedStartDate}/${calculateNextDay(formattedEndDate)}`
            } else {
              // Specific time range
              dateParamValue = `${formattedStartDate}/${formattedEndDate}`
            }
          } else {
            // Only start date provided
            if (startIsAllDay) {
              // Single all-day event: Google needs YYYYMMDD/YYYYMMDD+1
              dateParamValue = `${formattedStartDate}/${calculateNextDay(formattedStartDate)}`
            } else {
              // Start time only (Google usually defaults to 1-hour duration)
              dateParamValue = formattedStartDate
            }
          }
        }

        if (dateParamValue) {
          calendarUrl.searchParams.set('dates', dateParamValue)
        } else {
          console.error('Could not determine valid dates for the calendar event.')
          // Notify user?
          return // Cannot create event without dates
        }

        // Location
        if (jsonObject.location) {
          calendarUrl.searchParams.set('location', jsonObject.location)
        }

        // Details (Description)
        let detailsText = ''
        if (jsonObject.description) {
          detailsText += jsonObject.description
        }
        // Add original text for context if available
        if (info) {
          detailsText += (detailsText ? '\n\n' : '') + `Original Text:\n${info}`
        }
        if (detailsText) {
          calendarUrl.searchParams.set('details', detailsText)
        }
        // --- End Refined URL Construction ---

        const finalUrl = calendarUrl.toString()
        openNewWindow(finalUrl)
        console.log('Generated URL:', finalUrl)

        // Clear badge on successful completion of processing
        Browser.action.setBadgeText({ text: '' })
      }

      if (event.type === 'answer') {
        // Accumulate result if streaming, otherwise just set it
        // Assuming the last 'answer' event before 'done' contains the full text
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

// function extractAndParseJSONFromString(inputString: string) {
//   const jsonRegex = /{[^}]*}/
//   const match = inputString.match(jsonRegex)

//   if (match) {
//     const jsonString = match[0]
//     try {
//       const jsonObject = JSON.parse(jsonString)
//       return jsonObject
//     } catch (error) {
//       console.error('Invalid JSON string:', error)
//       return null
//       }
//   } else {
//     console.error('No JSON content found in the input string.')
//     return null
//   }
// }

/**
 * Parses a date/time string (potentially from AI) and formats it
 * for Google Calendar URL parameters (YYYYMMDD or YYYYMMDDTHHmmssZ).
 * Also adjusts past years to the current year as a heuristic.
 *
 * @param {string | null} dateTimeString The date/time string to parse (e.g., "2020-03-30T12:15:00", "2024-07-15").
 * @param {boolean} [adjustPastYears=true] Whether to adjust years prior to the current year.
 * @returns {string | null} The formatted date string or null if parsing fails.
 */
function formatDateTimeForGoogle(dateTimeString, adjustPastYears = true) {
  if (!dateTimeString) {
    return null
  }

  try {
    // Attempt to parse the date string. Handles ISO 8601 variations.
    // IMPORTANT: new Date() parsing without 'Z' or offset assumes LOCAL time.
    const date = new Date(dateTimeString)

    // Check if parsing resulted in a valid date
    if (isNaN(date.getTime())) {
      console.warn(`Could not parse date string: ${dateTimeString}`)
      // Maybe try a fallback regex if needed for formats like YYYYMMDDTHHmmss
      // Example fallback (use cautiously):
      // const match = dateTimeString.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
      // if (match) {
      //    date = new Date(Date.UTC(match[1], match[2]-1, match[3], match[4], match[5], match[6]));
      //    if (isNaN(date.getTime())) { return null; } // Check again
      // } else {
      return null // Give up if invalid
      // }
    }

    const currentYear = new Date().getFullYear()
    const inputYear = date.getFullYear()

    // Adjust year if it's in the past (heuristic)
    if (adjustPastYears && inputYear < currentYear) {
      // This assumes a past year from the AI means the user likely didn't specify
      // a year and intended the current/upcoming instance of that date.
      console.warn(
        `Adjusting past year (${inputYear}) to current year (${currentYear}) for date: ${dateTimeString}`,
      )
      date.setFullYear(currentYear)
      // Re-check validity after potential year change (though unlikely to fail here)
      if (isNaN(date.getTime())) {
        console.error('Date became invalid after year adjustment.')
        return null
      }
    }

    // Determine if it's an all-day event based on the *original* string format.
    // Check for YYYY-MM-DD format specifically.
    const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(dateTimeString)

    if (isAllDay) {
      // Format as YYYYMMDD
      const year = date.getFullYear().toString()
      const month = (date.getMonth() + 1).toString().padStart(2, '0') // Month is 0-indexed
      const day = date.getDate().toString().padStart(2, '0')
      return `${year}${month}${day}`
    } else {
      // Format as YYYYMMDDTHHmmssZ (UTC)
      // Use UTC methods to avoid timezone issues from the initial local parsing
      const year = date.getUTCFullYear().toString()
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
      const day = date.getUTCDate().toString().padStart(2, '0')
      const hours = date.getUTCHours().toString().padStart(2, '0')
      const minutes = date.getUTCMinutes().toString().padStart(2, '0')
      const seconds = date.getUTCSeconds().toString().padStart(2, '0')
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
    }
  } catch (error) {
    console.error(`Error formatting date string "${dateTimeString}":`, error)
    return null
  }
}

/**
 * Helper function to calculate the day after a given date in YYYYMMDD format.
 * Required for formatting all-day events for Google Calendar.
 * @param {string} yyyymmdd The date string in YYYYMMDD format.
 * @returns {string} The next day in YYYYMMDD format.
 */
function calculateNextDay(yyyymmdd) {
  try {
    const year = parseInt(yyyymmdd.substring(0, 4))
    const month = parseInt(yyyymmdd.substring(4, 6)) - 1 // JS months are 0-indexed
    const day = parseInt(yyyymmdd.substring(6, 8))
    const date = new Date(Date.UTC(year, month, day)) // Use UTC to avoid timezone shifts affecting the date
    date.setUTCDate(date.getUTCDate() + 1) // Add one day

    const nextYear = date.getUTCFullYear().toString()
    const nextMonth = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const nextDay = date.getUTCDate().toString().padStart(2, '0')
    return `${nextYear}${nextMonth}${nextDay}`
  } catch (e) {
    console.error('Error calculating next day:', e)
    return yyyymmdd // Fallback to original date
  }
}

/**
 * Extracts a JSON object string potentially embedded within a larger text,
 * attempts to fix common syntax issues (like single quotes), and parses it.
 *
 * @param {string} rawString The raw string possibly containing JSON.
 * @returns {object | null} The parsed JSON object or null if extraction/parsing fails.
 */
function extractAndParseJSONFromString(rawString) {
  if (!rawString || typeof rawString !== 'string') {
    console.error('Input to extractAndParseJSONFromString was not a valid string:', rawString)
    return null
  }

  try {
    // 1. Find the first '{' and the last '}'
    const startIndex = rawString.indexOf('{')
    const endIndex = rawString.lastIndexOf('}')

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      console.warn('Could not find JSON-like structure ({...}) in the string:', rawString)
      // Optional: Could try finding ```json ... ``` blocks too
      return null
    }

    // 2. Extract the potential JSON substring
    let jsonString = rawString.substring(startIndex, endIndex + 1)
    console.log('Extracted potential JSON substring:', jsonString)

    // 3. Attempt to fix common issues: Replace single quotes with double quotes
    // WARNING: This is a common heuristic for LLM outputs but can break
    // if the *actual string values* within the JSON contain single quotes (e.g., "it's").
    // More complex regex could be used, but this often works.
    // Also remove potential trailing commas before closing brace/bracket which are invalid JSON
    jsonString = jsonString.replace(/'/g, '"')
    jsonString = jsonString.replace(/,\s*([}\]])/g, '$1') // Remove trailing commas like ",}" or ",]"

    console.log('Attempted to fix quotes/commas:', jsonString)

    // 4. Parse the potentially fixed string
    const jsonObject = JSON.parse(jsonString)
    return jsonObject
  } catch (error) {
    console.error('Failed to parse JSON after extraction and fixing attempts:', error)
    console.error('Original raw string was:', rawString) // Log the original string that failed
    return null // Indicate failure
  }
}

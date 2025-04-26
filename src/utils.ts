import Browser from 'webextension-polyfill'
import { Theme } from './config'

export function detectSystemColorScheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return Theme.Dark
  }
  return Theme.Light
}

export function getExtensionVersion() {
  return Browser.runtime.getManifest().version
}

// src/utils.ts (or just utils.ts)

/**
 * Parses a date/time string and formats it for Google Calendar URL parameters.
 * Adjusts past years to the current year.
 */
export function formatDateTimeForGoogle(
  dateTimeString: string | null | undefined,
  adjustPastYears = true,
): string | null {
  // Ensure dateTimeString is treated as string | null for safety
  const dtString = dateTimeString ?? null
  if (!dtString) {
    return null
  }
  try {
    const date = new Date(dtString)
    if (isNaN(date.getTime())) {
      console.warn(`Could not parse date string: ${dtString}`)
      return null
    }
    const currentYear = new Date().getFullYear()
    const inputYear = date.getFullYear()
    if (adjustPastYears && inputYear < currentYear) {
      console.warn(
        `Adjusting past year (${inputYear}) to current year (${currentYear}) for date: ${dtString}`,
      )
      date.setFullYear(currentYear)
      if (isNaN(date.getTime())) {
        console.error('Date became invalid after year adjustment.')
        return null
      }
    }
    const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(dtString)
    if (isAllDay) {
      const year = date.getFullYear().toString()
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      return `${year}${month}${day}`
    } else {
      const year = date.getUTCFullYear().toString()
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
      const day = date.getUTCDate().toString().padStart(2, '0')
      const hours = date.getUTCHours().toString().padStart(2, '0')
      const minutes = date.getUTCMinutes().toString().padStart(2, '0')
      const seconds = date.getUTCSeconds().toString().padStart(2, '0')
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
    }
  } catch (error) {
    console.error(`Error formatting date string "${dtString}":`, error)
    return null
  }
}

/**
 * Calculates the day after a given date in YYYYMMDD format.
 */
export function calculateNextDay(yyyymmdd: string): string {
  try {
    const year = parseInt(yyyymmdd.substring(0, 4))
    const month = parseInt(yyyymmdd.substring(4, 6)) - 1
    const day = parseInt(yyyymmdd.substring(6, 8))
    const date = new Date(Date.UTC(year, month, day))
    date.setUTCDate(date.getUTCDate() + 1)
    const nextYear = date.getUTCFullYear().toString()
    const nextMonth = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const nextDay = date.getUTCDate().toString().padStart(2, '0')
    return `${nextYear}${nextMonth}${nextDay}`
  } catch (e) {
    console.error('Error calculating next day:', e)
    return yyyymmdd
  }
}

// Add any other pure utility functions here and export them

// src/utils.ts (Add this function and export it)

// ... (formatDateTimeForGoogle and calculateNextDay definitions) ...

// Interface for expected input (good practice with TypeScript)
interface CalendarEventDetails {
  title?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  description?: string | null
}

export function createGoogleCalendarLink_Testable(
  jsonObject: CalendarEventDetails | null,
  info = '',
): string | null {
  if (!jsonObject || typeof jsonObject !== 'object') {
    console.error('Test Error: Invalid jsonObject input')
    return null
  }

  const formattedStartDate = formatDateTimeForGoogle(jsonObject.startDate) // Uses function in same file
  const formattedEndDate = formatDateTimeForGoogle(jsonObject.endDate) // Uses function in same file

  const calendarUrl = new URL('https://www.google.com/calendar/event')
  calendarUrl.searchParams.set('action', 'TEMPLATE')
  calendarUrl.searchParams.set('text', jsonObject.title || 'Event from Text')

  let dateParamValue = null
  if (formattedStartDate) {
    const startIsAllDay = formattedStartDate.length === 8
    const endIsAllDay = formattedEndDate && formattedEndDate.length === 8
    if (formattedEndDate) {
      if (startIsAllDay && endIsAllDay) {
        dateParamValue = `${formattedStartDate}/${calculateNextDay(formattedEndDate)}` // Uses function in same file
      } else if (!startIsAllDay && !endIsAllDay) {
        dateParamValue = `${formattedStartDate}/${formattedEndDate}`
      } else {
        console.warn('TestableFn Warn: Mixed/invalid date formats. Using best guess.')
        dateParamValue = formattedEndDate
          ? `${formattedStartDate}/${formattedEndDate}`
          : formattedStartDate
      }
    } else {
      if (startIsAllDay) {
        dateParamValue = `${formattedStartDate}/${calculateNextDay(formattedStartDate)}` // Uses function in same file
      } else {
        dateParamValue = formattedStartDate
      }
    }
  }

  if (dateParamValue) {
    calendarUrl.searchParams.set('dates', dateParamValue)
  } else {
    console.error('TestableFn Error: Could not determine valid dates.')
    return null
  }

  if (jsonObject.location) {
    calendarUrl.searchParams.set('location', jsonObject.location)
  }
  let detailsText = ''
  if (jsonObject.description) detailsText += jsonObject.description
  if (info) detailsText += (detailsText ? '\n\n' : '') + `Original Text:\n${info}`
  if (detailsText) calendarUrl.searchParams.set('details', detailsText)

  return calendarUrl.toString()
}

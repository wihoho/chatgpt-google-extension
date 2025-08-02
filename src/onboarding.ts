import Browser from 'webextension-polyfill'
import { logger } from './logging'

const ONBOARDING_KEY = 'onboarding_completed'
const ONBOARDING_VERSION = '1.0.0'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  action?: string
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ChatGPT for Google Calendar!',
    description: 'This extension helps you quickly create calendar events from any text on the web using AI.',
  },
  {
    id: 'selection',
    title: 'Select Text to Create Events',
    description: 'Simply select any text that contains event information (like "Meeting tomorrow at 3 PM") and right-click to see the "Add to calendar" option.',
  },
  {
    id: 'confirmation',
    title: 'Review Before Adding',
    description: 'The extension will show you a confirmation dialog with the extracted event details. You can review and edit before adding to your calendar.',
  },
  {
    id: 'models',
    title: 'Choose Your AI Model',
    description: 'You can select between OpenAI GPT and Google Gemini models in the extension settings. Gemini 2.5 Flash may be more accurate but potentially slower.',
    action: 'Open Settings'
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start selecting text with event information and right-click to create calendar events. Check the debug logs in settings if you encounter any issues.',
  }
]

export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const result = await Browser.storage.local.get(ONBOARDING_KEY)
    const completedVersion = result[ONBOARDING_KEY]
    
    // Show onboarding if never completed or if version is different
    return !completedVersion || completedVersion !== ONBOARDING_VERSION
  } catch (error) {
    logger.error('onboarding', 'Failed to check onboarding status', undefined, error as Error)
    return true // Show onboarding if we can't determine status
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await Browser.storage.local.set({ [ONBOARDING_KEY]: ONBOARDING_VERSION })
    logger.info('onboarding', 'Onboarding marked as complete', { version: ONBOARDING_VERSION })
  } catch (error) {
    logger.error('onboarding', 'Failed to mark onboarding as complete', undefined, error as Error)
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await Browser.storage.local.remove(ONBOARDING_KEY)
    logger.info('onboarding', 'Onboarding reset')
  } catch (error) {
    logger.error('onboarding', 'Failed to reset onboarding', undefined, error as Error)
  }
}

// Show onboarding tooltip on first use
export function showOnboardingTooltip(element: HTMLElement, message: string, duration: number = 5000): void {
  const tooltip = document.createElement('div')
  tooltip.style.position = 'fixed'
  tooltip.style.backgroundColor = '#333'
  tooltip.style.color = 'white'
  tooltip.style.padding = '8px 12px'
  tooltip.style.borderRadius = '6px'
  tooltip.style.fontSize = '14px'
  tooltip.style.zIndex = '2147483647'
  tooltip.style.maxWidth = '300px'
  tooltip.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
  tooltip.style.opacity = '0'
  tooltip.style.transition = 'opacity 0.3s ease'
  tooltip.textContent = message

  // Position tooltip
  const rect = element.getBoundingClientRect()
  tooltip.style.left = `${rect.left + rect.width / 2}px`
  tooltip.style.top = `${rect.bottom + 10}px`
  tooltip.style.transform = 'translateX(-50%)'

  document.body.appendChild(tooltip)

  // Animate in
  setTimeout(() => {
    tooltip.style.opacity = '1'
  }, 10)

  // Remove after duration
  setTimeout(() => {
    tooltip.style.opacity = '0'
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip)
      }
    }, 300)
  }, duration)
}

// Check if this is the first time the user is using the extension
export async function checkFirstTimeUse(): Promise<void> {
  const shouldShow = await shouldShowOnboarding()
  
  if (shouldShow) {
    logger.info('onboarding', 'First time use detected, user should see onboarding')
    
    // You could trigger onboarding here or set a flag for the UI to show it
    // For now, we'll just log it and let the UI components handle it
  }
}

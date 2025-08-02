import { Button, Card, Text, useToasts } from '@geist-ui/core'
import { FC, useCallback, useEffect, useState } from 'react'
import { markOnboardingComplete, onboardingSteps, OnboardingStep, resetOnboarding, shouldShowOnboarding } from '../onboarding'

const OnboardingPanel: FC = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { setToast } = useToasts()

  const checkOnboardingStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const shouldShow = await shouldShowOnboarding()
      setIsOnboardingComplete(!shouldShow)
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleNext = useCallback(() => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep])

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  const handleComplete = useCallback(async () => {
    try {
      await markOnboardingComplete()
      setIsOnboardingComplete(true)
      setToast({ text: 'Onboarding completed!', type: 'success' })
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      setToast({ text: 'Failed to complete onboarding', type: 'error' })
    }
  }, [setToast])

  const handleReset = useCallback(async () => {
    try {
      await resetOnboarding()
      setIsOnboardingComplete(false)
      setCurrentStep(0)
      setToast({ text: 'Onboarding reset', type: 'success' })
    } catch (error) {
      console.error('Failed to reset onboarding:', error)
      setToast({ text: 'Failed to reset onboarding', type: 'error' })
    }
  }, [setToast])

  const handleStepAction = useCallback((step: OnboardingStep) => {
    if (step.action === 'Open Settings') {
      // Switch to the provider tab (this would need to be implemented in the parent component)
      setToast({ text: 'Check the AI Provider tab to configure your settings', type: 'default' })
    }
  }, [setToast])

  useEffect(() => {
    checkOnboardingStatus()
  }, [checkOnboardingStatus])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Text>Loading onboarding status...</Text>
      </div>
    )
  }

  if (isOnboardingComplete) {
    return (
      <div className="flex flex-col gap-4">
        <Text h4>Onboarding Complete</Text>
        <Card>
          <Text p>
            You've completed the onboarding process! You can restart it anytime if you need a refresher.
          </Text>
          <div className="flex gap-2 mt-4">
            <Button scale={2/3} type="secondary" onClick={handleReset}>
              Restart Onboarding
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const step = onboardingSteps[currentStep]
  const isLastStep = currentStep === onboardingSteps.length - 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Text h4>Getting Started</Text>
        <Text span className="text-sm text-gray-500">
          Step {currentStep + 1} of {onboardingSteps.length}
        </Text>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <Text h5 className="m-0">{step.title}</Text>
          <Text p className="m-0">{step.description}</Text>
          
          {step.action && (
            <Button 
              scale={2/3} 
              type="secondary" 
              onClick={() => handleStepAction(step)}
            >
              {step.action}
            </Button>
          )}
        </div>
      </Card>

      {/* Progress indicator */}
      <div className="flex gap-1">
        {onboardingSteps.map((_, index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded ${
              index <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          scale={2/3}
          type="secondary"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          Previous
        </Button>

        <div className="flex gap-2">
          <Button
            scale={2/3}
            type="secondary"
            onClick={handleComplete}
          >
            Skip
          </Button>
          
          {isLastStep ? (
            <Button
              scale={2/3}
              type="success"
              onClick={handleComplete}
            >
              Complete
            </Button>
          ) : (
            <Button
              scale={2/3}
              type="success"
              onClick={handleNext}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingPanel

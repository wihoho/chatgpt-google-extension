import { Button, Card, Code, Select, Text, useToasts } from '@geist-ui/core'
import { FC, useCallback, useEffect, useState } from 'react'
import { logger, LogEntry, LogLevel } from '../logging'

const DebugPanel: FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [selectedComponent, setSelectedComponent] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const { setToast } = useToasts()

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const logEntries = await logger.getLogs()
      setLogs(logEntries)
    } catch (error) {
      console.error('Failed to load logs:', error)
      setToast({ text: 'Failed to load logs', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }, [setToast])

  const clearLogs = useCallback(async () => {
    try {
      await logger.clearLogs()
      setLogs([])
      setToast({ text: 'Logs cleared successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to clear logs:', error)
      setToast({ text: 'Failed to clear logs', type: 'error' })
    }
  }, [setToast])

  const exportLogs = useCallback(async () => {
    try {
      const logsJson = await logger.exportLogs()
      const blob = new Blob([logsJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `extension-logs-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setToast({ text: 'Logs exported successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to export logs:', error)
      setToast({ text: 'Failed to export logs', type: 'error' })
    }
  }, [setToast])

  // Filter logs based on selected criteria
  useEffect(() => {
    let filtered = logs

    if (selectedLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLevel)
    }

    if (selectedComponent !== 'all') {
      filtered = filtered.filter(log => log.component === selectedComponent)
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    setFilteredLogs(filtered)
  }, [logs, selectedLevel, selectedComponent])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const getUniqueComponents = useCallback(() => {
    const components = new Set(logs.map(log => log.component))
    return Array.from(components).sort()
  }, [logs])

  const formatLogEntry = (log: LogEntry) => {
    const timestamp = new Date(log.timestamp).toLocaleString()
    let content = `[${timestamp}] [${log.level.toUpperCase()}] [${log.component}] ${log.message}`
    
    if (log.data) {
      content += `\nData: ${JSON.stringify(log.data, null, 2)}`
    }
    
    if (log.error) {
      content += `\nError: ${log.error.name}: ${log.error.message}`
      if (log.error.stack) {
        content += `\nStack: ${log.error.stack}`
      }
    }
    
    return content
  }

  const getLogLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.ERROR:
        return '#ff4757'
      case LogLevel.WARN:
        return '#ffa502'
      case LogLevel.INFO:
        return '#3742fa'
      case LogLevel.DEBUG:
        return '#747d8c'
      default:
        return '#2f3542'
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row gap-2 items-center">
        <Text h4 className="m-0">Debug Logs</Text>
        <div className="grow"></div>
        <Button scale={2/3} onClick={loadLogs} loading={isLoading}>
          Refresh
        </Button>
        <Button scale={2/3} type="secondary" onClick={exportLogs}>
          Export
        </Button>
        <Button scale={2/3} type="error" onClick={clearLogs}>
          Clear
        </Button>
      </div>

      <div className="flex flex-row gap-2">
        <Select
          scale={2/3}
          value={selectedLevel}
          onChange={(v) => setSelectedLevel(v as string)}
          placeholder="Filter by level"
        >
          <Select.Option value="all">All Levels</Select.Option>
          <Select.Option value={LogLevel.ERROR}>Error</Select.Option>
          <Select.Option value={LogLevel.WARN}>Warning</Select.Option>
          <Select.Option value={LogLevel.INFO}>Info</Select.Option>
          <Select.Option value={LogLevel.DEBUG}>Debug</Select.Option>
        </Select>

        <Select
          scale={2/3}
          value={selectedComponent}
          onChange={(v) => setSelectedComponent(v as string)}
          placeholder="Filter by component"
        >
          <Select.Option value="all">All Components</Select.Option>
          {getUniqueComponents().map(component => (
            <Select.Option key={component} value={component}>
              {component}
            </Select.Option>
          ))}
        </Select>
      </div>

      <Text p className="text-sm text-gray-600">
        Showing {filteredLogs.length} of {logs.length} log entries
      </Text>

      <div className="max-h-96 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <Card>
            <Text p className="text-center text-gray-500">
              No logs found. Try adjusting the filters or refresh the logs.
            </Text>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredLogs.map((log, index) => (
              <Card key={index}>
                <div style={{ borderLeft: `4px solid ${getLogLevelColor(log.level)}`, paddingLeft: '12px' }}>
                  <Code block>{formatLogEntry(log)}</Code>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DebugPanel

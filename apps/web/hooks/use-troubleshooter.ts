// PBA-316 — AI Troubleshooter hook
// Manages streaming chat state and SSE consumption for the troubleshooter panel.
import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { troubleshootApi, type AiMessage } from '../lib/api-client'
import { refreshSession } from '../store/auth'

// ── React Query hook for conversation history ─────────────────────────────────

export function useTroubleshootHistory(stepId: string) {
  return useQuery({
    queryKey: ['troubleshoot-history', stepId],
    queryFn: async () => {
      const { data, error } = await troubleshootApi.getHistory(stepId)
      if (error) throw new Error(error.message ?? 'Failed to load conversation history')
      return data ?? null
    },
    enabled: !!stepId,
    staleTime: 0, // always re-fetch on mount — conversation may have changed
  })
}

// ── Streaming chat hook ───────────────────────────────────────────────────────

export function useTroubleshooter(stepId: string) {
  const queryClient = useQueryClient()

  // Full message history (includes both loaded history and optimistic messages)
  const [messages, setMessages] = useState<AiMessage[]>([])
  // Text being streamed in for the current assistant turn
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRateLimited, setIsRateLimited] = useState(false)

  const sendMessage = useCallback(
    async (message: string, submissionId?: string, screenshotS3Key?: string) => {
      if (isStreaming || !message.trim()) return

      setError(null)

      // 1. Optimistically add the user message to local state
      const userMsg: AiMessage = {
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setStreamingContent('')
      setIsStreaming(true)

      try {
        const sseBody = {
          message,
          ...(submissionId ? { submissionId } : {}),
          ...(screenshotS3Key ? { screenshotS3Key } : {}),
        }

        let response = await troubleshootApi.startTroubleshoot(stepId, sseBody)

        // On 401, attempt a silent token refresh then retry once (mirrors apiFetch behaviour)
        if (response.status === 401) {
          const refreshed = await refreshSession()
          if (refreshed) {
            response = await troubleshootApi.startTroubleshoot(stepId, sseBody)
          }
        }

        // Handle non-streaming error responses
        if (!response.ok) {
          if (response.status === 429) {
            setIsRateLimited(true)
            setMessages((prev) => prev.slice(0, -1)) // remove optimistic user msg
            // Auto-clear after the cooldown so the input isn't disabled for the
            // rest of the session (previously isRateLimited was never reset).
            const retryAfter = Number(response.headers.get('Retry-After')) || 60
            window.setTimeout(() => setIsRateLimited(false), retryAfter * 1000)
            return
          }
          const body = await response.json().catch(() => ({})) as { message?: string }
          throw new Error(body.message ?? `Request failed with status ${response.status}`)
        }

        if (!response.body) {
          throw new Error('No response body for SSE stream')
        }

        // 2. Read SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let assistantContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice('data: '.length).trim()
            if (!jsonStr) continue

            try {
              const event = JSON.parse(jsonStr) as {
                type: 'delta' | 'done' | 'error'
                content?: string
                conversationId?: string
                message?: string
              }

              if (event.type === 'delta' && event.content) {
                assistantContent += event.content
                setStreamingContent(assistantContent)
              } else if (event.type === 'done') {
                // Move streamed content into full messages list
                const assistantMsg: AiMessage = {
                  role: 'assistant',
                  content: assistantContent,
                  createdAt: new Date().toISOString(),
                }
                setMessages((prev) => [...prev, assistantMsg])
                setStreamingContent('')
                // Invalidate history query so panel reloads on next mount
                void queryClient.invalidateQueries({ queryKey: ['troubleshoot-history', stepId] })
              } else if (event.type === 'error') {
                throw new Error(event.message ?? 'AI assistant is temporarily unavailable.')
              }
            } catch (parseErr) {
              // If it's a JSON parse error on a malformed line, skip silently
              if (!(parseErr instanceof SyntaxError)) {
                throw parseErr
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.'
        setError(msg)
        toast.error(msg)
        // Remove the optimistic user message on failure
        setMessages((prev) => prev.slice(0, -1))
        setStreamingContent('')
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, stepId, queryClient],
  )

  return {
    messages,
    setMessages,
    streamingContent,
    isStreaming,
    error,
    sendMessage,
    isRateLimited,
  }
}

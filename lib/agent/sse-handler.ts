/**
 * SSE Handler
 * 
 * Server-Sent Events utilities for streaming responses from the agent.
 */

/**
 * Helper type for SSE event handler
 */
export type SSEHandler = {
  sendSSE: (data: object) => Promise<void>
  sendToolEvent: (
    toolName: string,
    status: 'start' | 'end',
    input?: Record<string, unknown>,
    result?: string,
  ) => Promise<void>
}

/**
 * Creates an SSE handler with writer access for streaming responses
 */
export function createSSEHandler(writer: WritableStreamDefaultWriter<Uint8Array>): SSEHandler {
  const encoder = new TextEncoder()

  const sendSSE = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  const sendToolEvent = async (
    toolName: string,
    status: 'start' | 'end',
    input?: Record<string, unknown>,
    result?: string,
  ) => {
    await sendSSE({
      choices: [
        {
          delta: {
            tool_use: {
              name: toolName,
              status,
              input,
              result,
            },
          },
        },
      ],
    })
  }

  return { sendSSE, sendToolEvent }
}

/**
 * Sends the done signal to close the SSE stream
 */
export async function sendDoneSignal(writer: WritableStreamDefaultWriter<Uint8Array>) {
  const encoder = new TextEncoder()
  await writer.write(encoder.encode('data: [DONE]\n\n'))
}

/**
 * Sends an error through the SSE stream
 */
export async function sendSSEError(
  handler: SSEHandler,
  error: Error | unknown,
) {
  await handler.sendSSE({
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
    },
  })
}


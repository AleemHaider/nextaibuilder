/**
 * Pure parsing helper extracted from screenshotValidationWorker.ts.
 *
 * Kept in its own file so it can be unit-tested without importing BullMQ,
 * Redis, S3, or the Anthropic SDK — all of which attempt I/O at module load.
 *
 * The worker imports and calls this function instead of inlining the logic.
 */

export interface ClaudeValidationResult {
  passed: boolean
  confidence: number
  feedback: string
}

/**
 * Strip optional markdown code fences and parse the Claude JSON response.
 *
 * @param rawText  The raw text returned by Claude (content[0].text).
 * @returns        Parsed ClaudeValidationResult.
 * @throws         Error if the text cannot be parsed as valid JSON.
 */
export function parseClaudeResponse(rawText: string): ClaudeValidationResult {
  const cleaned = rawText
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  try {
    return JSON.parse(cleaned) as ClaudeValidationResult
  } catch {
    throw new Error(`Claude returned unparseable JSON: ${cleaned.slice(0, 200)}`)
  }
}

/**
 * Unit tests for the Claude Vision response parsing logic.
 *
 * Why a separate helper module?
 * The parsing logic originally lived inside callClaudeVision() in
 * screenshotValidationWorker.ts.  That file cannot be imported in tests
 * because its module scope initialises BullMQ Workers, a Redis connection,
 * and the Anthropic SDK — all of which attempt real I/O.
 *
 * The logic has therefore been extracted into
 * src/lib/parseClaudeResponse.ts, which is a pure function with zero
 * side-effects.  This is the canonical function to test here.
 *
 * These tests cover every branch documented in the worker source:
 *   • Valid bare JSON         → parsed correctly
 *   • ```json ... ``` fences  → stripped and parsed
 *   • Bare ``` ... ``` fences → stripped and parsed
 *   • Malformed JSON          → throws (retry loop catches)
 *   • Empty string            → throws
 *   • Whitespace-only string  → throws
 */

import { describe, it, expect } from 'vitest'
import { parseClaudeResponse } from '../lib/parseClaudeResponse.js'
import type { ClaudeValidationResult } from '../lib/parseClaudeResponse.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validPayload(overrides: Partial<ClaudeValidationResult> = {}): ClaudeValidationResult {
  return {
    passed: true,
    confidence: 95,
    feedback: 'Screenshot shows Node.js 20 installed correctly.',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Valid JSON — bare (no code fences)
// ---------------------------------------------------------------------------
describe('parseClaudeResponse() — valid bare JSON', () => {
  it('should return correct ClaudeValidationResult when response is plain JSON', () => {
    // Arrange
    const payload = validPayload()
    const raw = JSON.stringify(payload)

    // Act
    const result = parseClaudeResponse(raw)

    // Assert
    expect(result.passed).toBe(true)
    expect(result.confidence).toBe(95)
    expect(result.feedback).toBe('Screenshot shows Node.js 20 installed correctly.')
  })

  it('should return passed:false result for a failing validation', () => {
    // Arrange
    const payload = validPayload({ passed: false, confidence: 88, feedback: 'Node.js not installed.' })
    const raw = JSON.stringify(payload)

    // Act
    const result = parseClaudeResponse(raw)

    // Assert
    expect(result.passed).toBe(false)
    expect(result.confidence).toBe(88)
    expect(result.feedback).toBe('Node.js not installed.')
  })

  it('should handle a confidence value of 0 without error', () => {
    // Arrange — boundary: minimum confidence
    const raw = JSON.stringify(validPayload({ confidence: 0, passed: false }))

    // Act
    const result = parseClaudeResponse(raw)

    // Assert
    expect(result.confidence).toBe(0)
  })

  it('should handle a confidence value of 100 without error', () => {
    // Arrange — boundary: maximum confidence
    const raw = JSON.stringify(validPayload({ confidence: 100 }))

    // Act
    const result = parseClaudeResponse(raw)

    // Assert
    expect(result.confidence).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Markdown code fences — Claude occasionally wraps JSON despite being told not to
// ---------------------------------------------------------------------------
describe('parseClaudeResponse() — markdown code fence stripping', () => {
  it('should strip ```json\\n...\\n``` fences and parse correctly', () => {
    // Arrange — most common fence format Claude uses
    const payload = validPayload()
    const raw = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``

    // Act
    const result = parseClaudeResponse(raw)

    // Assert
    expect(result.passed).toBe(true)
    expect(result.confidence).toBe(95)
  })

  it('should strip bare ``` fences (no language tag) and parse correctly', () => {
    // Arrange — fence without "json" specifier
    const payload = validPayload({ passed: false, confidence: 72 })
    const raw = `\`\`\`\n${JSON.stringify(payload)}\n\`\`\``

    // Act
    const result = parseClaudeResponse(raw)

    // Assert
    expect(result.passed).toBe(false)
    expect(result.confidence).toBe(72)
  })

  it('should handle fences with no trailing newline before closing ```', () => {
    // Arrange — edge variant some models produce
    const payload = validPayload()
    const raw = `\`\`\`json\n${JSON.stringify(payload)}\`\`\``

    // Act
    const result = parseClaudeResponse(raw)

    // Assert
    expect(result.confidence).toBe(95)
  })

  it('should handle leading/trailing whitespace around the JSON block', () => {
    // Arrange
    const payload = validPayload()
    const raw = `  \n${JSON.stringify(payload)}\n  `

    // Act
    const result = parseClaudeResponse(raw)

    // Assert
    expect(result.passed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Malformed JSON — must throw so the retry loop in the worker can catch it
// ---------------------------------------------------------------------------
describe('parseClaudeResponse() — malformed JSON', () => {
  it('should throw when the response is not valid JSON', () => {
    // Arrange
    const raw = '{ passed: true, confidence: 90 }' // unquoted keys → invalid JSON

    // Act & Assert
    expect(() => parseClaudeResponse(raw)).toThrow('Claude returned unparseable JSON')
  })

  it('should throw when the response is a prose sentence instead of JSON', () => {
    // Arrange — model went off-script
    const raw = 'The screenshot looks correct to me.'

    // Act & Assert
    expect(() => parseClaudeResponse(raw)).toThrow()
  })

  it('should throw when JSON is truncated mid-object', () => {
    // Arrange — response was cut off
    const raw = '{ "passed": true, "confidence": 9'

    // Act & Assert
    expect(() => parseClaudeResponse(raw)).toThrow()
  })

  it('should include the first 200 characters of the bad response in the error message', () => {
    // Arrange — helps with debugging in production logs
    const raw = 'this is not json'

    // Act & Assert
    let thrownMessage = ''
    try {
      parseClaudeResponse(raw)
    } catch (err) {
      thrownMessage = (err as Error).message
    }
    expect(thrownMessage).toContain('this is not json')
  })
})

// ---------------------------------------------------------------------------
// Empty / blank responses — must throw
// ---------------------------------------------------------------------------
describe('parseClaudeResponse() — empty or blank input', () => {
  it('should throw when the response is an empty string', () => {
    // Arrange
    const raw = ''

    // Act & Assert
    expect(() => parseClaudeResponse(raw)).toThrow()
  })

  it('should throw when the response is whitespace only', () => {
    // Arrange — after trimming this becomes ''
    const raw = '   \n\t  '

    // Act & Assert
    expect(() => parseClaudeResponse(raw)).toThrow()
  })

  it('should throw when code fences wrap an empty body', () => {
    // Arrange — fences with nothing inside
    const raw = '```json\n\n```'

    // Act & Assert
    expect(() => parseClaudeResponse(raw)).toThrow()
  })
})

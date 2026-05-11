import { extractSkillsFromCV, isOllamaAvailable } from './ollama'
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('extractSkillsFromCV', () => {
  const mockApiUrl = 'http://localhost:11434'

  beforeEach(() => {
    process.env.OLLAMA_API_URL = mockApiUrl
    process.env.OLLAMA_MODEL = 'mistral:7b'
    vi.clearAllMocks()
  })

  describe('successful extraction', () => {
    it('should extract skills from CV text', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React, Node.js, TypeScript',
              done: true,
            }),
        } as Response)
      )

      const cvText = 'I am a developer with 5 years of React and Node.js experience...'
      const skills = await extractSkillsFromCV(cvText)

      expect(skills).toEqual(['React', 'Node.js', 'TypeScript'])
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/generate`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should trim and clean skill names', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: '  React  ,  Node.js  ,  TypeScript  ',
              done: true,
            }),
        } as Response)
      )

      const skills = await extractSkillsFromCV('Test CV')
      expect(skills).toEqual(['React', 'Node.js', 'TypeScript'])
    })

    it('should handle empty response gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: '',
              done: true,
            }),
        } as Response)
      )

      const skills = await extractSkillsFromCV('Test CV')
      expect(skills).toEqual([])
    })

    it('should handle single skill', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React',
              done: true,
            }),
        } as Response)
      )

      const skills = await extractSkillsFromCV('Test CV')
      expect(skills).toEqual(['React'])
    })

    it('should filter out empty strings from comma-separated list', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React, , Node.js, , , TypeScript',
              done: true,
            }),
        } as Response)
      )

      const skills = await extractSkillsFromCV('Test CV')
      expect(skills).toEqual(['React', 'Node.js', 'TypeScript'])
    })

    it('should use custom temperature option', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React, Node.js',
              done: true,
            }),
        } as Response)
      )

      await extractSkillsFromCV('Test CV', { temperature: 0.5 })

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.temperature).toBe(0.5)
    })

    it('should use custom timeout option', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React',
              done: true,
            }),
        } as Response)
      )

      await extractSkillsFromCV('Test CV', { timeout: 60000 })

      // Verify fetch was called (timeout is handled internally)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should throw error if OLLAMA_API_URL not set', async () => {
      delete process.env.OLLAMA_API_URL
      delete process.env.NEXT_PUBLIC_OLLAMA_API_URL

      await expect(extractSkillsFromCV('Some CV text')).rejects.toThrow(
        'OLLAMA_API_URL environment variable is not set'
      )
    })

    it('should throw error if CV text is empty', async () => {
      await expect(extractSkillsFromCV('')).rejects.toThrow('CV text cannot be empty')
    })

    it('should throw error if CV text is whitespace only', async () => {
      await expect(extractSkillsFromCV('   \n\t  ')).rejects.toThrow('CV text cannot be empty')
    })

    it('should throw error on HTTP error response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve('Server error details'),
        } as Response)
      )

      await expect(extractSkillsFromCV('Test CV')).rejects.toThrow(
        'Ollama API error: 500 Internal Server Error'
      )
    })

    it('should throw error on 404 API endpoint', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve('Endpoint not found'),
        } as Response)
      )

      await expect(extractSkillsFromCV('Test CV')).rejects.toThrow(
        'Ollama API error: 404 Not Found'
      )
    })

    it('should throw error on invalid JSON response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response)
      )

      await expect(extractSkillsFromCV('Test CV')).rejects.toThrow(
        'Failed to parse Ollama response as JSON'
      )
    })

    it('should throw error on missing response field', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              done: true,
              // Missing 'response' field
            }),
        } as Response)
      )

      await expect(extractSkillsFromCV('Test CV')).rejects.toThrow(
        'Invalid Ollama response structure'
      )
    })

    it('should throw error on network failure', async () => {
      global.fetch = vi.fn(() => Promise.reject(new TypeError('Network error')))

      await expect(extractSkillsFromCV('Test CV')).rejects.toThrow(
        'Skill extraction network error'
      )
    })

    it('should handle non-string response field', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: null, // Invalid: should be string
              done: true,
            }),
        } as Response)
      )

      await expect(extractSkillsFromCV('Test CV')).rejects.toThrow(
        'Invalid Ollama response structure'
      )
    })
  })

  describe('skill validation', () => {
    it('should accept skills with numbers and hyphens', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'Python 3, C++, .NET Framework, AWS S3, Node.js',
              done: true,
            }),
        } as Response)
      )

      const skills = await extractSkillsFromCV('Test CV')
      expect(skills).toEqual(['Python 3', 'C++', '.NET Framework', 'AWS S3', 'Node.js'])
    })

    it('should accept skills with forward slashes and parentheses', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'Java/Kotlin, C# (advanced), PHP (legacy)',
              done: true,
            }),
        } as Response)
      )

      const skills = await extractSkillsFromCV('Test CV')
      expect(skills).toEqual(['Java/Kotlin', 'C# (advanced)', 'PHP (legacy)'])
    })

    it('should use correct model from environment', async () => {
      process.env.OLLAMA_MODEL = 'custom-model:7b'

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React',
              done: true,
            }),
        } as Response)
      )

      await extractSkillsFromCV('Test CV')

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.model).toBe('custom-model:7b')
    })

    it('should use default model if not set', async () => {
      delete process.env.OLLAMA_MODEL

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React',
              done: true,
            }),
        } as Response)
      )

      await extractSkillsFromCV('Test CV')

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.model).toBe('mistral:7b')
    })

    it('should set temperature to 0.3 by default (deterministic)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React',
              done: true,
            }),
        } as Response)
      )

      await extractSkillsFromCV('Test CV')

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.temperature).toBe(0.3)
    })

    it('should set stream to false', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React',
              done: true,
            }),
        } as Response)
      )

      await extractSkillsFromCV('Test CV')

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.stream).toBe(false)
    })
  })

  describe('prompt formatting', () => {
    it('should include CV text in the prompt', async () => {
      const cvText = 'My CV with React and Node.js experience'

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              response: 'React, Node.js',
              done: true,
            }),
        } as Response)
      )

      await extractSkillsFromCV(cvText)

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.prompt).toContain(cvText)
      expect(callBody.prompt).toContain('Extract all professional skills')
    })
  })
})

describe('isOllamaAvailable', () => {
  beforeEach(() => {
    process.env.OLLAMA_API_URL = 'http://localhost:11434'
    vi.clearAllMocks()
  })

  it('should return true when Ollama is accessible', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
      } as Response)
    )

    const available = await isOllamaAvailable()
    expect(available).toBe(true)
  })

  it('should return false when Ollama returns error', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    )

    const available = await isOllamaAvailable()
    expect(available).toBe(false)
  })

  it('should return false when network error occurs', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

    const available = await isOllamaAvailable()
    expect(available).toBe(false)
  })

  it('should return false when OLLAMA_API_URL is not set', async () => {
    delete process.env.OLLAMA_API_URL
    delete process.env.NEXT_PUBLIC_OLLAMA_API_URL

    const available = await isOllamaAvailable()
    expect(available).toBe(false)
  })

  it('should call /api/tags endpoint', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
      } as Response)
    )

    await isOllamaAvailable()

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.any(Object)
    )
  })
})

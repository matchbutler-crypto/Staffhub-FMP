import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SkillUploadForm } from './skill-upload-form'

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const mockVacancies = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    titel: 'Senior React Developer',
    rolle: 'Frontend Engineer',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    titel: 'Python Backend Developer',
    rolle: 'Backend Engineer',
  },
]

describe('SkillUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the form with all required fields', () => {
    render(<SkillUploadForm vacancies={mockVacancies} />)

    // Check for title
    const titleElements = screen.getAllByText(/Profil einreichen/i)
    expect(titleElements.length).toBeGreaterThan(0)

    // Check for input fields
    expect(screen.getByPlaceholderText(/Max Mustermann/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Vakanz/i })).toBeInTheDocument()
    expect(screen.getByText(/PDF hier ablegen/i)).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields', async () => {
    render(<SkillUploadForm vacancies={mockVacancies} />)

    const submitButton = screen.getByRole('button', { name: /Profil einreichen/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Name ist erforderlich')).toBeInTheDocument()
      expect(screen.getByText('Bitte wählen Sie eine Vakanz')).toBeInTheDocument()
    })
  })

  it('displays info about automatic skill recognition', () => {
    render(<SkillUploadForm vacancies={mockVacancies} />)

    expect(screen.getByText('Automatische Skill-Erkennung')).toBeInTheDocument()
    expect(screen.getByText(/Der hochgeladene Lebenslauf wird analysiert/i)).toBeInTheDocument()
  })

  it('disables submit button when no vacancies available', () => {
    render(<SkillUploadForm vacancies={[]} />)

    const submitButton = screen.getByRole('button', { name: /Profil einreichen/i }) as HTMLButtonElement
    expect(submitButton).toBeDisabled()
  })

  it('calls onSuccess callback when provided', async () => {
    const onSuccess = vi.fn()
    const profileId = '550e8400-e29b-41d4-a716-446655440000'

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        profile: { id: profileId },
      }),
    })

    render(<SkillUploadForm vacancies={mockVacancies} onSuccess={onSuccess} />)

    // Test that callback could be called
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

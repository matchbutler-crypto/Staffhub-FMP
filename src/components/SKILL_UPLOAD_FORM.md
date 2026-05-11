# SkillUploadForm Component

Production-ready React component for handling CV uploads and skill extraction for agency staff placement system.

## Features

- **Form Validation**: Zod-based client-side validation for candidate name and vacancy selection
- **PDF Upload**: Drag-and-drop + click-to-select file upload with real-time file validation
- **Error Handling**: Comprehensive error messages for file size, type, and API errors
- **Loading States**: Disabled form inputs and loading indicators during submission
- **Success State**: Dedicated success view with profile navigation and retry options
- **Responsive Design**: Mobile-first Tailwind CSS styling with dark mode support
- **Accessibility**: Semantic HTML with proper ARIA labels and error messaging

## Props

```typescript
interface SkillUploadFormProps {
  vacancies: Vacancy[]           // Array of available vacancies for selection
  onSuccess?: (profileId: string) => void  // Optional callback after successful upload
}

interface Vacancy {
  id: string          // UUID of vacancy
  titel: string       // Vacancy title
  rolle: string       // Job role/position
}
```

## Usage

### Basic Example

```tsx
'use client'

import { SkillUploadForm } from '@/components/skill-upload-form'

export default function MyPage() {
  const vacancies = [
    { id: '...', titel: 'Senior React Dev', rolle: 'Frontend' },
    { id: '...', titel: 'Backend Engineer', rolle: 'Backend' },
  ]

  return (
    <div className="max-w-2xl">
      <SkillUploadForm 
        vacancies={vacancies}
        onSuccess={(profileId) => console.log('Profile created:', profileId)}
      />
    </div>
  )
}
```

### With API Integration

```tsx
import { SkillUploadForm } from '@/components/skill-upload-form'
import { useEffect, useState } from 'react'

export function VacancyPage() {
  const [vacancies, setVacancies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/vakanzen')
      .then(r => r.json())
      .then(data => {
        const mapped = data.vakanzen.map(v => ({
          id: v.id,
          titel: v.titel,
          rolle: v.rolle
        }))
        setVacancies(mapped)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Lädt...</div>

  return <SkillUploadForm vacancies={vacancies} />
}
```

## Component Behavior

### Form Flow

1. **Initial State**: Form displays three main fields
   - Candidate name (text input)
   - Vacancy selection (dropdown)
   - PDF upload (drag-drop area)

2. **Validation**: 
   - Client-side validation on submit (name, vacancy required)
   - PDF file validation (type, size)

3. **Upload Process**:
   - Creates FormData with file and metadata
   - POSTs to `/api/profiles`
   - Shows loading state (disabled inputs, loading text)
   - Handles API errors with toast notifications

4. **Success State**:
   - Displays success message with candidate name
   - Shows "New Submission" and "View Profile" buttons
   - Can reset form or navigate to profile editor

5. **Error Handling**:
   - File too large → "Datei darf maximal 10 MB groß sein"
   - Wrong file type → "Nur PDF-Dateien erlaubt"
   - API errors → Specific error messages from server
   - Authentication errors → User-friendly auth messages

## API Endpoint

The component calls `POST /api/profiles` with the following FormData:

```
vacancy_id: string (UUID)
candidate_name: string
file: File (PDF only, max 10MB)
```

Expected success response (201):
```json
{
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    ...
  }
}
```

See `src/app/api/profiles/route.ts` for full implementation details.

## Styling

Uses Tailwind CSS + shadcn/ui components:
- `Button` - Primary/outline variants
- `Input` - Text input with error states
- `Select` - Dropdown selection
- `Card` - Container layout
- `Label` - Form labels
- Tabler Icons - File, upload, alert, check icons

All components support dark mode via Tailwind.

## Error Messages

| Error | Display | Condition |
|-------|---------|-----------|
| Name is required | Text under input | Empty name on submit |
| Select vacancy | Text under dropdown | No vacancy selected |
| PDF required | Text under dropzone | No file selected |
| File too large | Below dropzone | >10MB file |
| Only PDF allowed | Below dropzone | Non-PDF file type |
| Upload failed | Toast + descriptive | API error response |

## Testing

Unit tests in `skill-upload-form.test.tsx`:
- Form rendering with all fields
- Validation error messages
- File requirements
- Empty vacancies handling
- Success callback invocation

Run tests:
```bash
npm test -- src/components/skill-upload-form.test.tsx
```

## Accessibility

- Form labels with required indicator (*)
- Error messages associated with fields
- Loading state announced via button text
- Semantic HTML structure
- Proper color contrast for dark/light modes
- Icon + text for visual clarity

## Performance

- Lazy validation (on submit only)
- Efficient re-renders via React Hook Form
- No unnecessary API calls
- File size check before upload

## Browser Support

Requires:
- React 18+
- Modern browsers with FormData and File API support
- CSS Grid/Flexbox support

## Dependencies

- react-hook-form (validation)
- zod (schema validation)
- react-dropzone (file upload)
- @tabler/icons-react (icons)
- sonner (toast notifications)
- shadcn/ui components (Button, Input, Select, Card)
- tailwindcss (styling)

## Future Enhancements

- Progress bar for file upload
- Multiple file uploads
- Skill preview before submission
- Ability to edit extracted skills before finalization
- Duplicate detection and warnings

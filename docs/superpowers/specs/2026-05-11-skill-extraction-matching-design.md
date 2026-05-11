# Skill Extraction & Matching System — Design Spec

**Date:** 2026-05-11  
**Project:** StaffHub FMP (Freelancer Management Platform)  
**Status:** Design Approved  
**Scope:** Automated CV skill extraction, skill normalization, and profile matching with KI-Score

---

## 1. Overview & Goals

The Skill Extraction & Matching system enables:
- **Agencies** to upload candidate CVs (PDFs)
- **Automated extraction** of skills from CVs using Ollama (self-hosted LLM)
- **Skill normalization** against O*NET-based skill taxonomy
- **Manual editing** of extracted skills by agencies
- **Transparent scoring** based on skill coverage matching
- **Score visibility** for both Manager and Agency users

---

## 2. Architecture

### 2.1 High-Level Flow

```
Candidate CV Upload (PDF)
    ↓
PDF Text Extraction (pdfjs)
    ↓
Ollama API Call (Mistral 7B) → Extract Skills
    ↓
Skill Normalization (fuzzy match against O*NET DB)
    ↓
Store Skills + CV File (Supabase)
    ↓
Agency Reviews & Edits Skills
    ↓
Auto-Calculate Score (matched_skills / required_skills)
    ↓
Score visible to Manager + Agency
```

### 2.2 Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **PDF Parser** | pdfjs-dist | Extract text from uploaded CVs |
| **Ollama Integration** | HTTP API | Extract skills from CV text |
| **Skill DB** | Supabase PostgreSQL | O*NET base + internal extensions |
| **Storage** | Supabase Storage | Archive uploaded PDFs |
| **Scoring Engine** | Next.js Backend | Calculate match percentage |
| **Frontend** | Next.js App Router | Agency skill review, Manager view |

---

## 3. Data Model

### 3.1 Database Schema (Supabase)

```sql
-- Skill Taxonomy (O*NET base + internal extensions)
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,           -- "React", "Python", etc.
  category TEXT,                       -- "Frontend", "Backend", "DevOps", etc.
  source TEXT NOT NULL,                -- "onet" or "internal"
  synonyms TEXT[],                     -- ["ReactJS", "React.js"] for fuzzy matching
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Profile Skills (many-to-many: profiles ↔ skills)
CREATE TABLE profile_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT FALSE,      -- True = Agency confirmed
  added_by TEXT NOT NULL,              -- "extraction" | "manual"
  created_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(profile_id, skill_id)
);

-- KI-Score Results (cached per profile-vacancy pair)
CREATE TABLE profile_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vacancy_id UUID NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  matched_skills_count INT NOT NULL,
  required_skills_count INT NOT NULL,
  score_percentage INT NOT NULL,       -- 0-100%
  calculated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(profile_id, vacancy_id)
);

-- Extend profiles table (add CV storage reference)
ALTER TABLE profiles ADD COLUMN cv_file_path TEXT;
ALTER TABLE profiles ADD COLUMN cv_uploaded_at TIMESTAMP;
```

### 3.2 Profile Skills Lifecycle

```
extraction → unverified (system proposed)
    ↓
(Agency edits)
    ↓
verified=true (Agency confirmed/added manually)
    ↓
(Used for scoring)
```

---

## 4. API Endpoints

### 4.1 Upload CV & Extract Skills

**Endpoint:** `POST /api/profiles`

**Request:**
```json
{
  "vacancy_id": "uuid",
  "agency_id": "uuid",
  "candidate_name": "Max Mustermann",
  "file": "<PDF File>"
}
```

**Response:**
```json
{
  "profile_id": "uuid",
  "candidate_name": "Max Mustermann",
  "cv_file_path": "agencies/[agency_id]/[profile_id]/cv.pdf",
  "extracted_skills": [
    {
      "id": "uuid",
      "name": "React",
      "verified": false,
      "added_by": "extraction"
    },
    {
      "id": "uuid",
      "name": "Node.js",
      "verified": false,
      "added_by": "extraction"
    }
  ]
}
```

**Backend Flow:**
1. Validate file (PDF, max 10MB)
2. Save PDF to Supabase Storage at `/agencies/{agency_id}/{profile_id}/cv.pdf`
3. Extract text from PDF using pdfjs
4. Call Ollama API (Mistral 7B) to extract skills
5. Normalize each skill against O*NET DB (fuzzy matching)
6. Insert into `profile_skills` table (added_by: "extraction", verified: false)
7. Return profile with extracted skills

---

### 4.2 Edit Skills (Agency)

**Endpoint:** `PATCH /api/profiles/:id/skills`

**Request:**
```json
{
  "skills_to_add": [
    { "skill_name": "GraphQL", "skill_id": "uuid" }  // Either name OR id
  ],
  "skills_to_remove": ["uuid"]                       // skill_ids
}
```

**Response:**
```json
{
  "profile_id": "uuid",
  "skills": [
    { "id": "uuid", "name": "React", "verified": true, "added_by": "manual" },
    { "id": "uuid", "name": "GraphQL", "verified": true, "added_by": "manual" }
  ],
  "score": {
    "matched": 3,
    "required": 5,
    "percentage": 60
  }
}
```

**Backend Flow:**
1. Validate user is agency owner of this profile
2. Remove skills (delete from `profile_skills`)
3. Add new skills (insert into `profile_skills`, added_by: "manual", verified: true)
4. Recalculate score
5. Update `profile_scores`
6. Return updated profile + new score

---

### 4.3 Calculate/Recalculate Score

**Endpoint:** `POST /api/profiles/:id/calculate-score`  
(Called automatically after skill changes)

**Backend Logic:**
```typescript
function calculateScore(profileId: uuid, vacancyId: uuid): {matched, required, percentage} {
  // Get verified skills for this profile
  const profileSkills = await db
    .from('profile_skills')
    .select('skills(id, name)')
    .eq('profile_id', profileId)
    .eq('verified', true);  // Only verified skills count

  // Get required skills for vacancy
  const vacancySkills = await db
    .from('vacancy_skills')  // Assuming this table exists
    .select('skills(id, name)')
    .eq('vacancy_id', vacancyId);

  // Calculate intersection
  const matched = profileSkills.filter(ps => 
    vacancySkills.some(vs => vs.id === ps.id)
  ).length;

  const percentage = (matched / vacancySkills.length) * 100;

  // Save result
  await db.from('profile_scores').upsert({
    profile_id: profileId,
    vacancy_id: vacancyId,
    matched_skills_count: matched,
    required_skills_count: vacancySkills.length,
    score_percentage: Math.round(percentage),
    calculated_at: now()
  });

  return { matched, required: vacancySkills.length, percentage };
}
```

---

### 4.4 Download CV (Manager Only)

**Endpoint:** `GET /api/profiles/:id/cv`

**Authorization:** Only Staffhub Manager role

**Response:** Signed download URL (expires in 24h)
```json
{
  "download_url": "https://supabase.../cv.pdf?token=...",
  "expires_in_hours": 24
}
```

---

## 5. Ollama Integration

### 5.1 Setup (VPS - Hostinger)

```bash
# On Hostinger VPS
docker run -d -p 11434:11434 ollama/ollama
docker exec <container> ollama pull mistral:7b
```

### 5.2 Backend Integration

**Environment Variables:**
```
OLLAMA_API_URL=http://your-hostinger-vps-ip:11434
OLLAMA_MODEL=mistral:7b
OLLAMA_TIMEOUT=30000  # ms
```

**Skill Extraction Function:**
```typescript
// lib/ollama.ts
async function extractSkillsFromCV(cvText: string): Promise<string[]> {
  const response = await fetch(
    `${process.env.OLLAMA_API_URL}/api/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        prompt: `Extract all professional skills and technologies from this CV. 
Return ONLY a comma-separated list of skills, nothing else.

CV Text:
${cvText}

Skills:`,
        stream: false,
        temperature: 0.3,  // Lower = more deterministic
      }),
      timeout: process.env.OLLAMA_TIMEOUT,
    }
  );

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  const skillsString = data.response.trim();
  
  // Parse "React, Node.js, TypeScript" → ["React", "Node.js", "TypeScript"]
  return skillsString
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
```

---

### 5.3 Skill Normalization (Fuzzy Matching)

```typescript
// lib/skillNormalization.ts
async function normalizeSkills(extractedSkills: string[]) {
  const normalized = [];

  for (const skill of extractedSkills) {
    // Exact match in DB
    let dbSkill = await db
      .from('skills')
      .select('*')
      .ilike('name', skill)
      .single();

    // If no exact match, try fuzzy match (Levenshtein distance)
    if (!dbSkill) {
      dbSkill = await fuzzyMatchSkill(skill);
    }

    // If still no match, create "pending" skill for admin review
    if (!dbSkill) {
      dbSkill = await db
        .from('skills')
        .insert({
          name: skill,
          source: 'pending',  // Requires admin curation
          category: 'unknown'
        })
        .single();
    }

    normalized.push(dbSkill);
  }

  return normalized;
}
```

---

## 6. Frontend Flows

### 6.1 Agency: Upload & Edit Skills

```
[Upload CV]
  ↓
[System extracts skills]
  ↓
[Show extracted skills]
  ┌─────────────────────────────────────────┐
  │ Skills extracted from CV:               │
  │                                         │
  │ ✓ React      [×remove]                 │
  │ ✓ Node.js    [×remove]                 │
  │ ✓ TypeScript [×remove]                 │
  │                                         │
  │ [+ Add more skills] [Dropdown]          │
  └─────────────────────────────────────────┘
  ↓
[Agency clicks "Add more" → Dropdown of available skills]
  ↓
[Submit Profile]
```

### 6.2 Manager: View Profile + Score

```
[Profile Details - Manager View]
  Candidate: Max Mustermann
  Agency: TechStaff AG
  
  [CV] [Download PDF] ← Manager can download

  Skills: React, Node.js, TypeScript
  
  ─────────────────────────────────────
  Vacancy: Senior React Developer
  
  [KI-Score Card]
  ┌─────────────────────┐
  │ Score: 66%          │
  │ 2 of 3 skills match │
  │                     │
  │ ✓ React             │
  │ ✓ Node.js           │
  │ ✗ Kubernetes        │
  └─────────────────────┘
  ─────────────────────────────────────
  Status: Open / Reviewing / Rejected
  [Comments...]
```

### 6.3 Agency: View Own Profile + Score

```
[My Submitted Profile]
  Vacancy: Senior React Developer
  
  Skills: React, Node.js, TypeScript
  [Edit skills button]
  
  [KI-Score Card]
  ┌─────────────────────┐
  │ Score: 66%          │
  │ 2 of 3 skills match │
  │                     │
  │ ✓ React             │
  │ ✓ Node.js           │
  │ ✗ Kubernetes        │
  └─────────────────────┘
  
  Status: Open / In Review / Rejected
```

---

## 7. Error Handling & Fallbacks

| Scenario | Handling |
|----------|----------|
| **PDF parsing fails** | Return error; allow agency to manually enter skills |
| **Ollama timeout** | Fallback: Show empty skill list + warning "Extraction failed"; allow manual entry |
| **Ollama connection lost** | Show error; allow manual skill entry only |
| **Skill not in O*NET DB** | Create "pending" skill + add to profile; admin later curates |
| **Score < 30%** | Show warning "Low match" but allow; decision is manager's |
| **CV file > 10MB** | Reject with error; ask user to compress |
| **Invalid PDF** | Reject with error; ask user to upload valid PDF |

---

## 8. Security & Permissions

### 8.1 Role-Based Access

| Action | Admin | Manager | Agency |
|--------|-------|---------|--------|
| Upload CV | — | — | ✓ Own profiles |
| View CV | ✓ | ✓ | — |
| Download CV | ✓ | ✓ | — |
| View Score | ✓ | ✓ | ✓ Own profiles |
| Edit Skills | ✓ | — | ✓ Own profiles |
| Manage Skill DB | ✓ | — | — |

### 8.2 Data Privacy

- CVs stored in **Supabase Storage** with agency-based access control
- Download URLs are **signed** (token-based, 24h expiry)
- Skill extraction happens **on self-hosted Ollama** (no cloud LLM)
- No CV text is logged or cached
- Profile data is scoped: Agencies see only their own profiles

---

## 9. Database Migrations

Two migrations required:

1. **Migration 001:** Create `skills`, `profile_skills`, `profile_scores` tables
2. **Migration 002:** Add `cv_file_path`, `cv_uploaded_at` columns to `profiles`
3. **Data Load:** Populate `skills` table with O*NET base taxonomy

---

## 10. Implementation Dependencies

### Prerequisites
- Ollama running on Hostinger VPS (Mistral 7B model loaded)
- Supabase project with Storage enabled
- pdfjs-dist library installed (`npm install pdfjs-dist`)

### Next Steps
- Database migrations + seed data (O*NET skills)
- Backend API endpoints (upload, edit, calculate-score, download)
- Frontend components (CV upload form, skill editor, score card)
- Testing (unit tests for scoring logic, integration tests for Ollama)

---

## 11. Success Criteria

✅ Agency uploads PDF → Skills extracted automatically  
✅ Agency can edit/add/remove skills  
✅ Score calculated accurately (matched / required)  
✅ Manager can view + download CV  
✅ Agency can see their own score  
✅ Score updates when skills change  
✅ Fallback to manual entry if extraction fails  
✅ All role-based permissions enforced  

---

**Design Status:** ✅ APPROVED  
**Next:** Implementation Plan (writing-plans skill)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Common skills across IT, management, languages
const ONET_SKILLS = [
  // Programming Languages
  { name: 'JavaScript', category: 'Programming Language', synonyms: ['JS', 'ECMAScript'] },
  { name: 'TypeScript', category: 'Programming Language', synonyms: ['TS'] },
  { name: 'Python', category: 'Programming Language', synonyms: [] },
  { name: 'Java', category: 'Programming Language', synonyms: [] },
  { name: 'C++', category: 'Programming Language', synonyms: ['Cpp', 'C Plus Plus'] },
  { name: 'C#', category: 'Programming Language', synonyms: ['CSharp', 'Csharp'] },
  { name: 'Go', category: 'Programming Language', synonyms: ['Golang'] },
  { name: 'Rust', category: 'Programming Language', synonyms: [] },
  { name: 'PHP', category: 'Programming Language', synonyms: [] },
  { name: 'Ruby', category: 'Programming Language', synonyms: [] },

  // Frontend Frameworks
  { name: 'React', category: 'Frontend Framework', synonyms: ['ReactJS', 'React.js'] },
  { name: 'Vue', category: 'Frontend Framework', synonyms: ['Vue.js', 'VueJS'] },
  { name: 'Angular', category: 'Frontend Framework', synonyms: ['AngularJS', 'Angular.js'] },
  { name: 'Svelte', category: 'Frontend Framework', synonyms: [] },
  { name: 'Next.js', category: 'Frontend Framework', synonyms: ['NextJS'] },
  { name: 'Nuxt', category: 'Frontend Framework', synonyms: ['Nuxt.js', 'NuxtJS'] },

  // Backend Frameworks
  { name: 'Node.js', category: 'Backend Framework', synonyms: ['NodeJS', 'Node'] },
  { name: 'Express', category: 'Backend Framework', synonyms: ['Express.js', 'ExpressJS'] },
  { name: 'Django', category: 'Backend Framework', synonyms: [] },
  { name: 'Flask', category: 'Backend Framework', synonyms: [] },
  { name: 'Spring', category: 'Backend Framework', synonyms: ['Spring Framework'] },
  { name: 'Laravel', category: 'Backend Framework', synonyms: [] },
  { name: 'Ruby on Rails', category: 'Backend Framework', synonyms: ['Rails', 'RoR'] },
  { name: 'FastAPI', category: 'Backend Framework', synonyms: [] },

  // Databases
  { name: 'PostgreSQL', category: 'Database', synonyms: ['Postgres', 'PG'] },
  { name: 'MySQL', category: 'Database', synonyms: [] },
  { name: 'MongoDB', category: 'Database', synonyms: ['Mongo'] },
  { name: 'Redis', category: 'Database', synonyms: [] },
  { name: 'Elasticsearch', category: 'Database', synonyms: ['Elastic'] },
  { name: 'DynamoDB', category: 'Database', synonyms: [] },
  { name: 'Firebase', category: 'Database', synonyms: ['Firestore'] },
  { name: 'Supabase', category: 'Database', synonyms: [] },

  // Cloud & DevOps
  { name: 'AWS', category: 'Cloud Platform', synonyms: ['Amazon Web Services'] },
  { name: 'Google Cloud', category: 'Cloud Platform', synonyms: ['GCP', 'Google Cloud Platform'] },
  { name: 'Azure', category: 'Cloud Platform', synonyms: ['Microsoft Azure'] },
  { name: 'Docker', category: 'DevOps', synonyms: [] },
  { name: 'Kubernetes', category: 'DevOps', synonyms: ['K8s'] },
  { name: 'CI/CD', category: 'DevOps', synonyms: ['Continuous Integration', 'Continuous Deployment'] },
  { name: 'GitHub Actions', category: 'DevOps', synonyms: [] },
  { name: 'Terraform', category: 'DevOps', synonyms: [] },

  // APIs & Protocols
  { name: 'REST API', category: 'API', synonyms: ['REST', 'RESTful'] },
  { name: 'GraphQL', category: 'API', synonyms: [] },
  { name: 'gRPC', category: 'API', synonyms: [] },
  { name: 'WebSocket', category: 'API', synonyms: [] },
  { name: 'HTTP', category: 'Protocol', synonyms: [] },
  { name: 'HTTPS', category: 'Protocol', synonyms: [] },

  // Tools & Version Control
  { name: 'Git', category: 'Version Control', synonyms: [] },
  { name: 'GitHub', category: 'Version Control', synonyms: [] },
  { name: 'GitLab', category: 'Version Control', synonyms: [] },
  { name: 'Bitbucket', category: 'Version Control', synonyms: [] },
  { name: 'Linux', category: 'Operating System', synonyms: ['Ubuntu', 'Debian', 'CentOS'] },
  { name: 'Windows', category: 'Operating System', synonyms: [] },
  { name: 'macOS', category: 'Operating System', synonyms: ['Mac OS', 'OS X'] },

  // Testing
  { name: 'Jest', category: 'Testing Framework', synonyms: [] },
  { name: 'Pytest', category: 'Testing Framework', synonyms: [] },
  { name: 'Mocha', category: 'Testing Framework', synonyms: [] },
  { name: 'RSpec', category: 'Testing Framework', synonyms: [] },
  { name: 'Selenium', category: 'Testing Framework', synonyms: [] },
  { name: 'Cypress', category: 'Testing Framework', synonyms: [] },

  // Soft Skills
  { name: 'Project Management', category: 'Soft Skill', synonyms: ['PM', 'Management'] },
  { name: 'Team Leadership', category: 'Soft Skill', synonyms: ['Leadership', 'Leading Teams'] },
  { name: 'Communication', category: 'Soft Skill', synonyms: [] },
  { name: 'Problem Solving', category: 'Soft Skill', synonyms: ['Troubleshooting'] },
  { name: 'Agile', category: 'Soft Skill', synonyms: ['Scrum', 'Kanban'] },

  // Languages
  { name: 'English', category: 'Language', synonyms: [] },
  { name: 'German', category: 'Language', synonyms: ['Deutsch'] },
  { name: 'French', category: 'Language', synonyms: ['Französisch'] },
  { name: 'Spanish', category: 'Language', synonyms: ['Spanisch'] },
]

async function seedSkills() {
  console.log('Starting O*NET skills seeding...')

  try {
    // Check if skills already exist
    const { data: existingSkills } = await supabase
      .from('skills')
      .select('id')
      .limit(1)

    if (existingSkills && existingSkills.length > 0) {
      console.log('Skills already seeded. Skipping...')
      return
    }

    // Insert skills
    const { error } = await supabase
      .from('skills')
      .insert(
        ONET_SKILLS.map((skill) => ({
          name: skill.name,
          category: skill.category,
          source: 'onet',
          synonyms: skill.synonyms,
        }))
      )

    if (error) {
      console.error('Failed to seed skills:', error)
      process.exit(1)
    }

    console.log(`✅ Successfully seeded ${ONET_SKILLS.length} skills`)
  } catch (error) {
    console.error('Seeding failed:', error)
    process.exit(1)
  }
}

seedSkills()

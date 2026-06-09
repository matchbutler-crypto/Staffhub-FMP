export type Role = 'Admin' | 'Staffhub Manager' | 'Agentur' | 'Controller'

export type TourStep = {
  element: string
  title: string
  description: string
}

export type WikiSection = {
  heading: string
  body: string
}

export type WikiPage = {
  slug: string
  title: string
  roles: Role[]
  sections: WikiSection[]
  tour?: TourStep[]
}

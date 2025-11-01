export type SearchTab = 'Yurie' | 'All' | 'Images' | 'Videos' | 'News'

export type AvailableOnItem = {
  name?: string
  link?: string
  price?: string
  thumbnail?: string
}

export type InlineImage = {
  link?: string
  source?: string
  thumbnail?: string
  original?: string
  title?: string
  source_name?: string
}

export type InlineImageSuggestion = {
  name?: string
  link?: string
  chips?: string
  serpapi_link?: string
  thumbnail?: string
}

export type SearchData = {
  query: string
  all: {
    search_information?: any
    organic_results: any[]
    related_questions?: any[]
    related_searches?: any[]
    knowledge_graph?: any
    top_stories?: any[]
    inline_images?: InlineImage[]
    inline_images_suggested_searches?: InlineImageSuggestion[]
    answer_box?: any
    featured_snippet?: any
    recipes_results?: any[]
    shopping_results?: any[]
    available_on?: AvailableOnItem[]
    local_map?: any
    local_results?: any
    pagination?: any
    serpapi_pagination?: any
  }
  images: {
    images_results: any[]
    suggested_searches?: any[]
  }
  videos: {
    videos_results: any[]
    related_searches?: any[]
    serpapi_pagination?: any
  }
  news: {
    news_results: any[]
    people_also_search_for?: any[]
    serpapi_pagination?: any
  }
  sources?: Record<string, string>
}


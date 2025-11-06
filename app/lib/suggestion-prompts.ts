// Suggestion prompts for the AI chat input
// These are shuffled and randomly displayed to users

export const SUGGESTION_PROMPTS = [
  // Science & Nature
  "how does CRISPR gene editing work",
  "what would happen if we fell into a black hole",
  "what really killed the dinosaurs",
  "explain DNA replication simply",
  "what is dark matter and dark energy",
  "how do volcanoes form and erupt",
  "why is the ocean blue",
  "how do magnets actually work",
  "could there be life on Europa",
  "how do vaccines train our immune system",
  "what causes hurricanes and tornadoes",
  "famous chemistry experiments that changed science",
  
  // History & Civilizations
  "mysteries of ancient Egypt",
  "what was daily life like in medieval times",
  "unsolved historical mysteries",
  "how did the Roman Empire fall",
  "who really discovered America",
  "secrets of the lost city of Atlantis",
  "legendary warriors throughout history",
  "medieval castles and their defenses",
  "ancient libraries that were lost forever",
  "mysterious ancient artifacts",
  "Renaissance art and its impact",
  "Viking exploration and culture",
  
  // Sci-Fi & Future
  "could we terraform Mars",
  "will humans merge with AI",
  "what if aliens visited Earth tomorrow",
  "how would first contact with aliens happen",
  "future of renewable energy",
  "could we upload our minds to computers",
  "predictions for the year 2100",
  "what will the metaverse become",
  "will flying cars ever be practical",
  "cities of the future",
  "Fermi paradox explained",
  "building a moon base",
  
  // Imaginary & Thought Experiments
  "design your own fantasy creature",
  "if you could time travel where would you go",
  "create your ideal fictional world",
  "invent a new color nobody has seen",
  "what if gravity worked sideways",
  "mythical creatures from different cultures",
  "create your own superhero powers",
  "if you had magic what would you do",
  "imagine a world without money",
  "what if time flowed backwards",
  "design an impossible building",
  "create your perfect day from scratch",
  
  // Fun & Entertainment
  "evolution of video games through decades",
  "plot holes in famous movies explained",
  "fascinating facts about the human mind",
  "weirdest world records ever set",
  "hidden meanings in popular songs",
  "psychology behind board games",
  "how music affects our emotions",
  "shows that predicted the future",
  "evolution of music genres",
  "mind tricks and optical illusions",
  "magic tricks revealed",
  "mathematics of probability and chance",
  
  // Philosophy & Mind-Bending
  "are we living in a simulation",
  "paradoxes that will blow your mind",
  "what is consciousness really",
  "if a tree falls in a forest does it make a sound",
  "the ship of Theseus paradox",
  "does free will actually exist",
  "trolley problem and moral dilemmas",
  "philosophical zombies thought experiment",
  "what is infinity really",
  "bootstrap paradox explained",
  "can machines ever be conscious",
  "what happens when we die",
  
  // Space & Astronomy
  "how are stars born and die",
  "strange moons in our solar system",
  "what if an asteroid hit Earth",
  "mysteries of the Moon",
  "colonizing Mars realistic timeline",
  "biggest objects in the universe",
  "what is a neutron star",
  "meteor showers and where they come from",
  "space junk problem solutions",
  "fastest spacecraft ever built",
  "James Webb telescope discoveries",
  "what's inside a black hole",
  
  // Technology & Innovation
  "how does encryption keep data safe",
  "blockchain explained without jargon",
  "how does virtual reality work",
  "evolution of smartphones",
  "types of artificial intelligence",
  "how does the internet actually work",
  "wireless charging technology",
  "neural networks explained simply",
  "how GPS knows your location",
  "how do noise cancelling headphones work",
  "quantum computing basics",
  "difference between RAM and storage",
  
  // Psychology & Human Behavior
  "why do we dream",
  "psychology of procrastination",
  "what causes phobias",
  "how memory actually works",
  "psychology of first impressions",
  "science of happiness",
  "meditation effects on the brain",
  "body language secrets",
  "habit formation science",
  "cognitive biases we all have",
  "psychology of persuasion",
  "why we forget things",
  
  // Animals & Wildlife
  "octopus intelligence and abilities",
  "how birds navigate during migration",
  "dolphin communication methods",
  "apex predators and ecosystems",
  "metamorphosis process explained",
  "how bees make honey",
  "animals with regeneration abilities",
  "elephant memory and emotions",
  "misconceptions about sharks",
  "echolocation in bats",
  "hibernation and animal sleep",
  "tallest animals evolutionary advantage",
  
  // Mysteries & Unexplained
  "famous unsolved mysteries",
  "Bermuda Triangle truth",
  "Mandela effect examples",
  "Easter Island statues mystery",
  "most credible UFO sightings",
  "lost expeditions and explorers",
  "strange phenomena scientists can't explain",
  "cryptids around the world",
  "hidden treasures never found",
  "ball lightning phenomenon",
  "unexplored depths of the ocean",
  "conspiracy theories that turned out true",
  
  // Creative & Artistic
  "color theory and psychology",
  "famous art heists in history",
  "method acting techniques",
  "how special effects evolved",
  "creating memorable fictional characters",
  "what makes a song catchy",
  "storytelling techniques from experts",
  "circus arts and acrobatics",
  "famous sculptures and their stories",
  "art movements throughout history",
  "worldbuilding for fantasy stories",
  "improv comedy principles",
  
  // Food & Science
  "chemistry of cooking",
  "why salt makes food taste better",
  "science behind spicy food",
  "how chocolate is made",
  "coffee's effect on the brain",
  "fermentation process explained",
  "science of baking bread",
  "why ice cream is so addictive",
  "superfood myths debunked",
  "taste and flavor perception",
  "molecular gastronomy basics",
  "health benefits of honey",
  
  // Entertainment & Pop Culture
  "best movies to watch this weekend",
  "explain the plot twist trend in modern movies",
  "compare streaming services and their strengths",
  "how to get started with screenwriting",
  "what makes a TV pilot episode successful",
  "impact of video game remasters on gaming",
  "how anime styles differ across studios",
  "how to analyze a film like a critic",
  "what makes a song go viral today",
  "guide to building a beginner home studio",
  "how esports tournaments are structured",
  "differences between open world and linear games",
  
  // News & Current Events (evergreen prompts)
  "what are today's top world stories",
  "summarize this week's technology news",
  "latest climate and environment updates explained simply",
  "what's new in space exploration",
  "recent breakthroughs in artificial intelligence",
  "economic trends to watch this month",
  "major cybersecurity events recently and why they matter",
  "public health developments to be aware of",
  "science headlines explained for non-experts",
  "geopolitical tensions and their background",
  "biggest energy transition news this week",
  "how to fact-check breaking news",
  
  // Daily Life
  "how to build a perfect morning routine",
  "ways to remember names better",
  "how to sleep deeper and wake refreshed",
  "simple habits that compound over time",
  "how to take smarter notes every day",
  "quick ways to declutter your workspace",
  "how to plan a week in 30 minutes",
  "email inbox zero workflow explained",
  "how to set goals you actually achieve",
  "techniques to beat procrastination today",
  "how to make decisions with less regret",
  
  // Career & Productivity
  "how to negotiate salary with confidence",
  "create a standout resume from scratch",
  "how to prepare for behavioral interviews",
  "meeting agendas that actually work",
  "how to run effective one on ones",
  "frameworks for prioritizing work tasks",
  "timeboxing versus pomodoro when to use",
  "how to write clear status updates",
  "make presentations that tell a story",
  "how to ask for actionable feedback",
  "avoid burnout and protect focus",
  
  // Programming & Software
  "what is clean code in practice",
  "how to design better api boundaries",
  "difference between http and websockets",
  "how oauth2 and oidc work together",
  "debugging tips for asynchronous code",
  "when to choose sql vs nosql",
  "how to write effective unit tests",
  "refactoring legacy code safely",
  "explain event driven architecture simply",
  "design patterns every dev should know",
  "how to review pull requests well",
  
  // Data & AI
  "how transformers process tokens",
  "explain embeddings like i'm five",
  "vector databases what and why",
  "how to evaluate llm outputs",
  "prompt engineering principles that matter",
  "rlhf explained with examples",
  "how attention works internally",
  "fine tuning vs rags differences",
  "designing guardrails for ai systems",
  "ethics of deploying generative models",
  "how to reduce hallucinations in llms",
  
  // Web & UX
  "core web vitals optimization checklist",
  "how browser rendering pipeline works",
  "responsive typography best practices",
  "accessibility basics for every site",
  "how to design empty states",
  "writing microcopy that converts",
  "motion design for meaningful feedback",
  "dark mode design considerations",
  "building forms users can finish",
  "how to run a usability test",
  "information architecture fundamentals",
  
  // Math
  "explain bayes theorem with examples",
  "what is the central limit theorem",
  "intuition for eigenvectors and eigenvalues",
  "how to visualize complex numbers",
  "probability distributions explained simply",
  "why derivatives represent rates of change",
  "how integrals measure accumulation",
  "difference between permutations and combinations",
  "what is a markov chain",
  "graph theory in everyday life",
  "number theory puzzles to try",
  
  // Physics
  "special relativity in plain language",
  "how lasers actually work",
  "quantum entanglement explained simply",
  "what is a particle accelerator",
  "thermodynamics laws with examples",
  "how superconductors behave",
  "why the sky is red at sunset",
  "basic fluid dynamics for beginners",
  "how gps uses relativity corrections",
  "nuclear fusion versus fission differences",
  "physics of musical instruments",
  
  // Chemistry
  "periodic trends and why they matter",
  "how covalent and ionic bonds differ",
  "what is a catalyst in reactions",
  "acids bases and ph explained",
  "how polymers are made and used",
  "balancing chemical equations tips",
  "why salt lowers water freezing point",
  "electrochemistry basics with batteries",
  "what is chirality in molecules",
  "how soaps and detergents clean",
  "green chemistry principles overview",
  
  // Biology & Medicine
  "how neurons communicate with signals",
  "immune system defenses explained",
  "microbiome and gut health basics",
  "how vaccines trigger immunity",
  "what is gene expression regulation",
  "how antibiotics work and resistance",
  "sleep stages and brain function",
  "how vision works from eye to brain",
  "human aging theories and evidence",
  "how to read a clinical study",
  "what is personalized medicine",
  
  // Earth & Environment
  "how earthquakes are measured and predicted",
  "what drives ocean currents",
  "climate feedback loops explained",
  "how soil stores carbon",
  "renewable energy types compared",
  "how wildfires start and spread",
  "urban heat island effect solutions",
  "biodiversity hotspots and why important",
  "how recycling actually works",
  "circular economy examples in practice",
  "sustainable travel tips that matter",
  
  // History
  "causes of world war one simplified",
  "how the printing press changed europe",
  "trade routes of the silk road",
  "history of democracy through ages",
  "rise and fall of city states",
  "age of exploration motivations",
  "industrial revolution key inventions",
  "history of women in science",
  "civil rights movement milestones",
  "cold war major turning points",
  "ancient myths that shaped laws",
  
  // Geography & Travel
  "most linguistically diverse countries",
  "how time zones are determined",
  "why some borders are straight lines",
  "cultures that read right to left",
  "how to travel light for a month",
  "hidden gems in europe by train",
  "planning a budget friendly road trip",
  "ecosystems you can visit responsibly",
  "how to learn phrases before travel",
  "travel insurance what to know",
  "packing list templates that work",
  
  // Business & Finance
  "how compound interest grows wealth",
  "difference between etfs and mutual funds",
  "what moves currency exchange rates",
  "how to read a balance sheet",
  "unit economics for subscription products",
  "pricing strategies and psychology",
  "cost of capital explained simply",
  "how credit scores are calculated",
  "negotiation tactics for contracts",
  "how to build an emergency fund",
  "personal budgeting frameworks to try",
  
  // Entrepreneurship & Startups
  "how to validate a startup idea",
  "customer discovery questions that reveal truth",
  "minimum viable product examples",
  "how to choose a market wedge",
  "what investors look for in decks",
  "go to market strategy essentials",
  "how to measure product market fit",
  "growth loops versus growth funnels",
  "onboarding users in the first minute",
  "how to price a new product",
  "when to pivot versus persevere",
  
  // Marketing & Growth
  "content strategy that compounds traffic",
  "seo basics that still matter",
  "how email deliverability really works",
  "social proof ideas for landing pages",
  "copywriting formulas that convert",
  "analytics events to track first",
  "a b testing best practices",
  "how to craft a value proposition",
  "community led growth playbook",
  "retention cohorts and how to read",
  "referral program ideas that work",
  
  // Writing & Creativity
  "how to write engaging introductions",
  "show dont tell examples for writers",
  "worldbuilding prompts for fantasy",
  "how to outline a nonfiction book",
  "ways to overcome writer's block",
  "edit your writing like a pro",
  "poetry forms explained simply",
  "writing with active voice techniques",
  "how to craft memorable metaphors",
  "newsletter topics readers love",
  "journal prompts for daily reflection",
  
  // Design & Visual Arts
  "principles of gestalt in design",
  "color contrast ratios for accessibility",
  "typography pairing that always works",
  "how to critique a design kindly",
  "designing for edge cases first",
  "layout grids and spacing systems",
  "iconography do's and don'ts",
  "how to run a design sprint",
  "design handoff checklist for devs",
  "storyboarding for product flows",
  "how to build a design system",
  
  // Education & Learning
  "spaced repetition for faster learning",
  "how to use active recall daily",
  "create flashcards that actually help",
  "learning science myths to avoid",
  "how to take lecture notes efficiently",
  "teach back method for mastery",
  "deliberate practice with feedback loops",
  "how to learn in public online",
  "rubrics to assess your own work",
  "learning project ideas for weekends",
  "how to keep motivation over months",
  
  // Health & Fitness
  "how to start strength training safely",
  "beginner running plan for 30 days",
  "protein intake basics for muscle",
  "mobility routines for desk workers",
  "how to build a sustainable diet",
  "hydration science and daily needs",
  "rest and recovery for athletes",
  "heart rate zones explained simply",
  "why walking is underrated exercise",
  "sleep hygiene checklist to follow",
  "how to read nutrition labels",
  
  // Home & DIY
  "how to fix a leaky faucet",
  "organize a small closet effectively",
  "what tools to keep at home",
  "how to paint a room cleanly",
  "beginner houseplant care tips",
  "wire management for clean desk setups",
  "soundproofing tricks for apartments",
  "how to patch small drywall holes",
  "energy saving upgrades for renters",
  "decluttering framework room by room",
  "how to plan a weekend project",
]

// Emoji-free variants for animated placeholder text (now same as main prompts)
export const SUGGESTION_PROMPTS_NO_EMOJI = SUGGESTION_PROMPTS

// Function to get random suggestions
function shuffleArray<T>(input: T[]): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

export function getRandomSuggestions(count: number = 8): string[] {
  return shuffleArray(SUGGESTION_PROMPTS).slice(0, count)
}

// Function to get random placeholder texts
export function getRandomPlaceholderTexts(count: number = 18): string[] {
  return shuffleArray(SUGGESTION_PROMPTS_NO_EMOJI).slice(0, count)
}

// Alias to emphasize freshness intent in callers, returns new random sample on every call
export function getFreshSuggestions(count: number = 8): string[] {
  return getRandomSuggestions(count)
}


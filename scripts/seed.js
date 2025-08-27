const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://llm_user:changeme@localhost:5432/llm_tracker',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(dbConfig);

const llmData = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    company: "OpenAI",
    description: "Most advanced multimodal AI with vision, analysis, and coding capabilities",
    useCases: ["General purpose", "Code generation", "Creative writing", "Vision tasks"],
    releaseYear: 2024,
    color: "from-green-500 to-emerald-600",
    logo: "🤖",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/200px-OpenAI_Logo.svg.png",
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    company: "Anthropic",
    description: "Balanced model excelling at analysis, coding, and nuanced conversation",
    useCases: ["Code analysis", "Research", "Writing", "Complex reasoning"],
    releaseYear: 2024,
    color: "from-orange-500 to-amber-600",
    logo: "🧠",
    image: "https://www.anthropic.com/_next/static/media/claude-logo.2f5f0b53.svg",
  },
  {
    id: "gemini-ultra",
    name: "Gemini Ultra",
    company: "Google",
    description: "Google's flagship model with strong multimodal and reasoning abilities",
    useCases: ["Multimodal tasks", "Scientific research", "Code", "Mathematics"],
    releaseYear: 2024,
    color: "from-blue-500 to-cyan-600",
    logo: "💎",
    image: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
  },
  {
    id: "llama-3-70b",
    name: "Llama 3 70B",
    company: "Meta",
    description: "Open-source powerhouse for customizable AI applications",
    useCases: ["Open source projects", "Fine-tuning", "Research", "Commercial use"],
    releaseYear: 2024,
    color: "from-purple-500 to-violet-600",
    logo: "🦙",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Meta_Platforms_Inc._logo.svg/200px-Meta_Platforms_Inc._logo.svg.png",
  },
  {
    id: "mistral-large",
    name: "Mistral Large",
    company: "Mistral AI",
    description: "European AI champion with strong multilingual capabilities",
    useCases: ["Multilingual tasks", "European languages", "Code", "Efficiency"],
    releaseYear: 2024,
    color: "from-red-500 to-pink-600",
    logo: "🌪️",
    image: "https://docs.mistral.ai/img/logo.svg",
  },
  {
    id: "command-r-plus",
    name: "Command R+",
    company: "Cohere",
    description: "Enterprise-focused with excellent retrieval and grounding",
    useCases: ["Enterprise search", "RAG systems", "Document analysis", "Business"],
    releaseYear: 2024,
    color: "from-indigo-500 to-blue-600",
    logo: "📊",
    image: "https://cohere.com/favicon.svg",
  },
  {
    id: "grok",
    name: "Grok",
    company: "xAI",
    description: "Real-time knowledge with humor and unconventional responses",
    useCases: ["Real-time info", "Social media", "Humor", "Current events"],
    releaseYear: 2023,
    color: "from-gray-600 to-slate-700",
    logo: "🚀",
    image: "https://grok.x.ai/assets/grok-logo-light.svg",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    company: "Perplexity AI",
    description: "Search-enhanced AI with real-time web access and citations",
    useCases: ["Web search", "Research", "Fact-checking", "Citations"],
    releaseYear: 2024,
    color: "from-teal-500 to-cyan-600",
    logo: "🔍",
    image: "https://www.perplexity.ai/favicon.svg",
  },
  {
    id: "qwen-2-5",
    name: "Qwen 2.5",
    company: "Alibaba",
    description: "Strong Asian language support with competitive performance",
    useCases: ["Chinese language", "Asian markets", "E-commerce", "Translation"],
    releaseYear: 2024,
    color: "from-yellow-500 to-orange-600",
    logo: "🐉",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Alibaba-Logo.svg/200px-Alibaba-Logo.svg.png",
  },
  {
    id: "falcon-180b",
    name: "Falcon 180B",
    company: "TII",
    description: "UAE's open-source giant with impressive scale and capabilities",
    useCases: ["Large-scale processing", "Arabic language", "Open source", "Research"],
    releaseYear: 2023,
    color: "from-amber-500 to-yellow-600",
    logo: "🦅",
    image: "https://www.tii.ae/favicon.ico",
  },
  {
    id: "gpt-3-5-turbo",
    name: "GPT-3.5 Turbo",
    company: "OpenAI",
    description: "Efficient and fast model for everyday AI tasks",
    useCases: ["Chatbots", "Quick tasks", "Cost-effective", "API integration"],
    releaseYear: 2022,
    color: "from-green-400 to-teal-500",
    logo: "💬",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/200px-OpenAI_Logo.svg.png",
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    company: "Anthropic",
    description: "Lightning-fast responses for high-volume simple tasks",
    useCases: ["Quick responses", "High volume", "Customer service", "Efficiency"],
    releaseYear: 2024,
    color: "from-purple-400 to-pink-500",
    logo: "⚡",
    image: "https://www.anthropic.com/_next/static/media/claude-logo.2f5f0b53.svg",
  },
  {
    id: "deepseek-coder",
    name: "DeepSeek Coder",
    company: "DeepSeek",
    description: "Specialized model for code generation and understanding",
    useCases: ["Code generation", "Debugging", "Code review", "Documentation"],
    releaseYear: 2024,
    color: "from-slate-500 to-gray-600",
    logo: "💻",
    image: "https://github.com/deepseek-ai.png",
  },
  {
    id: "mixtral-8x7b",
    name: "Mixtral 8x7B",
    company: "Mistral AI",
    description: "Mixture of experts model with excellent performance-to-cost ratio",
    useCases: ["Efficient processing", "Open source", "Fine-tuning", "Edge deployment"],
    releaseYear: 2023,
    color: "from-pink-500 to-rose-600",
    logo: "🎯",
    image: "https://docs.mistral.ai/img/logo.svg",
  },
  {
    id: "yi-34b",
    name: "Yi-34B",
    company: "01.AI",
    description: "Chinese-developed model with strong bilingual capabilities",
    useCases: ["Chinese-English", "Translation", "Asian markets", "Open source"],
    releaseYear: 2023,
    color: "from-red-400 to-orange-500",
    logo: "🌏",
    image: "https://github.com/01-ai.png",
  },
  {
    id: "solar-70b",
    name: "SOLAR-70B",
    company: "Upstage",
    description: "Korean AI with depth upscaling technology for efficiency",
    useCases: ["Korean language", "Efficient scaling", "Enterprise", "Fine-tuning"],
    releaseYear: 2023,
    color: "from-yellow-400 to-amber-500",
    logo: "☀️",
    image: "https://github.com/upstage.png",
  },
  {
    id: "inflection-2-5",
    name: "Inflection-2.5",
    company: "Inflection AI",
    description: "Personal AI with emotional intelligence and empathy",
    useCases: ["Personal assistant", "Emotional support", "Coaching", "Conversation"],
    releaseYear: 2024,
    color: "from-purple-500 to-indigo-600",
    logo: "🤝",
    image: "https://github.com/inflection-ai.png",
  },
  {
    id: "vicuna-33b",
    name: "Vicuna-33B",
    company: "LMSYS",
    description: "Fine-tuned LLaMA with improved conversational abilities",
    useCases: ["Open research", "Chatbots", "Fine-tuning base", "Academic"],
    releaseYear: 2023,
    color: "from-green-500 to-teal-600",
    logo: "🦌",
    image: "https://github.com/lm-sys.png",
  },
  {
    id: "phi-2",
    name: "Phi-2",
    company: "Microsoft",
    description: "Small but mighty model optimized for reasoning tasks",
    useCases: ["Edge devices", "Mobile apps", "Quick inference", "Research"],
    releaseYear: 2023,
    color: "from-blue-400 to-indigo-500",
    logo: "🔬",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/200px-Microsoft_logo.svg.png",
  },
  {
    id: "stable-beluga",
    name: "Stable Beluga",
    company: "Stability AI",
    description: "Open model focused on instruction following and safety",
    useCases: ["Safe responses", "Instruction following", "Open source", "Research"],
    releaseYear: 2023,
    color: "from-cyan-500 to-blue-600",
    logo: "🐋",
    image: "https://github.com/stability-ai.png",
  }
];

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database seeding...\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Insert LLMs
    console.log('Inserting LLM data...');
    for (const llm of llmData) {
      await client.query(
        `INSERT INTO llms (id, name, company, description, use_cases, release_year, color, logo, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           company = EXCLUDED.company,
           description = EXCLUDED.description,
           use_cases = EXCLUDED.use_cases,
           release_year = EXCLUDED.release_year,
           color = EXCLUDED.color,
           logo = EXCLUDED.logo,
           image_url = EXCLUDED.image_url,
           updated_at = NOW()`,
        [
          llm.id,
          llm.name,
          llm.company,
          llm.description,
          JSON.stringify(llm.useCases),
          llm.releaseYear,
          llm.color,
          llm.logo,
          llm.image
        ]
      );
      console.log(`  ✓ ${llm.name}`);
    }
    
    // Initialize votes table with zero votes for each LLM
    console.log('\nInitializing votes table...');
    for (const llm of llmData) {
      await client.query(
        `INSERT INTO votes (llm_id, vote_count, positive_votes, negative_votes)
         VALUES ($1, 0, 0, 0)
         ON CONFLICT (llm_id) DO NOTHING`,
        [llm.id]
      );
    }
    console.log('  ✓ Votes table initialized');
    
    // Add some sample initial votes (optional - can be removed)
    const sampleVotes = [
      { llm_id: 'gpt-4o', positive: 150, negative: 20 },
      { llm_id: 'claude-3-5-sonnet', positive: 140, negative: 15 },
      { llm_id: 'gemini-ultra', positive: 100, negative: 25 },
      { llm_id: 'llama-3-70b', positive: 120, negative: 10 },
      { llm_id: 'mistral-large', positive: 80, negative: 12 },
    ];
    
    console.log('\nAdding sample votes...');
    for (const vote of sampleVotes) {
      const voteCount = vote.positive - vote.negative;
      await client.query(
        `UPDATE votes 
         SET vote_count = $1, positive_votes = $2, negative_votes = $3
         WHERE llm_id = $4`,
        [voteCount, vote.positive, vote.negative, vote.llm_id]
      );
      console.log(`  ✓ ${vote.llm_id}: +${vote.positive} / -${vote.negative}`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Database seeded successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding
seedDatabase();
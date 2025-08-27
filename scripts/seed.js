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
    company: "TII UAE",
    description: "Open-source giant with strong performance across tasks",
    useCases: ["Open source", "Research", "Arabic language", "General purpose"],
    releaseYear: 2023,
    color: "from-amber-600 to-yellow-700",
    logo: "🦅",
    image: "https://www.tii.ae/sites/default/files/2022-12/TII-logo-WHITE.png",
  },
  {
    id: "bard",
    name: "Bard (Gemini Pro)",
    company: "Google",
    description: "Google's conversational AI with web access and multimodal features",
    useCases: ["Web browsing", "Conversation", "Creative tasks", "Integration"],
    releaseYear: 2024,
    color: "from-blue-500 to-green-600",
    logo: "🎭",
    image: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
  },
  {
    id: "ernie-4",
    name: "ERNIE 4.0",
    company: "Baidu",
    description: "Chinese AI leader with strong understanding of Chinese culture",
    useCases: ["Chinese market", "Cultural context", "Search", "Business"],
    releaseYear: 2024,
    color: "from-red-600 to-orange-700",
    logo: "🏮",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Baidu_Logo.svg/200px-Baidu_Logo.svg.png",
  },
  {
    id: "deepseek-coder",
    name: "DeepSeek Coder",
    company: "DeepSeek",
    description: "Specialized coding model with excellent debugging capabilities",
    useCases: ["Code generation", "Debugging", "Code review", "Documentation"],
    releaseYear: 2024,
    color: "from-green-600 to-teal-700",
    logo: "💻",
    image: "https://github.com/deepseek-ai.png",
  },
  {
    id: "mixtral-8x7b",
    name: "Mixtral 8x7B",
    company: "Mistral AI",
    description: "Mixture of experts model with excellent efficiency",
    useCases: ["Efficient inference", "MoE architecture", "Code", "Multiple languages"],
    releaseYear: 2024,
    color: "from-violet-600 to-purple-700",
    logo: "🎨",
    image: "https://docs.mistral.ai/img/logo.svg",
  },
  {
    id: "yi-34b",
    name: "Yi-34B",
    company: "01.AI",
    description: "Bilingual model excelling in Chinese and English tasks",
    useCases: ["Chinese-English", "Translation", "Bilingual tasks", "Open source"],
    releaseYear: 2024,
    color: "from-purple-600 to-pink-700",
    logo: "🎭",
    image: "https://github.com/01-ai.png",
  },
  {
    id: "solar-10-7b",
    name: "SOLAR-10.7B",
    company: "Upstage AI",
    description: "Efficient Korean model with strong multilingual capabilities",
    useCases: ["Korean language", "Efficient inference", "Asian languages", "Small models"],
    releaseYear: 2024,
    color: "from-orange-600 to-red-700",
    logo: "☀️",
    image: "https://github.com/UpstageAI.png",
  },
  {
    id: "inflection-2-5",
    name: "Inflection-2.5",
    company: "Inflection AI",
    description: "Personal AI with empathetic and supportive conversation style",
    useCases: ["Personal assistant", "Emotional support", "Coaching", "Companionship"],
    releaseYear: 2024,
    color: "from-teal-600 to-blue-700",
    logo: "💬",
    image: "https://github.com/InflectionAI.png",
  },
  {
    id: "vicuna-33b",
    name: "Vicuna-33B",
    company: "LMSYS",
    description: "Fine-tuned Llama model with improved conversational abilities",
    useCases: ["Chatbots", "Open source", "Fine-tuning base", "Research"],
    releaseYear: 2023,
    color: "from-pink-500 to-rose-600",
    logo: "🦌",
    image: "https://github.com/lm-sys.png",
  },
  {
    id: "phi-3",
    name: "Phi-3",
    company: "Microsoft",
    description: "Small but mighty model optimized for edge deployment",
    useCases: ["Edge computing", "Mobile apps", "Low resource", "Fast inference"],
    releaseYear: 2024,
    color: "from-blue-600 to-indigo-700",
    logo: "⚡",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/200px-Microsoft_logo.svg.png",
  },
  {
    id: "stablelm-2",
    name: "StableLM 2",
    company: "Stability AI",
    description: "Open model from the makers of Stable Diffusion",
    useCases: ["Open source", "Customization", "Research", "Creative apps"],
    releaseYear: 2024,
    color: "from-purple-500 to-indigo-600",
    logo: "🎯",
    image: "https://github.com/Stability-AI.png",
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
    console.log('\nInitializing votes table with 0 votes...');
    for (const llm of llmData) {
      await client.query(
        `INSERT INTO votes (llm_id, vote_count, positive_votes, negative_votes)
         VALUES ($1, 0, 0, 0)
         ON CONFLICT (llm_id) DO UPDATE SET
           vote_count = 0,
           positive_votes = 0,
           negative_votes = 0`,
        [llm.id]
      );
      console.log(`  ✓ ${llm.name}: initialized with 0 votes`);
    }
    console.log('  ✓ All votes initialized to 0')
    
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
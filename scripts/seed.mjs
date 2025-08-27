import dbManager from '../lib/database.js';
import { llmData } from '../lib/llm-data.js';
import logger from '../lib/logger.js';

async function seedDatabase() {
  try {
    await dbManager.initialize();
    logger.info('Starting database seeding...');
    
    // Begin transaction
    await dbManager.transaction(async (client) => {
      // Insert LLMs
      logger.info('Inserting LLMs...');
      for (const llm of llmData) {
        await client.query(
          `INSERT INTO llms (
            id, name, company, description, use_cases, 
            release_year, color, logo, image_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
            JSON.stringify(llm.useCases || []),
            llm.releaseYear,
            llm.color,
            llm.logo,
            llm.image || null
          ]
        );
      }
      logger.info(`Inserted ${llmData.length} LLMs`);
      
      // Initialize vote counts for each LLM
      logger.info('Initializing vote counts...');
      for (const llm of llmData) {
        await client.query(
          `INSERT INTO votes (llm_id, vote_count, positive_votes, negative_votes)
           VALUES ($1, 0, 0, 0)
           ON CONFLICT (llm_id) DO NOTHING`,
          [llm.id]
        );
      }
      logger.info('Vote counts initialized');
      
      // Insert sample analytics events (optional)
      logger.info('Inserting sample analytics events...');
      const sampleEvents = [
        { event_type: 'page_view', event_data: { page: 'home' } },
        { event_type: 'app_start', event_data: { version: '0.1.0' } },
      ];
      
      for (const event of sampleEvents) {
        await client.query(
          `INSERT INTO analytics (event_type, event_data)
           VALUES ($1, $2)`,
          [event.event_type, JSON.stringify(event.event_data)]
        );
      }
      logger.info('Sample analytics events inserted');
    });
    
    // Verify seed data
    const { rows: llmCount } = await dbManager.query('SELECT COUNT(*) FROM llms');
    const { rows: voteCount } = await dbManager.query('SELECT COUNT(*) FROM votes');
    
    logger.info('Database seeding completed successfully');
    logger.info(`Total LLMs: ${llmCount[0].count}`);
    logger.info(`Total vote records: ${voteCount[0].count}`);
    
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  } finally {
    await dbManager.closeAll();
  }
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export { seedDatabase };
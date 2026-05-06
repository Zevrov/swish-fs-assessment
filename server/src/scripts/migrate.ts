import { getConnection } from '../config/database';

async function migrate() {
  const connection = await getConnection();

  try {
    console.log('Running database migrations...');

    // Drop and recreate tables to ensure correct schema
    console.log('Dropping existing tables...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DROP TABLE IF EXISTS alternates');
    await connection.execute('DROP TABLE IF EXISTS markets');
    await connection.execute('DROP TABLE IF EXISTS players');
    await connection.execute('DROP TABLE IF EXISTS stat_types');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Create tables with correct schema
    const migrations = [
      `CREATE TABLE players (
        id INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        team_id INT NOT NULL,
        team_nickname VARCHAR(100) NOT NULL,
        team_abbr VARCHAR(10) NOT NULL,
        position VARCHAR(10) NOT NULL
      )`,

      `CREATE TABLE stat_types (
        id INT PRIMARY KEY,
        name VARCHAR(50) NOT NULL
      )`,

      `CREATE TABLE markets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        stat_type_id INT NOT NULL,
        line DECIMAL(5,2) NOT NULL,
        market_suspended TINYINT DEFAULT 0,
        manual_suspension TINYINT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (stat_type_id) REFERENCES stat_types(id),
        UNIQUE KEY unique_market (player_id, stat_type_id)
      )`,

      `CREATE TABLE alternates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        stat_type_id INT NOT NULL,
        line DECIMAL(5,2) NOT NULL,
        under_odds DECIMAL(5,3) NOT NULL,
        over_odds DECIMAL(5,3) NOT NULL,
        push_odds DECIMAL(5,3) NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (stat_type_id) REFERENCES stat_types(id)
      )`,

      `INSERT IGNORE INTO stat_types (id, name) VALUES
        (100, 'points'),
        (102, 'assists'),
        (103, 'rebounds'),
        (104, 'steals')`
    ];

    for (const migration of migrations) {
      await connection.execute(migration);
    }

    // Create index separately with error handling (MySQL doesn't support CREATE INDEX IF NOT EXISTS)
    try {
      await connection.execute('CREATE INDEX idx_alternates_player_stat ON alternates(player_id, stat_type_id)');
      console.log('Index created successfully');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('Index already exists, skipping');
      } else {
        console.warn('Index creation failed:', error.message);
      }
    }

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrate().catch(console.error);
}

export { migrate };

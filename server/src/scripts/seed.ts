import fs from 'fs';
import path from 'path';
import { getConnection } from '../config/database';
import { PropsJsonItem, AlternatesJsonItem } from '../types';

async function seed() {
  const connection = await getConnection();

  try {
    console.log('Starting database seeding...');

    // Read JSON files
    const propsPath = path.join(__dirname, '../../../database/props.json');
    const alternatesPath = path.join(__dirname, '../../../database/alternates.json');

    const propsData: PropsJsonItem[] = JSON.parse(fs.readFileSync(propsPath, 'utf8'));
    const alternatesData: AlternatesJsonItem[] = JSON.parse(fs.readFileSync(alternatesPath, 'utf8'));

    // Clear existing data
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE alternates');
    await connection.execute('TRUNCATE TABLE markets');
    await connection.execute('TRUNCATE TABLE players');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Extract unique players
    const players = new Map();
    propsData.forEach((item) => {
      if (!players.has(item.playerId)) {
        players.set(item.playerId, {
          id: item.playerId,
          name: item.playerName,
          team_id: item.teamId,
          team_nickname: item.teamNickname,
          team_abbr: item.teamAbbr,
          position: item.position
        });
      }
    });

    // Insert players
    for (const player of players.values()) {
      await connection.execute(
        'INSERT INTO players (id, name, team_id, team_nickname, team_abbr, position) VALUES (?, ?, ?, ?, ?, ?)',
        [player.id, player.name, player.team_id, player.team_nickname, player.team_abbr, player.position]
      );
    }

    // Insert markets from props.json
    for (const item of propsData) {
      await connection.execute(
        'INSERT INTO markets (player_id, stat_type_id, line, market_suspended) VALUES (?, ?, ?, ?)',
        [item.playerId, item.statTypeId, item.line, item.marketSuspended]
      );
    }

    // Insert alternates
    for (const item of alternatesData) {
      await connection.execute(
        'INSERT INTO alternates (player_id, stat_type_id, line, under_odds, over_odds, push_odds) VALUES (?, ?, ?, ?, ?, ?)',
        [item.playerId, item.statTypeId, item.line, item.underOdds, item.overOdds, item.pushOdds]
      );
    }

    console.log('Database seeded successfully!');
    console.log(`Inserted ${players.size} players`);
    console.log(`Inserted ${propsData.length} markets`);
    console.log(`Inserted ${alternatesData.length} alternates`);
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  seed().catch(console.error);
}

export { seed };

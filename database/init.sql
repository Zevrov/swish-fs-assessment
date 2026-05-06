-- Initial database setup
CREATE DATABASE IF NOT EXISTS interview_test;
USE interview_test;

-- Create tables
CREATE TABLE IF NOT EXISTS players (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  team_id INT NOT NULL,
  team_nickname VARCHAR(100) NOT NULL,
  team_abbr VARCHAR(10) NOT NULL,
  position VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS stat_types (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS markets (
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
);

CREATE TABLE IF NOT EXISTS alternates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  stat_type_id INT NOT NULL,
  line DECIMAL(5,2) NOT NULL,
  under_odds DECIMAL(5,3) NOT NULL,
  over_odds DECIMAL(5,3) NOT NULL,
  push_odds DECIMAL(5,3) NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (stat_type_id) REFERENCES stat_types(id)
);

-- Insert stat types
INSERT IGNORE INTO stat_types (id, name) VALUES
(100, 'points'),
(102, 'assists'),
(103, 'rebounds'),
(104, 'steals');

-- Grant permissions to interview user
GRANT ALL PRIVILEGES ON interview_test.* TO 'interview'@'%';
FLUSH PRIVILEGES;
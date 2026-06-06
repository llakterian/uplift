-- Uplift v1.3 Database Schema
-- Cloudflare D1 Database

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  streak INTEGER DEFAULT 0,
  last_visit TEXT,
  level TEXT DEFAULT 'Uplift Explorer',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  image TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Create views for easy querying

CREATE VIEW IF NOT EXISTS user_bookmarks_view AS
SELECT 
  b.id,
  b.user_id,
  b.post_id,
  b.title,
  b.url,
  b.image,
  b.created_at as bookmarked_at,
  u.email as user_email,
  u.streak as user_streak,
  u.level as user_level
FROM bookmarks b
JOIN users u ON b.user_id = u.id;

CREATE VIEW IF NOT EXISTS user_stats_view AS
SELECT 
  u.id,
  u.email,
  u.streak,
  u.level,
  u.last_visit,
  u.created_at,
  COUNT(b.id) as total_bookmarks,
  COUNT(DISTINCT ps.id) as push_subscriptions
FROM users u
LEFT JOIN bookmarks b ON u.id = b.user_id
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
GROUP BY u.id;
-- Creators Circle
CREATE TABLE IF NOT EXISTS creators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  x_handle TEXT UNIQUE NOT NULL,
  x_user_id TEXT,
  name TEXT,
  bio TEXT,
  avatar_url TEXT,
  categories TEXT NOT NULL DEFAULT '[]',
  is_verified BOOLEAN DEFAULT FALSE,
  reciprocity_score INTEGER DEFAULT 0,
  joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_active TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_creators_x_handle ON creators(x_handle);
CREATE INDEX IF NOT EXISTS idx_creators_verified ON creators(is_verified);

-- Circle Posts (cached from X API)
CREATE TABLE IF NOT EXISTS circle_posts (
  id TEXT PRIMARY KEY,
  creator_id INTEGER REFERENCES creators(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT DEFAULT '[]',
  posted_at TEXT NOT NULL,
  positivity_score REAL DEFAULT 0.5,
  engagement INTEGER DEFAULT 0,
  amplified_by TEXT DEFAULT '[]',
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_circle_posted_at ON circle_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_circle_positivity ON circle_posts(positivity_score);

-- Circle subscriptions (who gets notified)
CREATE TABLE IF NOT EXISTS circle_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER REFERENCES creators(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL,
  channels TEXT DEFAULT '["web_push"]',
  keywords TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Amplification tracking
CREATE TABLE IF NOT EXISTS amplifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_post_id TEXT REFERENCES circle_posts(id) ON DELETE CASCADE,
  amplifier_handle TEXT NOT NULL,
  amplified_at TEXT DEFAULT CURRENT_TIMESTAMP
);

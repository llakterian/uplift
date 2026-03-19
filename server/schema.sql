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
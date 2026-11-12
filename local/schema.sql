-- Local SQLite schema for BGA Tichu Runner

DROP TABLE IF EXISTS player;
CREATE TABLE player (
  player_id INTEGER PRIMARY KEY,
  player_no INTEGER NOT NULL DEFAULT 0,
  player_name TEXT NOT NULL DEFAULT '',
  player_color TEXT NOT NULL DEFAULT '000000',
  player_canal TEXT NOT NULL DEFAULT '',
  player_avatar TEXT NOT NULL DEFAULT '',
  player_score INTEGER NOT NULL DEFAULT 0,
  player_score_aux INTEGER NOT NULL DEFAULT 0,
  player_zombie INTEGER NOT NULL DEFAULT 0,
  player_eliminated INTEGER NOT NULL DEFAULT 0,
  player_is_multiactive INTEGER NOT NULL DEFAULT 0,
  player_team INTEGER NOT NULL DEFAULT -1,
  player_call_tichu INTEGER NOT NULL DEFAULT -1,
  player_call_grand_tichu INTEGER NOT NULL DEFAULT -1,
  player_has_bomb INTEGER NOT NULL DEFAULT 0,
  player_pass INTEGER NOT NULL DEFAULT 0
);

DROP TABLE IF EXISTS global;
CREATE TABLE global (
  global_id INTEGER PRIMARY KEY,
  global_value INTEGER NOT NULL DEFAULT 0
);

DROP TABLE IF EXISTS stats;
CREATE TABLE stats (
  stats_type TEXT NOT NULL,
  stats_player_id INTEGER NOT NULL DEFAULT 0,
  stats_value REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (stats_type, stats_player_id)
);

DROP TABLE IF EXISTS card;
CREATE TABLE card (
  card_id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_type TEXT NOT NULL,
  card_type_arg INTEGER NOT NULL,
  card_location TEXT NOT NULL,
  card_location_arg INTEGER NOT NULL DEFAULT 0,
  card_passed_from INTEGER DEFAULT NULL
);

DROP TABLE IF EXISTS actionlog;
CREATE TABLE actionlog (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_player INTEGER NOT NULL,
  log_round INTEGER NOT NULL,
  log_trick INTEGER NOT NULL,
  log_action TEXT NOT NULL,
  log_arg TEXT
);

DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  packet_id INTEGER PRIMARY KEY AUTOINCREMENT,
  move_id INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL,
  type TEXT NOT NULL,
  log TEXT NOT NULL DEFAULT '',
  args TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0
);

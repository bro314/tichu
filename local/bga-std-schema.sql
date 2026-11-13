CREATE TABLE IF NOT EXISTS `global` (
  `global_id` int(10) unsigned NOT NULL,
  `global_value` int(11) NOT NULL,
  PRIMARY KEY (`global_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `player` (
  `player_id` int(11) NOT NULL,
  `player_name` varchar(32) NOT NULL,
  `player_color` varchar(6) NOT NULL,
  `player_no` int(10) NOT NULL,
  `player_score` int(11) NOT NULL DEFAULT 0,
  `player_score_aux` int(11) NOT NULL DEFAULT 0,
  `player_zombie` tinyint(1) NOT NULL DEFAULT 0,
  `player_eliminated` tinyint(1) NOT NULL DEFAULT 0,
  `player_next_notif_no` int(11) NOT NULL DEFAULT 0,
  `player_enter_game` tinyint(1) NOT NULL DEFAULT 0,
  `player_ai` tinyint(1) NOT NULL DEFAULT 0,
  `player_beginner` varbinary(16) DEFAULT NULL,
  `player_is_multiactive` tinyint(1) NOT NULL DEFAULT 0,
  `player_state` int(10) unsigned DEFAULT NULL,
  `player_over_time` tinyint(1) NOT NULL DEFAULT 0,
  `player_remaining_reflexion_time` int(11) NOT NULL DEFAULT 0,
  `player_start_reflexion_time` datetime DEFAULT NULL,
  `player_avatar` varchar(10) NOT NULL DEFAULT '000000',
  `player_canal` varchar(32) NOT NULL DEFAULT '',
  PRIMARY KEY (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stats` (
  `stats_type` int(11) NOT NULL,
  `stats_player_id` int(11) DEFAULT NULL,
  `stats_value` float NOT NULL DEFAULT 0,
  UNIQUE KEY `stat_unique` (`stats_type`, `stats_player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gamelog` (
  `gamelog_packet_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gamelog_move_id` int(11) DEFAULT NULL,
  `gamelog_private` tinyint(1) NOT NULL DEFAULT 0,
  `gamelog_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gamelog_player` int(11) DEFAULT NULL,
  `gamelog_current_player` int(11) NOT NULL,
  `gamelog_notification` mediumtext NOT NULL,
  PRIMARY KEY (`gamelog_packet_id`),
  KEY `idx_gamelog_move` (`gamelog_move_id`),
  KEY `idx_gamelog_player` (`gamelog_player`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `replaysavepoint` (
  `rsp_player_id` int(11) NOT NULL,
  `rsp_move_id` int(11) NOT NULL,
  `rsp_gamedatas` mediumtext NOT NULL,
  PRIMARY KEY (`rsp_player_id`, `rsp_move_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `bga_user_preferences` (
  `pgp_player` int(10) UNSIGNED NOT NULL,
  `pgp_preference_id` int(10) UNSIGNED NOT NULL,
  `pgp_value` int(11) NOT NULL,
  PRIMARY KEY (`pgp_player`, `pgp_preference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `playermultiactive` (
  `ma_player_id` int(11) NOT NULL,
  `ma_is_multiactive` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`ma_player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

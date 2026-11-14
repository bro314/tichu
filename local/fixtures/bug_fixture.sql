-- Sanitized synthetic BGA production bug report dump for testing DebugTrait & import-bug-sql.php
-- Production player IDs: 90001 (seat 1, Team 0), 90002 (seat 2, Team 1), 90003 (seat 3, Team 0), 90004 (seat 4, Team 1)
/*!40101 SET NAMES utf8mb4 */;

LOCK TABLES `player` WRITE;
INSERT INTO `player` (`player_id`, `player_name`, `player_color`, `player_no`, `player_score`, `player_score_aux`, `player_zombie`, `player_eliminated`, `player_next_notif_no`, `player_enter_game`, `player_ai`, `player_beginner`, `player_is_multiactive`, `player_state`, `player_over_time`, `player_remaining_reflexion_time`, `player_start_reflexion_time`, `player_avatar`, `player_canal`, `player_team`, `player_call_tichu`, `player_call_grand_tichu`, `player_has_bomb`, `player_pass`) VALUES
(90001, 'prod_alice', '000000', 1, 150, 0, 0, 0, 12, 1, 0, NULL, 1, 99, 0, 600, NULL, '000000', 'canal_90001', 0, 100, 0, 0, 0),
(90002, 'prod_bob', 'ff0000', 2, 85, 0, 0, 0, 12, 1, 0, NULL, 0, 99, 0, 600, NULL, '000000', 'canal_90002', 1, 0, 0, 0, 0),
(90003, 'prod_carol', '000000', 3, 150, 0, 0, 0, 12, 1, 0, NULL, 0, 99, 0, 600, NULL, '000000', 'canal_90003', 0, -1, 0, 0, 1),
(90004, 'prod_dave', 'ff0000', 4, 85, 0, 0, 0, 12, 1, 0, NULL, 0, 99, 0, 600, NULL, '000000', 'canal_90004', 1, 0, 200, 0, 0);
UNLOCK TABLES;

INSERT INTO `playermultiactive` (`ma_player_id`, `ma_is_multiactive`) VALUES
(90001, 1),
(90002, 0),
(90003, 0),
(90004, 0);

INSERT INTO `bga_user_preferences` (`pgp_player`, `pgp_preference_id`, `pgp_value`) VALUES
(90001, 100, 1),
(90002, 100, 2);

INSERT INTO `replaysavepoint` (`rsp_player_id`, `rsp_move_id`, `rsp_gamedatas`) VALUES
(90001, 1, '{"round":1}');

INSERT INTO `global` (`global_id`, `global_value`) VALUES
(1, 99),
(2, 90002),
(3, 15),
(4, 1237),
(5, 90001),
(6, 12),
(7, 50),
(8, 300),
(9, 30),
(21, 90001),
(22, 0),
(23, -1),
(26, 9),
(27, 90003),
(28, 0),
(30, 17),
(100, 2),
(101, 1),
(102, 1),
(200, 1),
(201, 0),
(207, 0),
(302, 90004);

-- All 56 Tichu cards across captured, hand, temporary, and combos
INSERT INTO `card` (`card_id`, `card_type`, `card_type_arg`, `card_location`, `card_location_arg`, `card_passed_from`) VALUES
(1, '1', 1, 'captured', 90001, 90002),
(2, '2', 1, 'hand', 90002, NULL),
(3, '3', 1, 'captured', 90003, 90004),
(4, '4', 1, 'captured', 90001, NULL),
(5, '1', 2, 'captured', 90001, NULL),
(6, '1', 3, 'captured', 90001, NULL),
(7, '1', 4, 'captured', 90001, NULL),
(8, '1', 5, 'captured', 90001, NULL),
(9, '1', 6, 'captured', 90001, NULL),
(10, '1', 7, 'captured', 90001, NULL),
(11, '1', 8, 'captured', 90001, NULL),
(12, '1', 9, 'captured', 90001, NULL),
(13, '1', 10, 'captured', 90001, NULL),
(14, '1', 11, 'captured', 90001, NULL),
(15, '1', 12, 'captured', 90001, NULL),
(16, '1', 13, 'captured', 90001, NULL),
(17, '1', 14, 'combos', 0, NULL),
(18, '2', 2, 'hand', 90002, 90001),
(19, '2', 3, 'hand', 90002, NULL),
(20, '2', 4, 'hand', 90002, NULL),
(21, '2', 5, 'hand', 90002, NULL),
(22, '2', 6, 'hand', 90002, NULL),
(23, '2', 7, 'hand', 90002, NULL),
(24, '2', 8, 'hand', 90002, NULL),
(25, '2', 9, 'hand', 90002, NULL),
(26, '2', 10, 'hand', 90002, NULL),
(27, '2', 11, 'hand', 90002, NULL),
(28, '2', 12, 'hand', 90002, NULL),
(29, '2', 13, 'hand', 90002, NULL),
(30, '2', 14, 'combos', 0, NULL),
(31, '3', 2, 'hand', 90003, 90004),
(32, '3', 3, 'hand', 90003, NULL),
(33, '3', 4, 'hand', 90003, NULL),
(34, '3', 5, 'hand', 90003, NULL),
(35, '3', 6, 'hand', 90003, NULL),
(36, '3', 7, 'hand', 90003, NULL),
(37, '3', 8, 'hand', 90003, NULL),
(38, '3', 9, 'hand', 90003, NULL),
(39, '3', 10, 'hand', 90003, NULL),
(40, '3', 11, 'hand', 90003, NULL),
(41, '3', 12, 'hand', 90003, NULL),
(42, '3', 13, 'hand', 90003, NULL),
(43, '3', 14, 'temporary', 90003, 90001),
(44, '4', 2, 'hand', 90004, 90003),
(45, '4', 3, 'hand', 90004, NULL),
(46, '4', 4, 'hand', 90004, NULL),
(47, '4', 5, 'hand', 90004, NULL),
(48, '4', 6, 'hand', 90004, NULL),
(49, '4', 7, 'hand', 90004, NULL),
(50, '4', 8, 'hand', 90004, NULL),
(51, '4', 9, 'hand', 90004, NULL),
(52, '4', 10, 'hand', 90004, NULL),
(53, '4', 11, 'hand', 90004, NULL),
(54, '4', 12, 'hand', 90004, NULL),
(55, '4', 13, 'hand', 90004, NULL),
(56, '4', 14, 'hand', 90004, NULL);

INSERT INTO `actionlog` (`log_id`, `log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES
(1, 0, 1, 0, 'newRound', '[]'),
(2, 90001, 1, 0, 'tichuCall', '1700000000'),
(3, 0, 1, 1, 'newTrick', '[]'),
(4, 90001, 1, 1, 'combo', '{"description":"Pair of 2&#39;s","type":2,"cards":[{"id":"5","type":"1","type_arg":"2"},{"id":"18","type":"2","type_arg":"2"}],"phoenixValue":null}'),
(5, 90002, 1, 1, 'combo', '{"description":"Pair of Aces","type":2,"cards":[{"id":"17","type":"1","type_arg":"14"},{"id":"30","type":"2","type_arg":"14"}],"phoenixValue":null}'),
(6, 90003, 1, 1, 'changePlayer', '{"transition":"playBomb","active":90001,"last":"playCombo"}'),
(7, 90003, 1, 1, 'pass', '[]'),
(8, 90002, 1, 1, 'confirm', '{"nextPlayer":90002,"dragon":false}');

INSERT INTO `gamelog` (`gamelog_packet_id`, `gamelog_move_id`, `gamelog_private`, `gamelog_time`, `gamelog_player`, `gamelog_current_player`, `gamelog_notification`) VALUES
(1, 1, 1, '2026-01-01 00:00:01', 90001, 90001, '[{"type":"dealCards","log":"A new round starts.","args":{"cards":[{"id":"5","type":"1","type_arg":"2","location":"hand","location_arg":"90001"}]}}]'),
(2, 2, 1, '2026-01-01 00:00:02', 90003, 90003, '[{"type":"acceptCards","log":"You have accepted cards.","args":{"cards":[{"id":"43","type":"3","type_arg":"14","passed_from":"90001"}],"card1":"Ace","card2":"2","card3":"3"}}]'),
(3, 3, 0, '2026-01-01 00:00:03', NULL, 90002, '[{"type":"playCombo","log":"${player_name} plays ${combo_name}","args":{"i18n":["combo_name"],"player_id":90002,"player_name":"prod_bob","combo_name":"Pair of Aces","cards":[{"id":"17","type":"1","type_arg":"14"},{"id":"30","type":"2","type_arg":"14"}],"points":0,"type":2,"phoenixValue":null}}]'),
(4, 4, 0, '2026-01-01 00:00:04', NULL, 90001, '[{"type":"playerGoOut","log":"${player_name} has shed the cards from hand","args":{"firstout_id":90001,"player_id":90001,"player_name":"prod_alice"}},{"type":"newScores","log":"","args":{"newScores":{"90001":150,"90002":85,"90003":150,"90004":85}}}]'),
(5, 5, 0, '2026-01-01 00:00:05', NULL, 90002, '[{"type":"gameStateChange","log":"","args":{"id":"75","name":"confirmTrick","active_player":"90002","multiactive":["90001","90002"],"_notified_privately":[90001],"args":{"_private":{"90001":{"values":[4,9]}}},"reflexion":{"total":{"90001":120,"90002":115,"90003":110,"90004":105}}}},{"type":"gameStateMultipleActiveUpdate","log":"","args":["90001","90002","90003","90004"]}]');

INSERT INTO `stats` (`stats_type`, `stats_player_id`, `stats_value`) VALUES
(10, NULL, 1),
(11, NULL, 3),
(10, 90001, 2),
(10, 90002, 1),
(10, 90003, 0),
(10, 90004, 0);

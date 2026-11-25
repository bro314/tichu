<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once "tests/stubs.php";
require_once "modules/Constants.php";
require_once "modules/managers/PlayerManager.php";

final class PlayerManagerTest extends TestCase
{
  public function testComputeTeamScoresDoesNotDoubleCountTeammates(): void
  {
    $players = [
      1 => ["id" => "1", "team" => "0", "score" => "-150"],
      2 => ["id" => "2", "team" => "1", "score" => "250"],
      3 => ["id" => "3", "team" => "0", "score" => "-150"],
      4 => ["id" => "4", "team" => "1", "score" => "250"],
    ];

    $scores = PlayerManager::computeTeamScores($players);
    $this->assertSame([0 => -150, 1 => 250], $scores);
  }

  public function testComputeTeamScoresSupportsRawPlayerColumns(): void
  {
    $players = [
      10 => ["player_team" => 1, "player_score" => 400],
      20 => ["player_team" => 0, "player_score" => 100],
      30 => ["player_team" => 1, "player_score" => 400],
      40 => ["player_team" => 0, "player_score" => 100],
    ];

    $scores = PlayerManager::computeTeamScores($players);
    $this->assertSame([0 => 100, 1 => 400], $scores);
  }
}
?>

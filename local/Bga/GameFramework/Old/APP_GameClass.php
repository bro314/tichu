<?php
/**
 * APP_GameClass.php
 *
 *
 * Base class for every game module
 *
 */
declare(strict_types=1);

namespace Bga\GameFramework\Old;

abstract class APP_GameClass extends APP_DbObject {
  /**
   * This function is only kept to have compatibility for games using deck with that call.
   * 
   * 📖 was a documented function.
   * 
   * @deprecated use getNewDeck($tableName)
   */
  protected final function getNew($objectName) {
    if ($objectName === "module.common.deck") {
      return new \Bga\GameFramework\Components\Deck();
    }
    throw new \BgaSystemException("Unknown game module (getNew): ".$objectName);
  }

  // TODO move this function into Table, remove the 2 others that are unused, move getNew to parent or child, and then change games extending APP_GameClass to APP_DbObject before we can remove this class
  protected function notifyNow(
    $channel,
    $notification_type,
    $notification_log,
    $notification_args,
    $alternative_centrifuge = null,
    $alternative_centrifuge_table_id = null,
    $alternative_centrifuge_realtime = null
  ): void {
      global $bgaContainer;
      $bgaContainer->get(\Bga\Services\Notify::class)->notifyNow($channel, $notification_type, $notification_log, $notification_args, $alternative_centrifuge, $alternative_centrifuge_table_id, $alternative_centrifuge_realtime);
  }

  // Used to store notifications instead of sending them, to send them later
  // This is important if a notification is sent early, but could get later invalidated by a thrown error
    public function startStoringNotifyNow(): void {
      global $bgaContainer;
      $bgaContainer->get(\Bga\Services\Notify::class)->startStoringNotifyNow();
  }

    public function stopStoringNotifyNow(): void {
      global $bgaContainer;
      $bgaContainer->get(\Bga\Services\Notify::class)->stopStoringNotifyNow();
  }
}



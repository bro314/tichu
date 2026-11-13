<?php

declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Runtime state for namespaced game autoloading.
 *
 * The restriction is set while loading or running one game so a
 * Bga\Games\<OtherGame>\... reference cannot pull PHP from another release.
 */
final class BgaGameAutoloader
{
    private static ?string $restrictedGameName = null;
    private static bool $isRegistered = false;

    public static function register(): void
    {
        if (self::$isRegistered) {
            return;
        }

        spl_autoload_register([self::class, 'autoloadGameClass']);
        self::$isRegistered = true;
    }

    public static function restrictToGame(string $gameName): void
    {
        self::$restrictedGameName = $gameName;
    }

    public static function runWithGameRestriction(string $gameName, callable $callback): mixed
    {
        $previousRestrictedGameName = self::$restrictedGameName;
        self::restrictToGame($gameName);

        try {
            return $callback();
        } finally {
            self::$restrictedGameName = $previousRestrictedGameName;
        }
    }

    public static function autoloadGameClass(string $className): void
    {
        if (!preg_match("/^Bga\\\\Games\\\\(\w+)\\\\(.*)$/", $className, $matches)) {
            // Not the game class namespace
            return;
        }
        $gameName = strtolower($matches[1]);
        $relativeClassName = $matches[2];

        if (self::$restrictedGameName !== null && $gameName !== self::$restrictedGameName) {
            throw new \BgaSystemException(
                'Game autoloader is configured for project ' .
                    self::$restrictedGameName .
                    " and cannot load $className from project $gameName",
            );
        }

        $gameRootPath = APP_GAMES_PATH . "$gameName/current";
        $directoryPath = $gameRootPath . '/modules/php';

        $classFilePath = $directoryPath . '/' . str_replace('\\', DIRECTORY_SEPARATOR, $relativeClassName) . '.php';
        if (!file_exists($classFilePath)) {
            return;
        }
        require_once $classFilePath;
    }
}

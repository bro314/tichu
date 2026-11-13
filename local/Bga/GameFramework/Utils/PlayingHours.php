<?php

declare(strict_types=1);

namespace Bga\GameFramework\Utils;

/**
 * Calculates elapsed and deadline timestamps for the shared playing-hours profiles.
 */
final class PlayingHours
{
    public function elapsedSeconds(int $start, int $end, int $nightProfile): int
    {
        $nightProfile = $this->normalizeNightProfile($nightProfile);

        if ($nightProfile > 24 || $nightProfile === 0) {
            return $end - $start;
        }

        if ($end < $start) {
            return -$this->elapsedSeconds($end, $start, $nightProfile);
        }

        $elapsed = 0;
        $cursor = $start;
        $dayStart = $this->getDayStart($nightProfile);
        $nightStart = $this->getNightStart($nightProfile);

        while ($cursor < $end) {
            if ($this->isAtNight($cursor, $nightProfile)) {
                $cursor = min($end, $this->getNextBerlinHourTimestamp($cursor, $dayStart));
                continue;
            }

            $nextNightStart = $this->getNextBerlinHourTimestamp($cursor, $nightStart);
            if ($nextNightStart >= $end) {
                return $elapsed + ($end - $cursor);
            }

            $elapsed += $nextNightStart - $cursor;
            $cursor = $nextNightStart;
        }

        return $elapsed;
    }

    public function addSeconds(int $start, ?int $seconds, int $nightProfile): int
    {
        $seconds = (int) $seconds;
        $nightProfile = $this->normalizeNightProfile($nightProfile);

        if ($nightProfile > 24 || $nightProfile === 0 || $seconds < 0) {
            return $start + $seconds;
        }

        $cursor = $start;
        $remaining = $seconds;
        $dayStart = $this->getDayStart($nightProfile);
        $nightStart = $this->getNightStart($nightProfile);

        if ($remaining === 0 && $this->isAtNight($cursor, $nightProfile)) {
            return $this->getNextBerlinHourTimestamp($cursor, $dayStart);
        }

        while ($remaining > 0) {
            if ($this->isAtNight($cursor, $nightProfile)) {
                $cursor = $this->getNextBerlinHourTimestamp($cursor, $dayStart);
                continue;
            }

            $nextNightStart = $this->getNextBerlinHourTimestamp($cursor, $nightStart);
            $daylightSeconds = $nextNightStart - $cursor;
            if ($remaining <= $daylightSeconds) {
                return $cursor + $remaining;
            }

            $remaining -= $daylightSeconds;
            $cursor = $nextNightStart;
        }

        return $cursor;
    }

    private function getNightStart(int $nightProfile): int
    {
        return ($nightProfile - 1 + 12) % 24;
    }

    private function getDayStart(int $nightProfile): int
    {
        return ($nightProfile - 1) % 24;
    }

    private function getNextBerlinHourTimestamp(int $timestamp, int $hour): int
    {
        $timezone = new \DateTimeZone('Europe/Berlin');
        $localDateTime = (new \DateTimeImmutable('@' . $timestamp))->setTimezone($timezone);
        $boundary = $localDateTime->setTime($hour, 0, 0);

        if ($boundary->getTimestamp() < $timestamp) {
            $boundary = $boundary->modify('+1 day')->setTime($hour, 0, 0);
        }

        return $boundary->getTimestamp();
    }

    private function isAtNight(int $timestamp, int $nightProfile): bool
    {
        $hour = (int) (new \DateTimeImmutable('@' . $timestamp))
            ->setTimezone(new \DateTimeZone('Europe/Berlin'))
            ->format('G');
        $nightStart = $this->getNightStart($nightProfile);

        return (($hour - $nightStart + 24) % 24) < 12;
    }

    private function normalizeNightProfile(int $nightProfile): int
    {
        return $nightProfile < 0 ? (($nightProfile % 24) + 24) % 24 : $nightProfile;
    }
}

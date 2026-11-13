<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\ItemManager;

use Bga\GameFramework\SystemException;

class Location {
    /**
     * @var array<int, mixed>
     */
    public array $locations;

    private function __construct(
        array|string|int|Location $locations,
        public bool $filter = false,
    ) {
        if ($locations instanceof Location) {
            $locations = $locations->locations;
        }

        $this->locations = is_array($locations) ? $locations : [$locations];

        if (!array_is_list($this->locations)) {
            throw new SystemException('Location array should not be an associative array but a 0 indexed array ('.json_encode($this->locations).')');
        }

        $this->locations = $this->trimTrailingNullLocations($this->locations);

        if (empty($this->locations)) {
            throw new SystemException('Location array should not be empty ('.json_encode($this->locations).')');
        }

        foreach ($this->locations as $index => $location) {
            if (is_array($location)) {
                $this->validateFilterValueList($location);
                continue;
            }
            if ($index === 0 && (!is_string($location) && !is_int($location))) {
                throw new SystemException('First location parameter should be a string/integer ('.json_encode($this->locations).')');
            }
            if (!$this->filter && !is_string($location) && !is_int($location)) {
                throw new SystemException('Location array parameters should be strings/integers ('.json_encode($this->locations).')');
            }
        }
    }

    /**
     * @param array<int, mixed> $locations
     */
    private function validateFilterValueList(array $locations): void {
        if (!$this->filter) {
            throw new SystemException('Location array parameters should be strings/integers ('.json_encode($this->locations).')');
        }
        if (!array_is_list($locations)) {
            throw new SystemException('Location filter array values should be 0 indexed arrays ('.json_encode($this->locations).')');
        }
        if (count($locations) === 0) {
            throw new SystemException('Location filter array values should not be empty ('.json_encode($this->locations).')');
        }

        $allInts = true;
        $allStrings = true;
        foreach ($locations as $location) {
            $allInts = $allInts && is_int($location);
            $allStrings = $allStrings && is_string($location);
        }

        if (!$allInts && !$allStrings) {
            throw new SystemException('Location filter array values should contain only strings or only integers ('.json_encode($this->locations).')');
        }
    }

    public static function from(array|string|int|Location $location, string|int|null ...$locations): self {
        if ($locations === []) {
            if ($location instanceof Location && $location->filter) {
                throw new SystemException('Location filter cannot be used as a concrete location');
            }
            return new self($location);
        }

        if ($location instanceof Location) {
            throw new SystemException('Location should have only one parameter if the first parameter is a Location');
        }
        if (is_array($location)) {
            throw new SystemException('Location should have only one parameter if the first parameter is an array');
        }

        return new self([$location, ...$locations]);
    }

    public static function filter(array|string|int|Location $location, string|int|array|null ...$locations): self {
        if ($locations === []) {
            return new self($location, true);
        }

        if ($location instanceof Location) {
            throw new SystemException('Location filter should have only one parameter if the first parameter is a Location');
        }
        if (is_array($location)) {
            throw new SystemException('Location filter should have only one parameter if the first parameter is an array');
        }

        return new self([$location, ...$locations], true);
    }

    /**
     * @return array<int, string|int|null|array<int, string>|array<int, int>>
     */
    private function trimTrailingNullLocations(array $locations): array {
        $locations = array_values($locations);
        while (count($locations) > 0 && $locations[count($locations) - 1] === null) {
            array_pop($locations);
        }

        return $locations;
    }
}

<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\ItemManager;

/**
 * A description of an item field. Used to map to and from the DB, and to generate the DB table.
 */
#[\Attribute(\Attribute::TARGET_PROPERTY)]
class ItemField {
    /**
     * The name of the field.
     */
    public string $name;

    /**
     * The type of the data stored in that field.
     * Must be in ['bool', 'int', 'float', 'double', 'string', 'json'].
     */
    public string $type;

    /**
     * The name of the DB column.
     */
    public string $dbField;

    /**
     * The class of the object.
     * Only used if the type is json and a specific class has been set as a type.
     */
    public ?string $class = null;

    public function __construct(
        /**
         * Set to identify mandatory field. Keep it null for standard (custom) fields.
         * 
         * Mandatory fields are :
         * ItemField(kind: ItemFieldKind::ID)
         * ItemField(kind: ItemFieldKind::LOCATION)
         * ItemField(kind: ItemFieldKind::ORDER)
         */
        public ?ItemFieldKind $kind = null,

        /**
         * The type of the data stored in that field.
         * Must be in ['bool', 'int', 'float', 'double', 'string', 'json'].
         */
        ?string $type = null,

        /**
         * The name of the DB column, if different from the field name;
         */
        ?string $dbField = null,

        /**
         * For objects, indicates if they are stored as PHP serialized object. Default false store it in DB as JSON.
         */
        public bool $serialize = false,

        /**
         * For LOCATION fields, the index order them
         */
        public int $locationIndex = 0,
    ) {
        if (isset($type)) {
            $this->type = $type;
        }
        if (isset($dbField)) {
            $this->dbField = $dbField;
        }
    }
}

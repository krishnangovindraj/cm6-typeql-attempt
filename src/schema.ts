
type TypeLabel = string;
type AttributeType = {};

interface ObjectType {
    owns: TypeLabel[];
    plays: TypeLabel[];
    relates: TypeLabel[];
};

class Schema {
    objectTypes: Record<TypeLabel, ObjectType>;
    attributes: Record<TypeLabel, AttributeType>;
    constructor(
        objectTypes: Record<TypeLabel, ObjectType>,
        attributes: Record<TypeLabel, AttributeType>,
    ) {
        this.attributes = attributes;
        this.objectTypes = objectTypes;
    }

    attributeType(type: TypeLabel): AttributeType {
        return this.attributes[type];
    }
    objectType(type: TypeLabel): ObjectType {
        return this.objectTypes[type];
    }

    getOwns(label: TypeLabel): TypeLabel[] {
        const objectType = this.objectType(label);
        return objectType ? objectType.owns : [];
    }

    getPlays(label: TypeLabel): TypeLabel[] {
        const objectType = this.objectType(label);
        return objectType ? objectType.plays : [];
    }
    getRelates(label: TypeLabel): TypeLabel[] {
        const objectType = this.objectType(label);
        return objectType ? objectType.relates : [];
    }
}

class SchemaBuilder {
    objectTypes: Record<TypeLabel, ObjectType>;
    attributes: Record<TypeLabel, AttributeType>;
    
    constructor() {
        this.objectTypes = {};
        this.attributes = {};
    }

    attributeType(type: TypeLabel): AttributeType {
        if (!this.attributes[type]) {
            this.attributes[type] = { owners: [] };
        }
        return this.attributes[type];
    }
    
    objectType(type: TypeLabel): ObjectType {
        if (!this.objectTypes[type]) {
            this.objectTypes[type] = { owns: [], plays: [], relates: [] };
        }
        return this.objectTypes[type];
    }

    recordOwns(type: TypeLabel, ownedType: TypeLabel): void {
        const objectType = this.objectType(type);
        if (!objectType.owns.includes(ownedType)) {
            objectType.owns.push(ownedType);
        }
    }
    recordPlays(type: TypeLabel, playedType: TypeLabel): void {
        const objectType = this.objectType(type);
        if (!objectType.plays.includes(playedType)) {
            objectType.plays.push(playedType);
        }
    }
    recordRelates(type: TypeLabel, relatedType: TypeLabel): void {
        const objectType = this.objectType(type);
        if (!objectType.relates.includes(relatedType)) {
            objectType.relates.push(relatedType);
        }
    }

    build(): Schema {
        return new Schema(this.objectTypes, this.attributes);
    }
}

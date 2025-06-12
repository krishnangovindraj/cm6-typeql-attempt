import { SyntaxNode, NodeType, Tree, TreeCursor } from "@lezer/common"
import {parser} from "./typeql.grammar"
import * as tokens from "./generated/typeql.grammar.generated.terms";

type TypeLabel = string;
type AttributeType = {};

interface ObjectType {
    owns: TypeLabel[];
    plays: TypeLabel[];
    relates: TypeLabel[];
};

function extractText(text: string, from: number, to: number): string {
    return text.slice(from, to);
}

export class Schema {
    objectTypes: Record<TypeLabel, ObjectType>;
    attributes: Record<TypeLabel, AttributeType>;
    constructor(
        objectTypes: Record<TypeLabel, ObjectType>,
        attributes: Record<TypeLabel, AttributeType>,
    ) {
        this.attributes = attributes;
        this.objectTypes = objectTypes;
    }
    
    static fromTypeQL(text: string) : Schema {
        let tree = parser.parse(text);
        let builder = new SchemaBuilder();
        // Extract all type declarations from the tree
        tree.iterate({
            enter: (cursor: TreeCursor) => {
                let node = cursor.node;
                if (node.type?.id === tokens.DefinitionType) {
                    if (node.firstChild?.type?.id === tokens.KIND) {
                        let labelNode = node.firstChild!.nextSibling!;
                        let label = extractText(text, labelNode.from, labelNode.to);
                        let kind = extractText(text, node.firstChild!.from, node.firstChild!.to);
                        switch (kind) {
                            case "entity": {
                                builder.objectType(label);
                                 break;
                            }
                            case "relation": {
                                builder.objectType(label);
                                 break;
                            }
                            case "attribute": {
                                builder.attributeType(label);
                                 break;
                            }
                        }
                    }
                }
            }
        });

        // Extract owns/relates/plays. Idk what to do with sub or annotations.
        tree.iterate({
            enter: (cursor: TreeCursor) => {
                let node = cursor.node;
                if (node.type.id === tokens.DefinitionType) {
                    let labelNode = (node.firstChild?.type?.id === tokens.KIND) ? node.firstChild!.nextSibling! : node.firstChild!;
                    let label = extractText(text, labelNode.from, labelNode.to);
                    node.getChildren(tokens.TypeCapability).forEach((typeCapabilityBaseNode: SyntaxNode) => {
                        let actualCapabilityNode = typeCapabilityBaseNode.firstChild!.firstChild!;
                        switch (actualCapabilityNode.type.id) {
                            // We actually only want type-declarations for now.
                            case tokens.RelatesDeclaration: {
                                let roleTypeNode = actualCapabilityNode.firstChild!.nextSibling!;
                                let roleType = extractText(text, roleTypeNode.from, roleTypeNode.to);
                                builder.recordRelates(label, `${label}:${roleType}`);
                                break;
                            }
                            default: {
                                // Ignore other capabilities for now
                                break;
                            }
                        }
                    });
                }
            }
        });
        return builder.build();
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
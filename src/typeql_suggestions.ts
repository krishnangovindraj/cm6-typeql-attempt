import * as tokens from "./generated/typeql.grammar.generated.terms";
import { CompletionContext, Completion, CompletionResult } from "@codemirror/autocomplete";
import { SyntaxNode, NodeType, Tree } from "@lezer/common"
import { SuggestionMap, SuffixOfPrefixSuggestion, suggest } from "./complete";

// The actual suggestions
// TODO: See if we can make this declarative based on token sequences expected as prefixes of a given node.
function suggestLabels(context: CompletionContext, tree: Tree): Completion[] {
    // TODO: We could do better by climbing up the tree using `atNode.parentNode` to predict based on position as well.
    // We could also refine the suggestions by creating datastructures based on the declarations in the schema, rather than blindly suggesting every label.
    var options: Completion[] = [];
    tree.iterate({
        enter: (other: SyntaxNode) => {
            if (other.type.id == tokens.LABEL) {
                let label = context.state.sliceDoc(other.from, other.to);
                options.push(suggest("type", label));
            }
        }
    });
    return options;

}

function suggestVariables(context: CompletionContext, tree: Tree, boost=0): Completion[] {
    var options: Completion[] = [];
    tree.iterate({
        enter: (other: SyntaxNode) => {
            if (other.type.id == tokens.VAR) {
                let varName = context.state.sliceDoc(other.from, other.to);
                options.push(suggest("variable", varName, 0));
            }
        }
    });
    return options;
}

function suggestVariablesAt10(context: CompletionContext, tree: Tree): Completion[] {
    return suggestVariables(context, tree, 10);
}

function suggestVariablesAtMinus10(context: CompletionContext, tree: Tree): Completion[] {
    return suggestVariables(context, tree, -10);
}


function suggestThingConstraintKeywords(): Completion[] {
    return ["isa", "has", "links"].map((constraintName) => {
        return {
            label: constraintName,
            type: "thingConstraint",
            apply: constraintName,
            info: "Thing constraint keyword",
        };
    });
}
function suggestTypeConstraintKeywords(): Completion[] {
    return ["sub", "owns", "relates", "plays"].map((constraintName) => {
        return {
            label: constraintName,
            type: "typeConstraint",
            apply: constraintName,
            info: "Type constraint keyword",
        };
    });
}

function suggestDefinedKeywords(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, patternsNode: SyntaxNode, prefix: NodeType[]): Completion[] {
    return ["define", "redefine", "undefine"].map((keyword) => suggest("keyword", keyword, 1));
}

function suggestPipelineStages(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, patternsNode: SyntaxNode, prefix: NodeType[]): Completion[] {
    return ["match", "insert", "delete", "update", "put", "select", "reduce", "sort", "limit", "offset", "end"].map((keyword) => suggest("keyword", keyword, 1))
}

function suggestKinds(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, patternsNode: SyntaxNode, prefix: NodeType[]): Completion[] {
    return ["entity", "attribute", "relation"].map((keyword) => suggest("kind", keyword, 2));
}

function suggestNestedPatterns(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, patternsNode: SyntaxNode, prefix: NodeType[]): Completion[] {
    return ["not {};", "{} or {};", "try {};"].map((keyword) => suggest("method", keyword, 2));
}

// Hopefully you only have to touch this.

const SUFFIX_VAR_OR_COMMA = [[tokens.COMMA], [tokens.VAR]];



const SUGGESTION_GROUP_FOR_THING_STATEMENTS: SuffixOfPrefixSuggestion[]  = [
        { suffixes: SUFFIX_VAR_OR_COMMA, suggestions: [suggestThingConstraintKeywords] },
        { suffixes: [[tokens.HAS], [tokens.ISA]], suggestions: [suggestLabels, suggestVariablesAtMinus10] },
        { suffixes: [[tokens.HAS, tokens.TypeRef], [tokens.ISA, tokens.TypeRef]], suggestions: [suggestVariablesAtMinus10] },
];

export const SUGGESTION_MAP: SuggestionMap = {
    [tokens.LABEL]: [{ suffixes: [[]], suggestions: [suggestLabels] }],
    [tokens.VAR]: [{ suffixes: [[]], suggestions: [suggestVariablesAt10] }],
        
    [tokens.Statement]: [
        { suffixes: SUFFIX_VAR_OR_COMMA, suggestions: [suggestThingConstraintKeywords, suggestTypeConstraintKeywords] },
        { suffixes: [[tokens.HAS], [tokens.ISA]], suggestions: [suggestLabels, suggestVariablesAtMinus10] },
        { suffixes: [[tokens.HAS, tokens.TypeRef], [tokens.ISA, tokens.TypeRef]], suggestions: [suggestVariablesAtMinus10] },
        { suffixes: [[tokens.SEMICOLON, tokens.TypeRef]], suggestions: [suggestTypeConstraintKeywords] },
        { suffixes: [[tokens.SUB], [tokens.OWNS]], suggestions: [suggestLabels, suggestVariablesAtMinus10] },
        //   { suffixes: [[tokens.PLAYS], [tokens.RELATES]], suggestions: [suggestRoleLabels] }, // TODO: Role
    ],
    [tokens.ClauseMatch]: [
        { suffixes: [[tokens.MATCH, tokens.TypeRef]], suggestions: [suggestTypeConstraintKeywords] },
        { suffixes: [[tokens.MATCH]], suggestions: [suggestVariablesAt10, suggestLabels] },
    ],
    [tokens.ClauseInsert]: SUGGESTION_GROUP_FOR_THING_STATEMENTS,
    [tokens.Query]: [
        { suffixes: [[tokens.QuerySchema]], suggestions: [suggestLabels, suggestKinds] },
        { suffixes: [[tokens.QueryPipelinePreambled]], suggestions: [suggestPipelineStages, suggestNestedPatterns, suggestVariablesAt10] },
    ],
    
    // Now some for define statements
    [tokens.QuerySchema]: [
        { suffixes: [[tokens.DEFINE]], suggestions: [ suggestLabels, suggestKinds] },
        { suffixes: [[tokens.DEFINE, tokens.LABEL]], suggestions: [ suggestTypeConstraintKeywords] }
    ],
    [tokens.Definable]: [
        { suffixes: [[tokens.COMMA], [tokens.KIND, tokens.LABEL]], suggestions: [ suggestTypeConstraintKeywords ] },
        { suffixes: [[tokens.OWNS], [tokens.SUB] ], suggestions: [ suggestLabels ] },
        // { suffixes: [ [tokens.PLAYS] ], suggestions: [ suggestRoleLabels ] }, // TODO
    ],
    // TODO: ...
};

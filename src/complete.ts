import { CompletionContext, Completion, CompletionResult } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language"
import { SyntaxNode, NodeType, Tree } from "@lezer/common"
import * as tokens from "./generated/typeql.grammar.generated.terms";

function suggest(type: string, label: string, boost: number = 0): Completion {
    // type (docs): used to pick an icon to show for the completion. Icons are styled with a CSS class created by appending the type name to "cm-completionIcon-".
    return {
        label: label,
        type: type,
        apply: label,
        info: type,
        boost: boost,
    };
}

function isPartOfWord(s: string): boolean {
    let matches = s.match(/^[A-Za-z0-9_\-\$]+/);
    return matches != null && matches.length > 0;
}

function findStartOfCompletion(context: CompletionContext): number {
    let str = context.state.doc.sliceString(0, context.pos);
    let at = context.pos - 1;
    while (at >= 0 && isPartOfWord(str.charAt(at))) {
        at -= 1;
    }
    return at;
}


// See: https://codemirror.net/examples/autocompletion/ and maybe the SQL / HTML Example there.

export function autocompleteTypeQL(context: CompletionContext): CompletionResult | null {
    let tree: Tree = syntaxTree(context.state);
    let currentNode: SyntaxNode = tree.resolveInner(context.pos, -1); // https://lezer.codemirror.net/docs/ref/#common.SyntaxNode

    let options = getSuggestions(context, tree, currentNode);
    if (options != null) {
        // And once we figure out, we have to create a list of completion objects
        // It may be worth changing the grammar to be able to do this more easily, rather than replicate the original TypeQL grammar.
        // https://codemirror.net/docs/ref/#autocomplete.Completion
        let from = findStartOfCompletion(context) + 1;
        return {
            from: from,
            options: options,
            // Docs: "regular expression that tells the extension that, as long as the updated input (the range between the result's from property and the completion point) matches that value, it can continue to use the list of completions."
            validFor: /^(\w+)?$/
        }
    } else {
        return null;
    }
}

function getSuggestions(context: CompletionContext, tree: Tree, parseAt: SyntaxNode): Completion[] | null {
    switch (parseAt.type.id) {
        case tokens.LABEL: return suggestLabels(context, tree);
        case tokens.VAR: return suggestVariables(context, tree);
        default: {
            return climbTillWeRecogniseSomething(context, tree, parseAt, parseAt, collectPrecedingChildrenOf(context, parseAt));
        }
    }
}


function climbTillWeRecogniseSomething(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, climbedTo: SyntaxNode | null, prefix: NodeType[]): Completion[] | null {
    if (climbedTo == null) {
        return null;
    }

    switch (climbedTo.type.id) {
        case tokens.Statement: {
            return suggestStatement(context, tree, parseAt, climbedTo, prefix);
        }
        case tokens.ClauseInsert:
        case tokens.ClausePut:
        case tokens.ClauseUpdate: {  // Ideally not update
            if ([tokens.INSERT, tokens.UPDATE, tokens.PUT].includes(prefix.at(-1)?.id ?? -1)) {
                return suggestVariables(context, tree)
            } else {
                return suggestStatementThing(context, tree, parseAt, climbedTo, prefix);
            }
        }
        case tokens.ClauseMatch:
        case tokens.Patterns: {
            let goodPrefixes = [tokens.SEMICOLON, tokens.MATCH];
            if (prefix.length == 0 || goodPrefixes.includes(prefix.at(-1)?.id ?? -1)) {
                let ret = suggestNestedPatterns(context, tree, parseAt, climbedTo, prefix).concat(suggestVariables(context, tree));
                if (prefix.length > 0 && prefix.at(-1)?.id == tokens.SEMICOLON) {
                    let newPrefix = collectSiblingsOf(climbedTo).concat(prefix);
                    ret = ret.concat(climbTillWeRecogniseSomething(context, tree, parseAt, climbedTo.parent, newPrefix) ?? []);
                }
                return ret;
            } else {
                return null;
            }
        }
        case tokens.Query: {
            if (prefix.length == 0 || prefix.at(-1)?.id == tokens.SEMICOLON) {
                return suggestPipelineStages(context, tree, parseAt, climbedTo, prefix)
                    .concat(suggestDefinedKeywords(context, tree, parseAt, climbedTo, prefix));
            } else {
                return null;
            }
        };
        default: {
            let newPrefix = collectSiblingsOf(climbedTo).concat(prefix);
            return climbTillWeRecogniseSomething(context, tree, parseAt, climbedTo.parent, newPrefix);
        }
    }
}

function collectSiblingsOf(node: SyntaxNode): NodeType[] {
    let siblings = [];
    let prev: SyntaxNode | null = node;
    while (null != (prev = prev.prevSibling)) {
        siblings.push(prev.type);
    };
    return siblings.reverse();
}

function collectPrecedingChildrenOf(context: CompletionContext, node: SyntaxNode): NodeType[] {
    let lastChild = node.childBefore(context.pos);
    if (lastChild == null) {
        return [];
    }
    let precedingChildren = collectSiblingsOf(lastChild);
    precedingChildren.push(lastChild.type);
    return precedingChildren;
}


function logInterestingStuff(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, climbedTo: SyntaxNode | null, prefix: NodeType[]) {
    console.log("Current Node:", parseAt.name);
    console.log("ClimbedTo Node:", climbedTo?.name);

    let at: SyntaxNode | null = parseAt;
    let climbThrough = [];
    while (at != null && at.name != climbedTo?.name) {
        climbThrough.push(at.name);
        at = at.parent;
    }
    climbThrough.push(at?.name);
    console.log("Climbed through", climbThrough);

    console.log("Prefix:", prefix);
}

// The actual suggestions
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

function suggestVariables(context: CompletionContext, tree: Tree): Completion[] {
    var options: Completion[] = [];
    tree.iterate({
        enter: (other: SyntaxNode) => {
            if (other.type.id == tokens.VAR) {
                let varName = context.state.sliceDoc(other.from, other.to);
                options.push(suggest("variable", varName, -10));
            }
        }
    });
    return options;
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

function suggestNestedPatterns(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, patternsNode: SyntaxNode, prefix: NodeType[]): Completion[] {
    return ["not {};", "{} or {};", "try {};"].map((keyword) => suggest("method", keyword, 1));
}

function suggestStatement(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, statementNode: SyntaxNode, prefix: NodeType[]): Completion[] | null {
    let refinedStatementNode = statementNode.childBefore(context.pos)!;
    return suggestStatementRefinedImpl(context, tree, parseAt, refinedStatementNode, prefix);
}

function suggestStatementRefinedImpl(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, refinedStatementNode: SyntaxNode, prefix: NodeType[]): Completion[] | null {
    if (refinedStatementNode?.name == "StatementAssignment") {
        return null;
    } else if (prefix.at(-1)?.id == tokens.VAR) {
        // We can't trust whether it's a type or thing yet.
        return suggestThingConstraintKeywords().concat(suggestTypeConstraintKeywords());
    }

    switch (refinedStatementNode.type.id) {
        case tokens.StatementType: {
            return suggestStatementType(context, tree, parseAt, refinedStatementNode, prefix);
        }
        case tokens.StatementThing: {
            return suggestStatementThing(context, tree, parseAt, refinedStatementNode, prefix);

        }
        case tokens.StatementAssignment: return null;
    }

    return null;
}

function suggestStatementThing(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, refinedStatementNode: SyntaxNode, prefix: NodeType[]): Completion[] | null {
    switch (prefix.at(-1)?.id) {
        case tokens.ISA:
        case tokens.HAS: {
            return suggestLabels(context, tree).concat(suggestVariables(context, tree));
        }
        case tokens.VAR:
        case tokens.COMMA: return suggestThingConstraintKeywords();
        case tokens.LINKS:
        default: {
            return null;
        }
    }
}

function suggestStatementType(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, refinedStatementNode: SyntaxNode, prefix: NodeType[]): Completion[] | null {
    switch (prefix.at(-1)?.id) {
        case tokens.SUB:
        case tokens.OWNS: {
            return suggestLabels(context, tree).concat(suggestVariables(context, tree));
        }
        case tokens.RELATES:
        case tokens.PLAYS: {
            return null; // TODO: Suggest roles
        }
        case tokens.VAR:
        case tokens.COMMA: {
            return suggestTypeConstraintKeywords();
        }
        case tokens.LINKS:
        default: {
            return null;
        }
    };
}

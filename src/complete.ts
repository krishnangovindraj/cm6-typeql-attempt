import { CompletionContext,  Completion, CompletionResult } from "@codemirror/autocomplete";
import {syntaxTree} from "@codemirror/language"
import {SyntaxNode, Tree} from "@lezer/common"

function suggest(type: string, label: string): Completion {
    return {
        label: label,
        type: type,
        apply: label,
        info: type,
    };
}

function collectLabelSuggestions(context: CompletionContext, tree: Tree) : Completion[] {    
    // TODO: We could do better by climbing up the tree using `atNode.parentNode` to predict based on position as well.
    // We could also refine the suggestions by creating datastructures based on the declarations in the schema, rather than blindly suggesting every label.
    var options : Completion[] = [];
    tree.iterate({
        enter: (other: SyntaxNode) => {
            if (other.name == "LABEL") {
                let label = context.state.sliceDoc(other.from, other.to);
                options.push(suggest("label", label));
            }
        }
    });
    return options;

}

function collectVariableSuggestions(context: CompletionContext, tree: Tree) : Completion[] {
    var options : Completion[] = [];
    tree.iterate({
        enter: (other: SyntaxNode) => {
            if (other.name == "VAR") {
                let varName = context.state.sliceDoc(other.from, other.to);
                options.push(suggest("variable", varName));
            }
        }
    });
    return options;
}


// See: https://codemirror.net/examples/autocompletion/ and maybe the SQL / HTML Example there.

export function autocompleteTypeQL(context: CompletionContext):  CompletionResult | null {
    let tree: Tree = syntaxTree(context.state);
    let currentNode: SyntaxNode = tree.resolveInner(context.pos, -1); // https://lezer.codemirror.net/docs/ref/#common.SyntaxNode
    let options = getSuggestions(context, tree, currentNode);
    if (options != null) {
        // And once we figure out, we have to create a list of completion objects
        // It may be worth changing the grammar to be able to do this more easily, rather than replicate the original TypeQL grammar.
        // https://codemirror.net/docs/ref/#autocomplete.Completion
        return {
            from: context.pos,
            options: options,
            // Docs: "regular expression that tells the extension that, as long as the updated input (the range between the result's from property and the completion point) matches that value, it can continue to use the list of completions."
            validFor: /^(\w+)?$/
        }
    } else {
        return null;
    }
}

function getSuggestions(context: CompletionContext, tree: Tree, parseAt: SyntaxNode) : Completion[] | null{
    switch (parseAt.name) { 
        case "LABEL": return collectLabelSuggestions(context, tree);
        case "VAR": return collectVariableSuggestions(context, tree);
        default: {
            return climbTillWeRecogniseSomething(context, tree, parseAt, parseAt, collectPrecedingChildrenOf(context, parseAt));
        }
    }
}


function climbTillWeRecogniseSomething(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, climbedTo: SyntaxNode | null, prefix: string[]) : Completion[] | null{
    if (climbedTo == null) {
        // logInterestingStuff(context, tree, parseAt, climbedTo, prefix)
        return null;
    }
    
    switch (climbedTo.name) {
        case "Statement": {
            return suggestStatement(context, tree, parseAt, climbedTo, prefix);
        }
        default: {
            let nextSiblings = collectSiblingsOf(climbedTo).concat(prefix);
            return climbTillWeRecogniseSomething(context, tree, parseAt, climbedTo.parent, nextSiblings);
        }
    }
}

function collectSiblingsOf(node: SyntaxNode): string[] {
    let siblings = [];
    let prev : SyntaxNode | null  = node;
    while (null != (prev = prev.prevSibling)) {
        siblings.push(prev.name);
    };
    return siblings.reverse();
}

function collectPrecedingChildrenOf(context: CompletionContext, node: SyntaxNode): string[] {
    let lastChild = node.childBefore(context.pos);
    if (lastChild == null) {
        return [];
    }
    let precedingChildren = collectSiblingsOf(lastChild);
    precedingChildren.push(lastChild.name);
    return precedingChildren;
}


function logInterestingStuff(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, climbedTo: SyntaxNode | null, prefix: string[]) {
    console.log("Current Node:", parseAt.name);
    console.log("ClimbedTo Node:", climbedTo?.name);

    let at : SyntaxNode | null = parseAt;
    let climbThrough = [];
    while (at != null && at.name != climbedTo?.name) {
        climbThrough.push(at.name);
        at = at.parent;
    }
    climbThrough.push(at?.name);
    console.log("Climbed through", climbThrough);
    console.log("Siblings:", prefix);
}


// Actual suggestions
function suggestStatement(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, statementNode: SyntaxNode, prefix: string[]) : Completion[] | null {
    const thingConstraintNames = ["isa", "has", "links"];
    const typeConstraintNames = ["sub", "owns", "relates", "plays"];

    console.log("Suggesting statement", statementNode.childBefore(context.pos)?.name, "with immediate prefix", prefix.at(-1  ));
    let refinedStatementNode =  statementNode.childBefore(context.pos)!;
    if (refinedStatementNode?.name == "StatementAssignment") {
        return null;
    }
    else if (prefix.at(-1) == "VAR") {
         // We can't trust whether it's a type or thing yet.
        return thingConstraintNames.concat(typeConstraintNames).map((constraintName) => suggest("keywordConstraint", constraintName));
    }
    
    switch (refinedStatementNode.name) {
        case "SatementType": {
            switch (prefix.at(-1)) {
                case "SUB":
                case "OWNS": {
                    return collectLabelSuggestions(context, tree).concat(collectVariableSuggestions(context, tree));
                }
                case "RELATES":
                case "PLAYS": {
                    return null; // TODO: Suggest roles
                }

                case "VAR":
                case "COMMA": {
                    return ["SUB", "OWNS", "RELATES", "PLAYS"].map((constraintName) => { 
                        return { 
                            label: constraintName,
                            type: "typeConstraint",
                            apply: constraintName,
                            info: "Type constraint keyword",
                        };
                    });
                }
                case "links":
                default: return null;
            };
        }
        case "StatementThing": {
            switch (prefix.at(-1)) {
                case "ISA":
                case "HAS": {
                    return collectLabelSuggestions(context, tree).concat(collectVariableSuggestions(context, tree));
                }
                case "VAR":
                case "COMMA": {
                    return ["isa", "has", "links"].map((constraintName) => { 
                        return { 
                            label: constraintName,
                            type: "thingConstraint",
                            apply: constraintName,
                            info: "Thing constraint keyword",
                        };
                    });
                }
                case "LINKS":
                default: return null;
            }
        }
        case "StatementAssignment": return null;
    }

    return null;
}

import { CompletionContext,  Completion, CompletionResult } from "@codemirror/autocomplete";
import {syntaxTree} from "@codemirror/language"
import {SyntaxNode, Tree} from "@lezer/common"


function suggestLabel(label: string): Completion {
    return {
        label: label,
        type: "label",
        apply: label,
        info: "Label suggestion",
    }
}

function suggestVariable(varName: string): Completion {
    return {
        label: varName,
        type: "variable",
        apply: varName,
        info: "Variable suggestion",
    }
}

function maySuggestKeyword(context: CompletionContext, tree: Tree, atNode: SyntaxNode): Completion[] | null {
    // TODO:
    return null;
}

function collectLabelSuggestions(context: CompletionContext, tree: Tree, atNode: SyntaxNode) : Completion[] {
    // This is a placeholder function. You will need to implement the logic to collect label suggestions.
    // For now, we return an empty array.
    var options : Completion[] = [];
    tree.iterate({
        enter: (other: SyntaxNode) => {
            if (other.name == "LABEL") {
                let content = context.state.sliceDoc(other.from, other.to);
                options.push(suggestLabel(content));
            }
        }
    });
    return options;

}

function collectVariableSuggestions(context: CompletionContext, tree: Tree, atNode: SyntaxNode) : Completion[] {
    var options : Completion[] = [];
    tree.iterate({
        enter: (other: SyntaxNode) => {
            if (other.name == "VAR") {
                let content = context.state.sliceDoc(other.from, other.to);
                options.push(suggestVariable(content));
            }
        }
    });
    return options;
}


// See: https://codemirror.net/examples/autocompletion/ and maybe the SQL / HTML Example there.
export function autocompleteTypeQL(context: CompletionContext):  CompletionResult | null {
    let tree: Tree = syntaxTree(context.state);
    let currentNode: SyntaxNode = tree.resolveInner(context.pos, -1); // https://lezer.codemirror.net/docs/ref/#common.SyntaxNode
    // We may have to walk the tree to find the most appropriate node to suggest things based on.
    let options = null;    
    if (currentNode.name == "LABEL") {
        options = collectLabelSuggestions(context, tree, currentNode);
    } else if (currentNode.name == "VAR") {
        options = collectVariableSuggestions(context, tree, currentNode);
    } else {
        let keywordSuggestions = maySuggestKeyword(context, tree, currentNode);
        if (keywordSuggestions!= null) {
            options = keywordSuggestions;
        }
    } 

    if (options != null) {
        // And once we figure out, we have to create a list of completion objects
        // It may be worth changing the grammar to be able to do this more easily, rather than replicate the original TypeQL grammar.
        // https://codemirror.net/docs/ref/#autocomplete.Completion
        return {
            from: currentNode.from,
            options: options,
            // Docs: "regular expression that tells the extension that, as long as the updated input (the range between the result's from property and the completion point) matches that value, it can continue to use the list of completions."
            validFor: /^(\w+)?$/
        }
    } else {
        return null;
    }
}

import { CompletionContext,  Completion, CompletionResult } from "@codemirror/autocomplete";
import {syntaxTree} from "@codemirror/language"
import {SyntaxNode} from "@lezer/common"

// See: https://codemirror.net/examples/autocompletion/ and maybe the SQL / HTML Example there.
export function autocompleteTypeQL(context: CompletionContext):  CompletionResult | null {
    let tree = syntaxTree(context.state);
    let currentNode: SyntaxNode = tree.resolveInner(context.pos, 0); // https://lezer.codemirror.net/docs/ref/#common.SyntaxNode
    // We may have to walk the tree to find the most appropriate node to suggest things based on.

    // And once we figure out, we have to create a list of completion objects
    // It may be worth changing the grammar to be able to do this more easily, rather than replicate the original TypeQL grammar.
    // https://codemirror.net/docs/ref/#autocomplete.Completion
    let options = [
        { label: "(Autocomplete coming soon)", type: "keyword", info: "Feel free to contribute!" }
    ];

    return {
        from: context.pos, // Leave this as is
        options: options,
        // Docs: "regular expression that tells the extension that, as long as the updated input (the range between the result's from property and the completion point) matches that value, it can continue to use the list of completions."
        validFor: /^(\w*)?$/ 
    }
}

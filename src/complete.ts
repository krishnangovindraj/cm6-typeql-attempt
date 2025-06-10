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
            validFor: /^([\w\$]+)?$/
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

function combineSuggestions(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, climbedTo: SyntaxNode, prefix: NodeType[], suggestionFunctions: SuggestionFunction[]): Completion[] {
    let suggestions = suggestionFunctions.map((f) => {
        return f(context, tree, parseAt, climbedTo, prefix);
    }).reduce((acc, curr) => { 
        return (curr == null) ? acc : acc!.concat(curr);
    }, []);
    console.log("Matched:", climbedTo.type.name, "with prefix", prefix, ". Suggestions:", suggestions);
    return suggestions!;
}

function climbTillWeRecogniseSomething(context: CompletionContext, tree: Tree, parseAt: SyntaxNode, climbedTo: SyntaxNode | null, prefix: NodeType[]): Completion[] | null {
    if (climbedTo == null) {
        logInterestingStuff(context, tree, parseAt, climbedTo, prefix);
        return null;
    }
    let suggestionEither = SUGGESION_MAP[climbedTo.type.id];
    if (suggestionEither != null) {
        for (var sops of (suggestionEither as SuffixOfPrefixSuggestion[])) {
            if (prefixHasAnyOfSuffixes(prefix, sops.suffixes)) {
                return combineSuggestions(context, tree, parseAt, climbedTo, prefix, sops.suggestions);
            }
        }
        // None match? Fall through.
        console.log("Fell through!!!: ", climbedTo.type.name, "with prefix", prefix);
    }
    let newPrefix = collectSiblingsOf(climbedTo).concat(prefix);
    return climbTillWeRecogniseSomething(context, tree, parseAt, climbedTo.parent, newPrefix);
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

function prefixHasAnyOfSuffixes(prefix: NodeType[], suffixes: SuffixCandidate[]): boolean {
    for (let i = 0; i < suffixes.length; i++) {
        if (prefixHasSuffix(prefix, suffixes[i])) {
            return true;
        }
    }
    return false;
}

function prefixHasSuffix(prefix: NodeType[], suffix: number[]): boolean {
    if (prefix.length < suffix.length) {
        return false;
    }
    for (let i = 0; i < suffix.length; i++) {
        if (prefix[prefix.length - suffix.length + i].id != suffix[i]) {
            return false;
        }
    }
    return true;
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

// Will pick the first matching suffix. If you want to handle things manually, use an empty suffix, duh.
interface SuggestionMap { 
    [key: number]: SuffixOfPrefixSuggestion[]
};


type SuffixCandidate = number[]; // A SuffixCandidate 's' "matches" a prefix if prefix[-s.length:] == s 
interface SuffixOfPrefixSuggestion {
    suffixes: SuffixCandidate[], // If any of the  suffix candidates match, the suggestions will be used.
    suggestions: SuggestionFunction[]
};

type SuggestionFunction = (context: CompletionContext, tree: Tree, parseAt: SyntaxNode, climbedTo: SyntaxNode, prefix: NodeType[]) => Completion[] | null;

// Hopefully you only have to touch this.

const SUFFIX_VAR_OR_COMMA = [[tokens.COMMA], [tokens.VAR]];



const SUGGESTION_GROUP_FOR_THING_STATEMENTS: SuffixOfPrefixSuggestion[]  = [
        { suffixes: SUFFIX_VAR_OR_COMMA, suggestions: [suggestThingConstraintKeywords] },
        { suffixes: [[tokens.HAS], [tokens.ISA]], suggestions: [suggestLabels, suggestVariablesAtMinus10] },
        { suffixes: [[tokens.HAS, tokens.TypeRef], [tokens.ISA, tokens.TypeRef]], suggestions: [suggestVariablesAtMinus10] },
];

const SUGGESION_MAP: SuggestionMap = {
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
    
    // TODO: ...
};

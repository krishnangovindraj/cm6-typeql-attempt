# CodeMirror 6 language package template (adapted for TypeQL)

### The original readme read:
This is an example repository containing a minimal [CodeMirror](https://codemirror.net/6/) language support package. The idea is to clone it, rename it, and edit it to create support for a new language.

Things you'll need to do (see the [language support example](https://codemirror.net/6/examples/lang-package/) for a more detailed tutorial):

### Rather, things I'm doing:
 * Done: ~~`git grep EXAMPLE` and replace all instances with your language name.~~ .

 * Minimally Done: Rewrite the grammar in `src/typeql.grammar` to cover your language. See the [Lezer system guide](https://lezer.codemirror.net/docs/guide/#writing-a-grammar) for information on this file format. 
    - Using some AI is a great starting point. Our grammar is incredibly complicated and it might be ok to gloss over some details that we don't intend to unpack yet (Like treating ALL annotations as `@<word>(<not-a-paren-close>)` )

 * Adjust the metadata in `src/index.ts` to work with your new grammar.
   - This is mostly highlig=hting for the moment through styleTags. Though we'll have to figure out indentation & autocomplete.

 * Adjust the grammar tests in `test/cases.txt`.

 * Build (`npm run prepare`) and test (`npm test`). 
   - I added an `index.html` to play with the content. So you now have to run `npm run prepare`, which builds the language package. Then `npm run bundle` which prepares the `js` for the html.

 * Publish. Put your package on npm under a name like `codemirror-lang-typeql`. 
    - This I still need to do.

 * Rewrite this readme file.

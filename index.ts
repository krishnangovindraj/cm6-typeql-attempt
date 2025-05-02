
import {basicSetup} from "codemirror"
import {EditorView} from "@codemirror/view"
import {TypeQL, TypeQLLanguage} from "./dist/index.js";

const view = new EditorView({
  doc: "Start document",
  parent: document.body,
  extensions: [basicSetup, TypeQL()]
})

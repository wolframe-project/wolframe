import eventController from "@/lib/backend/events";
import type { Monaco } from "../..";
import { getIdFromUri } from "@/lib/backend/utils";
import { getVirtualFileSystem } from "@/lib/backend/stores/vfs.svelte";

interface ITypstCompletionItem {
    kind: 'type' | 'func' | 'constant' | 'syntax' | 'param' | 'path' | 'package' | 'label' | 'font' | {'symbol': string};
    label: string;
    detail?: string;
    apply?: string;
}

const typstCompletionItemKind = {
    type: 5, //Monaco.languages.CompletionItemKind.Class,
    func: 1, //Monaco.languages.CompletionItemKind.Function,
    constant: 14, //Monaco.languages.CompletionItemKind.Constant,
    syntax: 17, //Monaco.languages.CompletionItemKind.Keyword,
    param: 4, //Monaco.languages.CompletionItemKind.Variable,
}

const typstToMonacoCompletionKind = (kind: ITypstCompletionItem['kind']): Monaco.languages.CompletionItemKind => {
    if (typeof kind === 'object' && 'symbol' in kind) {
        return 21 // Monaco.languages.CompletionItemKind.Reference
    } else if (typeof kind === 'string' && kind in typstCompletionItemKind) {
        return typstCompletionItemKind[kind as keyof typeof typstCompletionItemKind];
    } else {
        return 18;
    }
}

const typstApplyToMonacoInsertText = (apply: string | undefined): string | undefined => {
    if (!apply) return undefined;

    let counter = 1;

    // Replace ${...} with ${n:...}
	return apply.replace(/\$\{(.*?)\}/g, (_, content) => {
		return `\${${counter++}:${content}}`;
	});
}

const typstToMonacoCompletion = (items: ITypstCompletionItem[], range: Monaco.IRange): Monaco.languages.CompletionItem[] => {
    return items.map((item) => {
        const kind = typstToMonacoCompletionKind(item.kind);
        const insertText = typstApplyToMonacoInsertText(item.apply);
        return {
            label: item.label,
            kind,
            detail: item.detail,
            insertText: insertText || item.label,
            insertTextRules: insertText ? 4 /* Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet */ : undefined,
            documentation: item.detail,
            range,
        };
    });
}

export class TypstCompletionProvider implements Monaco.languages.CompletionItemProvider {
    private vfs = getVirtualFileSystem();
    constructor() {
        
    }

    provideCompletionItems(model: Monaco.editor.ITextModel, position: Monaco.Position, context: Monaco.languages.CompletionContext, token: Monaco.CancellationToken): Monaco.languages.ProviderResult<Monaco.languages.CompletionList> {
        const word = model.getWordUntilPosition(position);
        const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
        };

        return new Promise((resolve) => {
            const fileId = getIdFromUri(model.uri);
            this.vfs.getFileById(fileId).map(fileNode => {
                eventController.fire("command/compiler:autocomplete", fileNode.path.rooted(), range, (result) => {
                    console.log("Autocomplete result", result);

                    resolve({
                        suggestions: typstToMonacoCompletion(result as ITypstCompletionItem[], range),
                    });
                });
            });
        })
    }
}
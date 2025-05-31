import { getVirtualFileSystem } from "@/lib/backend/stores/vfs.svelte";
import type { Monaco } from "../..";
import { EnumTypeGuards, getIdFromUri } from "@/lib/backend/utils";
import eventController from "@/lib/backend/events";
import monacoController from "../..";
import { Path } from "@/lib/backend/path";

export class TypstDefinitionProvider implements Monaco.languages.DefinitionProvider {
    private vfs = getVirtualFileSystem();

    
    provideDefinition(model: Monaco.editor.ITextModel, position: Monaco.Position, token: Monaco.CancellationToken): Monaco.languages.ProviderResult<Monaco.languages.Definition | Monaco.languages.LocationLink[]> {
        const word = model.getWordAtPosition(position);
		const range: Monaco.IRange = {
			startLineNumber: position.lineNumber,
			endLineNumber: position.lineNumber,
			startColumn: word!.startColumn,
			endColumn: word!.endColumn
		};

        console.log("Definition request at position:", position, "with range:", range, word);
        return new Promise((resolve) => {
            const fileId = getIdFromUri(model.uri);
            this.vfs.getFileById(fileId).map((fileNode) => {
                eventController.fire(
                    "command/compiler:definition",
                    fileNode.path.rooted(),
                    range,
                    (result) => {
                        console.log("Definition result:", result);
                        if (EnumTypeGuards.TypstCoreDefinition.isVar(result)) {
                            const varDef = result.Var;
                            this.vfs.getFileByPath(new Path(varDef.span.path)).map((fileNode) => {
                                const tModel = monacoController.getModel(fileNode.file.id, fileNode.extension!);
                                resolve({
                                    uri: tModel!.uri,
                                    range: {
                                        startLineNumber: varDef.span.monaco_range.begin_line_number,
                                        startColumn: varDef.span.monaco_range.begin_column,
                                        endLineNumber: varDef.span.monaco_range.end_line_number,
                                        endColumn: varDef.span.monaco_range.end_column,
                                    },
                                });
                            });
                        } else if (EnumTypeGuards.TypstCoreDefinition.isFn(result)) {
                            const fnDef = result.Fn;
                            this.vfs.getFileByPath(new Path(fnDef.span.path)).map((fileNode) => {
                                const tModel = monacoController.getModel(fileNode.file.id, fileNode.extension!);
                                resolve({
                                    uri: tModel!.uri,
                                    range: {
                                        startLineNumber: fnDef.span.monaco_range.begin_line_number,
                                        startColumn: fnDef.span.monaco_range.begin_column,
                                        endLineNumber: fnDef.span.monaco_range.end_line_number,
                                        endColumn: fnDef.span.monaco_range.end_column,
                                    },
                                });
                            })
                        } else {
                            resolve(null); // Unknown definition type
                        }
                    },
                    (error) => {
                        console.error("Definition request failed:", error);
                        resolve(null); // Handle error gracefully
                    }
                );
            });
        });
    }
}
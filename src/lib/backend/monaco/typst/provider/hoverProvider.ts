import { EnumTypeGuards, getIdFromUri } from '@/lib/backend/utils';
import type { Monaco } from '../..';
import eventController from '@/lib/backend/events';
import { getVirtualFileSystem } from '@/lib/backend/stores/vfs.svelte';

export class TypstHoverProvider implements Monaco.languages.HoverProvider {
	private vfs = getVirtualFileSystem();

	provideHover(
		model: Monaco.editor.ITextModel,
		position: Monaco.Position,
		token: Monaco.CancellationToken,
		context?: Monaco.languages.HoverContext<Monaco.languages.Hover> | undefined
	): Monaco.languages.ProviderResult<Monaco.languages.Hover> {
		const word = model.getWordAtPosition(position);
		const range: Monaco.IRange = {
			startLineNumber: position.lineNumber,
			endLineNumber: position.lineNumber,
			startColumn: word!.startColumn,
			endColumn: word!.endColumn
		};

        console.log('Hover request at position:', position, 'with range:', range, word);
		return new Promise((resolve) => {
			const fileId = getIdFromUri(model.uri);
			this.vfs.getFileById(fileId).map((fileNode) => {
				eventController.fire(
					'command/compiler:definition',
					fileNode.path.rooted(),
					range,
					(result) => {
                        console.log('Hover definition result:', result);
						if (EnumTypeGuards.TypstCoreDefinition.isStd(result)) {
							const stdDef = result.Std;
							resolve({
								range: range,
								contents: [
									{ value: `(std) ${stdDef.name}` },
									{
										value: stdDef.docs || 'No documentation available.',
										supportHtml: true,
										isTrusted: true
									}
								]
							});
						} else if (EnumTypeGuards.TypstCoreDefinition.isFn(result)) {
							const fnDef = result.Fn;
							resolve({
								range: range,
								contents: [
									{ value: `${fnDef.name}(${fnDef.args.map((arg) => arg.name).join(', ')})` },
									{
										value: fnDef.docs || 'No documentation available.',
										supportHtml: true,
										isTrusted: true
									},
									...fnDef.args.map((arg) => ({ value: arg.docs || 'No documentation available.' }))
								]
							});
						} else if (EnumTypeGuards.TypstCoreDefinition.isVar(result)) {
							const varDef = result.Var;
							resolve({
								range: range,
								contents: [
									{ value: `${varDef.name}` },
									{
										value: varDef.docs || 'No documentation available.',
										supportHtml: true,
										isTrusted: true
									}
								]
							});
						} else {
							resolve(null); // Unknown definition type
						}
					},
					(error) => {
						console.error('Error fetching definition for hover:', error);
						resolve(null); // Resolve with null on error
					}
				);
			});
		});
	}
}

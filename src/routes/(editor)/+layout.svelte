<script lang="ts">
	import { setEditorManager } from '$lib/backend/stores/editor.svelte';
	import { getVirtualFileSystem, setVirtualFileSystem } from '@/lib/backend/stores/vfs.svelte';
	import DropdownMenuItem from '@/lib/frontend/components/DropdownMenuItem.svelte';
	import { Pane, Splitpanes } from 'svelte-splitpanes';
	import FileExplorer from '@/lib/frontend/components/editor/FileExplorer.svelte';
	import eventController from '@/lib/backend/events';
	import monacoController, { type Monaco } from '@/lib/backend/monaco';
	import { TypstTheme } from '@/lib/backend/monaco/typst/theme';
	import { TypstLanguage } from '@/lib/backend/monaco/typst/language';
	import MonacoEditor from '@/lib/frontend/components/editor/MonacoEditor.svelte';
	import { portalAction } from '@/lib/frontend/actions/Portal.svelte';
	import CompilerWorker from '@/lib/backend/worker/compiler?worker';
	import * as Comlink from 'comlink';
	import { type Compiler as CompilerType } from '@/lib/backend/worker/compiler/compiler';
	import RendererWorker from '@/lib/backend/worker/renderer?worker';
	import { type Renderer as RendererType } from '@/lib/backend/worker/renderer/renderer';
	import type { Output, TypstCoreError } from 'wolframe-typst-core';
	import type { TreeNode } from '@/lib/backend/stores/vfs/TreeNode.svelte';
	import PreviewPanel from '@/lib/frontend/components/editor/PreviewPanel.svelte';
	import Menu from '@/lib/frontend/components/editor/Menu.svelte';
	import DebugPanel from '@/lib/frontend/components/editor/DebugPanel.svelte';
	import { setUiStore } from '@/lib/backend/stores/ui.svelte';
	import CustomSplitpanes from '@/lib/frontend/components/splitpane/Splitpane.svelte';
	import { setDebugStore } from '@/lib/backend/stores/debug.svelte';
	import { debug } from '@/lib/backend/utils';
	import { IndexedDBVFS } from '@/lib/backend/backend-vfs/IndexedDBVFS';

	let { children } = $props();

	const editorManager = setEditorManager();
	const backendVFS = new IndexedDBVFS('playground');
	const vfs = setVirtualFileSystem(backendVFS);
	const uiStore = setUiStore();
	const debugStore = setDebugStore();
	const awaitLoad = editorManager.loadEditor; // https://github.com/sveltejs/svelte/discussions/14692
	let showConsole = $state(6);
	let outputMinimized = $state(false);
	let debugPanelSplitter: CustomSplitpanes | undefined = $state();
	let editorPanelSplitter: CustomSplitpanes | undefined = $state();
	let previewPanel;
	let disposables: Monaco.IDisposable[] = [];

	function handleTypstError(err: TypstCoreError) {
		console.error('Typst error:', err);
	}

	async function rootChanged(path: string | null) {
		if (path) {
			await editorManager.compiler.setRoot(
				path,
				Comlink.proxy((err) => {
					debug('error', 'compiler', 'Error on setRoot:', err);
				})
			);

			editorManager.compile();
		}
	}

	async function fileContentChanged(
		node: TreeNode,
		event: Monaco.editor.IModelContentChangedEvent
	) {
		if (node.isFile) {
			const path = node.path.rooted();

			function unicodeLength(str: string): number {
				let length = 0;
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for (const c of str) ++length;
				return length;
			}

			// const content = node.model!.getValue();
			// const contentLength = unicodeLength(content);
			// let offset = 0;

			event.changes.sort((a, b) => b.rangeOffset - a.rangeOffset);
			for (const change of event.changes) {
				const { text, rangeOffset, rangeLength } = change;
				/* const initialLength = unicodeLength(content.slice(0, rangeOffset));
				const deletedLength = unicodeLength(content.slice(rangeOffset, rangeOffset + rangeLength)); */

				// const restLength = contentLength - initialLength - deletedLength;

				await editorManager.compiler.edit(path, change, Comlink.proxy(handleTypstError));
			}

			vfs.editFile(node.file.id);

			editorManager.compile();
		}
	}

	async function addFile(node: TreeNode) {
		if (node.isFile) {
			const path = node.path.rooted();
			const content = node.file.content!;

			await editorManager.compiler.addFile(path, content);

			editorManager.compile();
		}
	}

	async function deleteFile(node: TreeNode) {
		if (node.isFile) {
			const path = node.path.rooted();

			await editorManager.compiler.removeFile(path);

			editorManager.compile();
		}
	}

	function consoleVisibility(show: boolean) {
		showConsole = show ? 15 : 0;
	}

	function addCompileError(err: TypstCoreError) {
		debugStore.compileError = err;
	}

	function clearCompileError() {
		debugStore.compileError = null;
	}

	$effect(() => {
		uiStore.setDebugPanelSize = (size: number) => {
			debugPanelSplitter!.setSize(size);
		};

		uiStore.hidePreview = () => {
			editorPanelSplitter!.hide(1);
			previewPanel!.style.display = 'none';
		};

		uiStore.showPreview = () => {
			editorPanelSplitter!.show(1);
			previewPanel!.style.display = 'flex';
		};

		disposables.push(
			eventController.register('monaco:loaded', () => {
				vfs.loadFromBackend();
				eventController.fire('monaco/editor:create')
			}),
			eventController.register('command/ui/console:visibility', consoleVisibility),
			eventController.register('compiler/compile:error', addCompileError),
			eventController.register('renderer:render', clearCompileError)
		);



		const typstTheme = new TypstTheme();
		const typstLanguage = new TypstLanguage();

		monacoController.initMonaco();
		monacoController.addTheme(typstTheme);
		monacoController.addLanguage(typstLanguage);

		const Compiler = Comlink.wrap<CompilerType>(new CompilerWorker());

		(async () => {
			await Compiler.initialize(
				Comlink.proxy(async () => {
					debug('info', 'compiler', 'Compiler initialized');
					eventController.fire('compiler:loaded');

					await eventController.waitFor('files:loaded');

					for (const file of vfs.getFiles().filter((f) => f.isFile)) {
						debug('info', 'compiler', 'Adding file:', file.file.name);
						await Compiler.addFile(file.path.rooted(), file.file.content!);
					}

					// Probe for available entry points
					// first check for /main.typ then /lib.typ else the first .typ file
					const entryPoints = vfs
						.getFiles()
						.filter((f) => f.isFile && f.file.name.endsWith('.typ'));
					const mainFile = entryPoints.find((f) => f.file.name === 'main.typ' && !f.file.parentId);
					const libFile = entryPoints.find((f) => f.file.name === 'lib.typ' && !f.file.parentId);
					const entryPoint = mainFile || libFile || entryPoints[0];
					debug('info', 'compiler', 'Entry point:', entryPoint?.file.name);

					// Set entry point as root
					editorManager.previewFilePath = entryPoint?.path.rooted() || null;

					// open entry point
					if (entryPoint) entryPoint.openFile();

					disposables.push(
						eventController.register('file:created', addFile),
						eventController.register('file:deleted', deleteFile)
					);

					editorManager.setCompiler(Compiler);

					await rootChanged(editorManager.previewFilePath);
					disposables.push(
						eventController.register('file:preview', rootChanged),

						eventController.register('file:edited', fileContentChanged)
					);
				})
			);
		})();

		return () => {
			disposables.forEach((d) => d.dispose());
			editorManager.dispose();
			monacoController.disposeEditor();
		};
	});
</script>

{#await awaitLoad}
	<div
		class="bg-base-100 absolute top-0 left-0 z-50 flex h-screen w-screen items-center justify-center"
		use:portalAction={{}}
	>
		<p>{editorManager.loading.message}</p>
	</div>
{:catch e}
	<p>{e}</p>
{/await}

{#snippet file_explorer()}
	<div class="bg-base-200 flex flex-col" style="grid-area: {uiStore.fileExplorerSide == 'left' ? 'a' : 'b'};">
		<FileExplorer />
	</div>
{/snippet}

{#snippet editor()}
	<MonacoEditor />
{/snippet}

{#snippet preview()}
	<div bind:this={previewPanel} class="bg-base-300 flex flex-col">
		<PreviewPanel />
	</div>
{/snippet}

{#snippet console_pane()}
	<div class="bg-base-200">
		<DebugPanel />
	</div>
{/snippet}

{#snippet editor_view()}
	<div class="grid pl-[1px]" style="grid-template-rows: auto minmax(0, 1fr);">
		<Menu />
		<CustomSplitpanes
			direction="vertical"
			max="-20px"
			min="10%"
			maxThreshold={80}
			maxReleaseThreshold={88}
			class="hover:after:bg-primary!"
			bind:maximized={uiStore.isDebugPanelMinimized}
			bind:this={debugPanelSplitter}
			b={console_pane}
		>
			{#snippet a()}
				<div class="">
					<CustomSplitpanes
						direction="horizontal"
						pos="50%"
						min="20%"
						max="80%"
						class="hover:after:bg-primary!"
						bind:this={editorPanelSplitter}
						a={editor}
						b={preview}
					/>
				</div>
			{/snippet}
		</CustomSplitpanes>
	</div>
{/snippet}

<div class="h-screen w-screen">
	<CustomSplitpanes
		direction="horizontal"
		pos={uiStore.fileExplorerSide === "left" ? "15%" : "85%"}
		min={uiStore.fileExplorerSide === "left" ? "220px" : "60%"}
		max={uiStore.fileExplorerSide === "left" ? "60%" : "-220px"}
		class="hover:after:bg-primary!"
		a={file_explorer}
		b={editor_view}
	/>
</div>

{@render children()}

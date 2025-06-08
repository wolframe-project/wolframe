<script lang="ts">
	import eventController from '@/lib/backend/events';
	import monacoController, { type Monaco } from '@/lib/backend/monaco';
	import { TypstLanguage } from '@/lib/backend/monaco/typst/language';
	import { TypstTheme } from '@/lib/backend/monaco/typst/theme';
	import { getEditorManager } from '@/lib/backend/stores/editor.svelte';
	import { getVirtualFileSystem } from '@/lib/backend/stores/vfs.svelte';
	import type { TreeNode } from '@/lib/backend/stores/vfs/TreeNode.svelte';
	import { debug } from '@/lib/backend/utils';
	import { X } from 'lucide-svelte';

	let editorContainer: HTMLDivElement;

	const vfs = getVirtualFileSystem();
	const editor = getEditorManager();

	const currentlyOpenedFiles = $derived.by(() => {
		debug('info', 'monaco/editor', 'Getting currently opened files');
		return editor.getOpenFiles().map((file) => {
			const vfsFile = vfs.getFileById(file.id);
			if (vfsFile.ok) {
				return vfsFile.unwrap();
			}
			return null;
		}).filter((file): file is TreeNode => file !== null);
	});

    // let filteredFiles = $derived();

	function onMonacoLoaded() {

		monacoController.createEditor(editorContainer);

		document.fonts.ready.then(() => {
			debug('info', 'monaco/fonts', 'Fonts are ready');
			monacoController.remasureFonts();
		});
	}

	function onChangeSelection(range: Monaco.IRange | {start: number, end: number}) {
		monacoController.changeSelection(range);
	}

	$effect(() => {
		let disposables = [];

		disposables.push(
			eventController.register('monaco/editor:create', onMonacoLoaded),
			eventController.register('command/monaco/editor:selection', onChangeSelection),
		);

		return () => {
			disposables.forEach((disposable) => {
				disposable.dispose();
			});
			monacoController.disposeEditor();
		};
	});
</script>

<div class="grid min-h-0 min-w-0" style="grid-template-rows: auto minmax(0, 1fr);">
	{#if currentlyOpenedFiles.length > 0}
    <div class="overflow-x-auto max-h-12">
		<div role="tablist" class="tabs tabs-sm tabs-box border-base-100 rounded-none border-t p-0">
			{#each currentlyOpenedFiles as file (file.file.id)}
				<button
					role="tab"
                    type="button"
					class={['tab rounded-none!', editor.getOpenFileId() === file.file.id ? 'tab-active' : '']}
					style="--tab-bg: color-mix(in oklab, var(--btn-color, var(--color-base-content)) 8%, var(--color-base-100))"
					onclick={() => {
						file.openFile();
					}}>
                    {file.file.name}
                    <!-- svelte-ignore a11y_interactive_supports_focus -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <span role="button" onclick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        file.closeFile();
                    }} class="ml-1.5 p-0.5 rounded hover:bg-base-300 z-10"><X class="size-4" /></span>
                </button>
			{/each}
		</div>
    </div>
	{/if}
	<div bind:this={editorContainer} class="h-full w-full min-w-0"></div>
</div>

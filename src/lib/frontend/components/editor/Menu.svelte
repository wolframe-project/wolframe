<script lang="ts">
	import DropdownMenuItem from "../DropdownMenuItem.svelte";
	import { getUiStore } from "@/lib/backend/stores/ui.svelte";
	import { ComponentWindow } from "../../utils/ComponentWindow";
	import ThemeEditor from "../dev/monaco/ThemeEditor.svelte";
	import Dialog from "../Dialog.svelte";
	import { getVirtualFileSystem } from "@/lib/backend/stores/vfs.svelte";
	import { FileType } from "@/app.types";

    const uiStore = getUiStore();
    const vfs = getVirtualFileSystem();
    let showConsole = $state(true);
	let themeEditorWindow = new ComponentWindow();

    $effect(() => {
        return () => {
			themeEditorWindow.unmount();
        }
    });

    function openThemeEditor() {
        themeEditorWindow.popout(ThemeEditor);
    }
</script>

<ul class="menu menu-horizontal bg-base-200 h-12 w-full gap-2 p-2">
    <li>
        <DropdownMenuItem name="File">
            <li><a href="/">New File</a></li>
            <li><a href="/">Open File</a></li>
            <li><a href="/">Save</a></li>
            <li><a href="/">Save As</a></li>
            <li><a href="/">Close File</a></li>
            <li><a href="/">Export File</a></li>
        </DropdownMenuItem>
    </li>
    <li>
        <DropdownMenuItem name="Edit">
            <li><a href="/">Undo</a></li>
            <li><a href="/">Redo</a></li>
            <li><a href="/">Cut</a></li>
            <li><a href="/">Copy</a></li>
            <li><a href="/">Paste</a></li>
            <li><a href="/">Select All</a></li>
        </DropdownMenuItem>
    </li>
    <li>
        <DropdownMenuItem name="Project">
            <li><a href="/">Export Project</a></li>
            <li>
                <button onclick={() => {
                    uiStore.setDebugPanelSize(100 - (uiStore.isDebugPanelMinimized ? 30 : 0));
                }}>
                    {uiStore.isDebugPanelMinimized ? 'Show' : 'Hide'} Console
                </button>
            </li>
        </DropdownMenuItem>
    </li>
    <li>
        <DropdownMenuItem name="Preview">
            <li><button onclick={() => {
                uiStore.showPreview();
            }}>Hide Preview</button></li>
            <li><a href="/">Refresh Preview</a></li>
            <li><a href="/">Preview in New Window</a></li>
            <li><a href="/">Zoom In</a></li>
            <li><a href="/">Zoom Out</a></li>
            <li><a href="/">Set Zoom</a></li>
        </DropdownMenuItem>
    </li>
    <li>
        <DropdownMenuItem name="Development">
            <li><button onclick={openThemeEditor}>Open Theme Editor</button></li>
        </DropdownMenuItem>
    </li>
</ul>

<Dialog open={true}>
    <h3 class="font-bold text-lg">New File</h3>
    <div class="py-4">
        <p>Select a location for a new file <span class="italic underline">or</span> provide a valid path.</p>
        <fieldset class="fieldset">
            <legend class="fieldset-legend">Location</legend>
            <select class="select">
                {#each vfs.getFiles().filter(file => file.file.type === FileType.Folder) as dir}
                    <option value={dir.path}>{dir.file.name}</option>
                {/each}
            </select>
        </fieldset>
        <fieldset class="fieldset">
            <legend class="fieldset-legend">Fiel Path</legend>
            <input type="text" class="input input-bordered w-full" />
        </fieldset>
    </div>
    <div class="modal-action">
        <button class="btn btn-primary" onclick={() => {
            // Logic to create a new file
        }}>Create</button>
        <button class="btn" onclick={() => {}}>Cancel</button>
    </div>
</Dialog>
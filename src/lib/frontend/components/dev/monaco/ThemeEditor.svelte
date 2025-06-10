<script lang="ts">
	import type { Grammar, Pattern } from '@/app.types';
	import monacoController from '@/lib/backend/monaco';
	import {
		convertTheme,
		type IVScodeTheme,
		type TokenColor
	} from '@/lib/backend/monaco/textmate/theme-converter';
	import { createId } from '@paralleldrive/cuid2';
	import { ChevronLeft, Plus } from 'lucide-svelte';
	import ColorPicker, { A11yVariant } from 'svelte-awesome-color-picker';
	import TagInput from '../../TagInput.svelte';
	import ColorSelect from '../../ColorSelect.svelte';
	import Dialog from '../../Dialog.svelte';

	const grammars: { [key: string]: string } = {
		typst:
			'https://raw.githubusercontent.com/wolframe-project/tinymist-textmate/refs/heads/main/typst.tmLanguage.json'
	};

	interface ICVScodeTheme extends Omit<IVScodeTheme, 'tokenColors'> {
		tokenColors: ITokenColor[];
	}
	type ITokenColor = Omit<TokenColor, 'scope'> & { id: string } & { scope: string[] };

	let curGrammar: keyof typeof grammars = $state('typst');
	let curTheme: ICVScodeTheme = $state({
		$schema: 'vscode://schemas/color-theme',
		type: 'dark',
		tokenColors: [],
		colors: {},
		name: '',
		include: ''
	});
	let curView: 'none' | 'details' | 'tokens' | 'token' = $state('none');
	let addNewRule = $state(false);
	let newRule: ITokenColor = $state({
		id: createId(),
		name: '',
		scope: [],
		settings: {}
	});
	let curRuleId: string = $state('');
	let curRule = $derived.by(() => {
		return curTheme.tokenColors!.find((r) => r.id == curRuleId);
	});
	let usedColorsRanking: string[] = $derived.by(() => {
		let allColors: {
			[key: string]: number;
		} = {};
		curTheme.tokenColors!.forEach((token) => {
			if (token.settings.foreground) {
				allColors[token.settings.foreground] = (allColors[token.settings.foreground] || 0) + 1;
			}
			if (token.settings.background) {
				allColors[token.settings.background] = (allColors[token.settings.background] || 0) + 1;
			}
		});
		if (curTheme.colors) {
			Object.entries(curTheme.colors).forEach(([color, value]) => {
				allColors[value] = (allColors[value] || 0) + 1;
			});
		}
		return Object.keys(allColors).sort((a, b) => allColors[b] - allColors[a]);
	})
	let importDialogOpen = $state(false);
	let importFile: File | null = $state(null);
	let newThemeDialogOpen = $state(false);
	let newThemeName = $state('');

	let { window: newWindow } = $props();

	const views = {
		none: theme_none,
		details: theme_details,
		tokens: theme_tokens,
		token: theme_token
	};

	const MonacoBaseColors = [
		'editor.background',
		'editor.foreground',
		'menu.background',
		'editor.lineHighlightBackground',
		'editor.selectionBackground',
		'editorCursor.foreground'
	];

    const autocomplete = [
        'markup.bold.typst',
        'markup.italic.typst',
        'markup.underline.typst',
    ]

    let indexedGrammarScopes: string[] = $state([]);

	const DB_NAME = 'themeEditorDB';
	const STORE_NAME = 'themes';
	let themes = $state<string[]>([]);

	let db: IDBDatabase | null = null;

	async function initDB() {
		return new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, 1);
			request.onerror = () => reject('Error opening DB');
			request.onsuccess = () => {
				db = request.result;
				resolve(db);
			};
			request.onupgradeneeded = (event) => {
				const dbInstance = (event.target as IDBOpenDBRequest).result;
				if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
					dbInstance.createObjectStore(STORE_NAME);
				}
			};
		});
	}

	async function saveThemeToDB(theme: IVScodeTheme) {
		if (!db) {
			await initDB();
		}
		if (db) {
			const transaction = db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			store.put(theme, theme.name);
			return new Promise<void>((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject('Error saving theme');
			});
		}
	}

	async function loadThemeFromDB(themeName: string) {
		if (!db) {
			await initDB();
		}
		if (db) {
			return new Promise<IVScodeTheme | undefined>((resolve, reject) => {
				const transaction = db!.transaction([STORE_NAME], 'readonly');
				const store = transaction.objectStore(STORE_NAME);
				const request = store.get(themeName);
				request.onerror = () => reject('Error loading theme');
				request.onsuccess = () => {
					if (request.result) {
						let storedTheme = request.result as IVScodeTheme | ICVScodeTheme;
						if ('id' in storedTheme.tokenColors) curTheme = storedTheme as ICVScodeTheme;
						else {
							curTheme = {
								...storedTheme,
								tokenColors: (storedTheme.tokenColors as TokenColor[]).map((token) => ({
									...token,
									id: createId()
								}))
							} as ICVScodeTheme;
						}
					}
					resolve(request.result);
				};
			});
		}
		return undefined;
	}

	async function loadThemesFromDB() {
		if (!db) {
			await initDB();
		}
		if (db) {
			return new Promise<string[]>((resolve, reject) => {
				const transaction = db!.transaction([STORE_NAME], 'readonly');
				const store = transaction.objectStore(STORE_NAME);
				const request = store.getAllKeys();
				request.onerror = () => reject('Error loading themes');
				request.onsuccess = () => {
					themes = request.result as string[];
					resolve(themes);
				};
			});
		}
		return [];
	}

	$effect(() => {
		loadThemesFromDB().then((loadedThemes) => {
			if (loadedThemes.length === 0) {
				// If no themes are loaded, create a default theme
				curTheme = {
					$schema: 'vscode://schemas/color-theme',
					type: 'dark',
					tokenColors: [],
					colors: {},
					name: 'Default Theme',
					include: ''
				};
			} else {
				loadThemeFromDB(loadedThemes[0])
			}
		})
		// Initialize DB and load theme when component mounts
		return () => {
			console.log('cleanup');
			// Cleanup: close the DB connection when the component is destroyed
			if (db) {
				db.close();
			}
		};
	});

	$effect(() => {
		// Save theme whenever curTheme changes (after the initial load)
		const themeToSave = $state.snapshot(curTheme);
		// Avoid saving the default empty theme immediately on load if not intended
		if (themeToSave.name || themeToSave.tokenColors.length > 0) {
			saveThemeToDB(themeToSave).catch(console.error);
		}
	});

	function overrideTheme() {
		monacoController.changeTheme(convertTheme($state.snapshot(curTheme)), 'test-theme');
	}

	function lastView() {
		if (curView == 'token') {
			curView = 'tokens';
		} else {
			curView = 'none';
		}
	}

    function getScopesFromPattern(pattern: Pattern): string[] {
        const scopes: string[] = [];
        if (pattern.name) {
            scopes.push(pattern.name);
        }
        if ('patterns' in pattern && pattern.patterns) {
            for (const subPattern of pattern.patterns) {
                scopes.push(...getScopesFromPattern(subPattern));
            }
        }
        return scopes;
    }

    function indexGrammar(grammar: Grammar) {
        indexedGrammarScopes = [];
        if (!grammar.repository) return;
        for (const key of Object.keys(grammar.repository)) {
            const rule = grammar.repository[key];
            indexedGrammarScopes.push(...getScopesFromPattern(rule));
        }
		// deduplicate scopes
		indexedGrammarScopes = [...new Set(indexedGrammarScopes)];
		indexedGrammarScopes.sort((a, b) => a.localeCompare(b));
    }

	async function loadGrammar() {
		const grammar = await fetch(grammars[curGrammar]);
		const grammarText = await grammar.json();
        indexGrammar(grammarText);
		return grammarText as Grammar;
	}

	function putNewRule() {
		if (addNewRule) {
			curTheme.tokenColors!.push(newRule);
			addNewRule = false;
			newRule = {
				id: createId(),
				name: '',
				scope: [],
				settings: {}
			};
		}
	}

	function curViewToTitle() {
		switch (curView) {
			case 'none':
				return 'Theme Editor';
			case 'details':
				return 'Theme Details';
			case 'tokens':
				return 'Theme Rules';
			case 'token':
				return 'Rule Details';
		}
	}

	function removeRule(rule: ITokenColor) {
		curTheme.tokenColors = curTheme.tokenColors!.filter((r) => r.id != rule.id);
		if (curView == 'token') curView = 'tokens';
	}

	function exportTheme() {
		const theme = convertTheme($state.snapshot(curTheme));
		const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${curTheme.name || 'theme'}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

{#snippet theme_actions()}
	<button class="btn btn-sm btn-primary" onclick={overrideTheme}> Override Theme </button>
{/snippet}

{#snippet theme_none()}
	<div class="flex flex-col items-center gap-2">
		<button
			class="btn btn-primary w-sm"
			onclick={() => {
				curView = 'details';
			}}>Details</button
		>
		<button
			class="btn btn-primary w-sm"
			onclick={() => {
				curView = 'tokens';
			}}>Tokens</button
		>
	</div>
{/snippet}

{#snippet theme_details()}
	<p class="mb-4 text-2xl">General</p>
	<div class="mb-12 grid grid-cols-2 gap-2">
		<div class="fieldset">
			<legend class="fieldset-legend">Theme Name</legend>
			<input type="text" id="themeName" class="input border" bind:value={curTheme.name} />
		</div>
		<div class="fieldset">
			<legend class="fieldset-legend">Theme Type</legend>
			<select id="themeType" class="select" bind:value={curTheme.type}>
				<option value="dark">Dark</option>
				<option value="light">Light</option>
				<option value="hcDark">High Contrast Dark</option>
				<option value="hcLight">High Contrast Light</option>
			</select>
		</div>
	</div>
	<p class="mb-4 text-2xl">Base Colors</p>
	<div
		class="grid grid-cols-2 gap-8"
	>
		{#each MonacoBaseColors as color}
			<div class="flex flex-col gap-2">
				<label for={color}>{color}</label>
				<ColorPicker hex={curTheme.colors![color]} name={color} onInput={(newColor) => curTheme.colors![color] = newColor.hex ?? ''} />
			</div>
		{/each}
	</div>
{/snippet}

{#snippet theme_tokens()}
	<div class="grid min-w-0 grid-cols-1 gap-6">
		{#if addNewRule}
			<div class="flex flex-col gap-4">
				<p class="text-2xl">New Rule</p>
				<div class="fieldset">
					<legend class="fieldset-legend">Name</legend>
					<input type="text" id="tokenName" class="input border" bind:value={newRule.name} />
				</div>
				<div class="flex w-xs gap-2">
					<button class="btn grow" onclick={() => (addNewRule = false)}>Cancel</button>
					<button class="btn btn-primary grow" onclick={putNewRule}>Add Rule</button>
				</div>
			</div>
		{/if}
		<p class="mb-4 text-2xl">Current Rules</p>
		{#each curTheme.tokenColors as token (token.id)}
			<div class="flex justify-between gap-2">
				<p class="text-2xl">{token.name}</p>
				<div class="flex gap-2">
					<button
						class="btn btn-primary join-item"
						onclick={() => {
							curRuleId = token.id;
							curView = 'token';
						}}>Edit</button
					>
					<button
						class="btn btn-error join-item"
						onclick={() => {
							removeRule(token);
						}}>Remove</button
					>
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet theme_token()}
	<div class="grid grid-cols-1 gap-6">
		<div>
			<p class="mb-4 text-2xl">Rule Details</p>
			<div class="fieldset">
				<legend class="fieldset-legend">Name</legend>
				<input type="text" id="tokenName" class="input border" bind:value={curRule!.name} />
			</div>
		</div>
		<div>
			<p class="mb-4 text-2xl">Settings</p>
            <div class="grid grid-cols-3 gap-4">
			<div class="fieldset">
				<legend class="fieldset-legend">Foreground</legend>
				<div>
					<ColorPicker
						components={A11yVariant as any}
						hex={curRule!.settings.foreground}
						name="foreground"
						isAlpha
						onInput={(color) => (curRule!.settings.foreground = color.hex ?? undefined)}
						a11yColors={[
							{ bgHex: curTheme.colors?.['editor.background'] ?? '#FFF', placeholder: 'let' }
						]}
						nullable
					/>
					<ColorSelect colorList={usedColorsRanking} onColorSelect={(color) => {
						curRule!.settings.foreground = color;
					}} />
				</div>
			</div>
			<div class="fieldset">
				<legend class="fieldset-legend">Background</legend>
				<div>
					<ColorPicker
						components={A11yVariant as any}
						hex={curRule!.settings.background}
						name="background"
						isAlpha
						onInput={(color) => (curRule!.settings.background = color.hex ?? undefined)}
						a11yColors={[
							{ bgHex: curTheme.colors?.['editor.background'] ?? '#FFF', placeholder: 'let' }
						]}
						nullable
					/>
					<ColorSelect colorList={usedColorsRanking} onColorSelect={(color) => {
						curRule!.settings.background = color;
					}} />
				</div>
			</div>
			<div class="fieldset">
				<legend class="fieldset-legend">Font Style</legend>
				<select id="fontStyle" class="select" bind:value={curRule!.settings.fontStyle}>
					<option value="">Normal</option>
					<option value="italic">Italic</option>
					<option value="bold">Bold</option>
					<option value="underline">Underline</option>
					<option value="bold italic">Bold Italic</option>
					<option value="bold underline">Bold Underline</option>
					<option value="italic underline">Italic Underline</option>
					<option value="bold italic underline">Bold Italic Underline</option>
				</select>
			</div>
            </div>
		</div>
		<div>
			<p class="mb-4 text-2xl">Scopes</p>
            <div class="grid grid-cols-1 gap-2">
                {#each curRule!.scope as scope, i}
                    <TagInput bind:value={curRule!.scope[i]} useCompletions={true} completions={indexedGrammarScopes} onBlur={() => {
						if (curRule!.scope[i] == "") {
							curRule!.scope.splice(i, 1);
						}
					}} />
                {/each}
                <button class="btn btn-primary max-w-xs" onclick={(e) => {
                    curRule!.scope.push("");
                }}>Add new scope</button>
            </div>
		</div>
	</div>
{/snippet}

<div class="flex h-screen w-screen flex-col gap-2"
		style="--cp-bg-color: #333; --cp-input-color: #555;--cp-button-hover-color: #777;">
	{#await loadGrammar()}
		<p>Loading grammar</p>
	{:then g}
		<div class="grid grid-cols-3 items-center gap-2 p-2">
			<div class="flex items-center gap-2">
				{#if curView != 'none'}<button class="btn btn-square btn-sm btn-primary" onclick={lastView}
						><ChevronLeft /></button
					>{/if}
				{#if curView == 'tokens'}
					<div class="tooltip tooltip-bottom" data-tip="Add new rule">
						<button
							class="btn btn-square btn-sm btn-primary"
							onclick={() => {
								addNewRule = true;
							}}><Plus /></button
						>
					</div>
				{/if}
				{#if curView == 'none'}
					<button class="btn btn-sm btn-primary" onclick={() => importDialogOpen = true}>
						Import Theme
					</button>
					<button class="btn btn-sm btn-primary" onclick={exportTheme}>
						Export Theme
					</button>
					<details class="dropdown">
						<summary class="btn btn-sm btn-primary">Select Theme</summary>
						<ul class="menu dropdown-content bg-base-200 rounded-box z-1 w-52 p-2 shadow-sm max-h-64 overflow-y-auto flex-nowrap">
							<li><button class="w-full text-left" onclick={() => newThemeDialogOpen = true}>New Theme</button></li>
							{#each themes as theme}
								<li>
									<button
										class="w-full text-left"
										onclick={() => {
											loadThemeFromDB(theme).then(() => {
												curView = 'none';
											});
										}}>{theme}</button>
								</li>
							{/each}
						</ul>
					</details>
				{/if}
			</div>
			<div>
				<p class="text-xl font-semibold text-center">{curViewToTitle()} - {curTheme.name}</p>
			</div>
			<div class="justify-self-end">
				{@render theme_actions()}
			</div>
		</div>
		<div class="min-w-0 grow overflow-auto p-2">
			{@render views[curView]()}
		</div>
	{/await}
</div>

<Dialog bind:open={importDialogOpen}>
	<fieldset class="fieldset">
		<legend class="fieldset-legend">Pick a file</legend>
		<input type="file" class="file-input" accept="application/json" bind:value={importFile} />
	</fieldset>
	<div class="flex justify-end gap-2">
		<button class="btn btn-primary" onclick={() => {
			if (importFile) {
				const reader = new FileReader();
				reader.onload = async (e) => {
					try {
						const content = e.target?.result as string;
						const theme = JSON.parse(content) as IVScodeTheme;
						if (theme.$schema === 'vscode://schemas/color-theme') {
							curTheme = theme as ICVScodeTheme;
							themes.push(curTheme.name!);
							importDialogOpen = false;
							curView = 'none';
						} else {
							alert('Invalid theme file');
						}
					} catch (error) {
						alert('Error reading theme file: ' + error);
					}
				};
				reader.readAsText(importFile);
			}
		}}>Import Theme</button>
		<button class="btn" onclick={() => importDialogOpen = false}>Cancel</button>
</Dialog>

<Dialog bind:open={newThemeDialogOpen}>
	<fieldset class="fieldset">
		<legend class="fieldset-legend">New Theme</legend>
		<input type="text" class="input border" placeholder="Theme Name" bind:value={newThemeName} />
	</fieldset>
	<div class="flex justify-end gap-2">
		<button class="btn btn-primary" onclick={() => {
			newThemeDialogOpen = false;
			curView = 'none';
			let newTheme = {
				$schema: 'vscode://schemas/color-theme',
				type: 'dark',
				tokenColors: [],
				colors: {},
				name: newThemeName,
				include: ''
			} as ICVScodeTheme;
			curTheme = newTheme;
			themes.push(newThemeName);
		}}>Create Theme</button>
		<button class="btn" onclick={() => newThemeDialogOpen = false}>Cancel</button>
	</div>
</Dialog>
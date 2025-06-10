<script lang="ts">
    let {
        colorList = [],
        onColorSelect = (color: string) => {}
    }: {
        colorList?: string[];
        onColorSelect?: (color: string) => void;
    } = $props();
</script>

<details class="dropdown">
						<summary class="btn m-1">Select color</summary>
						<ul class="menu dropdown-content bg-base-200 rounded-box z-1 w-52 p-2 shadow-sm h-64 overflow-y-auto flex-nowrap">
							{#each colorList as color}
								<li>
									<button
										class="w-full text-left"
										onclick={() => {
											onColorSelect(color);
										}}><span class="size-4 border border-black" style="background-color: {color};"></span>{color}</button>
								</li>
							{/each}
						</ul>
					</details>
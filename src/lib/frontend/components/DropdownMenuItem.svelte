<script lang="ts">
	import Dropdown from './Dropdown.svelte';

	let { name, children } = $props();
</script>

<Dropdown className="dropdown">
	<summary class="py-1 after:hidden">{name}</summary>
	<ul class="bg-base-100 border-base-300 z-20 mt-0! min-w-44 border">
		{@render children()}
	</ul>
</Dropdown>

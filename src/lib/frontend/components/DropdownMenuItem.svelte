<script lang="ts">
	import Dropdown from "./Dropdown.svelte";

    let {
        name,
        children
    } = $props();
</script>

<Dropdown className="">
    {#snippet body()}
    <summary class="after:hidden py-1">{name}</summary>
    <ul class="bg-base-100 mt-0! min-w-44 z-20 border border-base-300">
        {@render children()}
    </ul>
    {/snippet}
</Dropdown>
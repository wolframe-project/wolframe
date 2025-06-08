<script lang="ts">
    let detailsElement: HTMLDetailsElement;

    let {
        body,
        className
    } = $props();
</script>

<svelte:window onclick={(e) => {
    if (detailsElement && detailsElement.open) {
        setTimeout(() => {
            if (detailsElement.open) {
                detailsElement.open = false;
            }
        }, 2)
    }
}} />

<details bind:this={detailsElement} class={className}>
    {@render body()}
</details>
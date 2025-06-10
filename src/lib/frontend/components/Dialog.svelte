<script lang="ts">

    let {
        open = $bindable(false),
        children
    } = $props();

    let dialog: HTMLDialogElement;

    $effect(() => {
        if (open) {
            dialog.showModal();
        } else {
            dialog.close();
        }
    })
</script>

<dialog bind:this={dialog} class="modal">
    <div class="modal-box">
        <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={() => open = false}>✕</button>
        </form>
        {@render children()}
    </div>
</dialog>
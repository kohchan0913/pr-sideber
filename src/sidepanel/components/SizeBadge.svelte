<script lang="ts">
	type Props = Readonly<{
		additions: number;
		deletions: number;
	}>;

	const { additions, deletions }: Props = $props();
</script>

<span class="size-text">
	<span class="size-additions">+{additions}</span>
	<span class="size-deletions">-{deletions}</span>
</span>

<style>
	.size-text {
		font-size: 11px;
		font-family: var(--font-mono, monospace);
		letter-spacing: -0.02em;
	}

	.size-additions {
		color: var(--color-success, #3fb950);
	}

	.size-deletions {
		color: var(--color-danger, #f85149);
		margin-left: 4px;
	}
</style>

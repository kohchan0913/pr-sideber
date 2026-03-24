<script lang="ts">
	import "../styles/badge.css";

	type Props = {
		count: number;
	};

	const { count }: Props = $props();
</script>

{#if count > 0}
	<span class="badge badge-orange" title="Unresolved comments">💬 {count}</span>
{/if}

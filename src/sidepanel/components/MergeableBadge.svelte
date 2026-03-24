<script lang="ts">
	import type { MergeableStatus } from "../../shared/types/wasm";
	import "../styles/badge.css";

	type Props = {
		mergeableStatus: MergeableStatus;
	};

	const { mergeableStatus }: Props = $props();

	// "Mergeable" (コンフリクトなし) は正常状態のためノイズ削減で非表示。
	// config に存在しないキーは $derived で undefined → {#if resolved} で非表示になる。
	const config: Record<string, { label: string; colorClass: string; animate: boolean }> = {
		Conflicting: { label: "CONFLICT", colorClass: "badge-red", animate: false },
		Unknown: { label: "CHECKING...", colorClass: "badge-gray", animate: true },
	};

	const resolved = $derived(config[mergeableStatus]);
</script>

{#if resolved}
	<span class="badge {resolved.colorClass}" class:badge-animate={resolved.animate}
		>{resolved.label}</span
	>
{/if}

<style>
	.badge-animate {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.badge-animate {
			animation: none;
		}
	}
</style>

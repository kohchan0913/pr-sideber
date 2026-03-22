<script lang="ts">
	import { untrack } from "svelte";
	import type { ProcessedPrsResult } from "../../domain/ports/pr-processor.port";
	import LogoutButton from "./LogoutButton.svelte";
	import PrSection from "./PrSection.svelte";

	type Props = {
		onLogout: () => Promise<void>;
		fetchPrs: () => Promise<ProcessedPrsResult & { hasMore: boolean }>;
	};

	const { onLogout, fetchPrs }: Props = $props();

	let loading = $state(true);
	let error = $state<string | null>(null);
	let data = $state<(ProcessedPrsResult & { hasMore: boolean }) | null>(null);

	async function loadPrs(): Promise<void> {
		loading = true;
		error = null;
		try {
			data = await fetchPrs();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : "Unknown error";
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		let cancelled = false;

		untrack(async () => {
			loading = true;
			error = null;
			try {
				const result = await fetchPrs();
				if (!cancelled) {
					data = result;
				}
			} catch (e: unknown) {
				if (!cancelled) {
					error = e instanceof Error ? e.message : "Unknown error";
				}
			} finally {
				if (!cancelled) {
					loading = false;
				}
			}
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<main>
	<header>
		<h1>PR Sidebar</h1>
		<LogoutButton {onLogout} />
	</header>

	{#if loading}
		<p>Loading...</p>
	{:else if error}
		<div class="error-container">
			<p class="error">{error}</p>
			<button class="retry-button" onclick={loadPrs}>再試行</button>
		</div>
	{:else if data}
		<PrSection title="My PRs" items={data.myPrs.items} />
		<PrSection title="Review Requests" items={data.reviewRequests.items} />
	{/if}
</main>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border-primary);
		position: sticky;
		top: 0;
		background: var(--color-bg-primary);
		z-index: 10;
	}

	h1 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	main {
		padding: 0.75rem;
		min-height: 100vh;
		background: var(--color-bg-primary);
	}

	.error-container {
		text-align: center;
		padding: 1rem 0;
	}

	.error {
		color: var(--color-badge-red);
	}

	.retry-button {
		margin-top: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: var(--color-accent-primary);
		color: var(--color-bg-primary);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: opacity 0.15s;
	}

	.retry-button:hover {
		opacity: 0.85;
	}

	.retry-button:active {
		opacity: 0.7;
	}
</style>

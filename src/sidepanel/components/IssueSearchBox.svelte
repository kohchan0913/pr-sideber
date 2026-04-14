<script lang="ts">
	type Props = {
		onSearch: (issueNumber: number) => void;
		notFoundMessage?: string | null;
	};

	const { onSearch, notFoundMessage }: Props = $props();

	let inputValue = $state("");

	function handleSubmit(event: Event): void {
		event.preventDefault();
		const trimmed = inputValue.trim();
		if (trimmed === "") return;
		const num = Number.parseInt(trimmed, 10);
		if (!Number.isFinite(num) || num <= 0) return;
		onSearch(num);
	}
</script>

<form class="search-form" onsubmit={handleSubmit}>
	<div class="search-row">
		<span class="search-prefix">#</span>
		<input
			type="text"
			inputmode="numeric"
			pattern="[0-9]*"
			class="search-input"
			placeholder="Issue 番号"
			bind:value={inputValue}
			aria-label="Issue number to search"
		/>
		<button type="submit" class="search-btn" aria-label="Search">
			<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
				<path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
			</svg>
		</button>
	</div>
	{#if notFoundMessage}
		<p class="not-found" role="status">{notFoundMessage}</p>
	{/if}
</form>

<style>
	.search-form {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.375rem 0;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border-primary);
		border-radius: 4px;
		padding: 0.125rem 0.375rem;
		transition: border-color 0.15s;
	}

	.search-row:focus-within {
		border-color: var(--color-accent-primary);
	}

	.search-prefix {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.search-input {
		flex: 1 1 auto;
		min-width: 0;
		background: none;
		border: none;
		outline: none;
		color: var(--color-text-primary);
		font-size: 0.8125rem;
		padding: 0.125rem 0;
	}

	.search-input::placeholder {
		color: var(--color-text-secondary);
	}

	.search-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		transition: color 0.15s;
		flex-shrink: 0;
	}

	.search-btn:hover {
		color: var(--color-accent-primary);
	}

	.not-found {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-badge-red);
	}
</style>

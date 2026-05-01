<script lang="ts">
  import type { DebugState } from "../../shared/types/messages";

  interface Props {
    getDebugState: () => Promise<DebugState>;
  }

  const { getDebugState }: Props = $props();

  let debugState = $state<DebugState | null>(null);
  let loading = $state(false);
  let copied = $state(false);

  async function refresh(): Promise<void> {
    loading = true;
    try {
      debugState = await getDebugState();
    } catch (e: unknown) {
      console.error("Failed to load debug state:", e);
    } finally {
      loading = false;
    }
  }

  async function copyToClipboard(): Promise<void> {
    if (!debugState) return;
    await navigator.clipboard.writeText(JSON.stringify(debugState, null, 2));
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2000);
  }

  $effect(() => {
    refresh();
  });
</script>

<div class="debug-panel">
  <div class="debug-header">
    <h3>Debug</h3>
    <div class="debug-actions">
      <button onclick={refresh} disabled={loading}>Refresh</button>
      <button onclick={copyToClipboard} disabled={!debugState}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  </div>

  {#if debugState}
    <section>
      <h4>Watcher</h4>
      <p>Monitoring tabs: {debugState.watcherTabCount}</p>
    </section>

    <section>
      <h4>Claude Sessions</h4>
      <pre class="debug-json">{JSON.stringify(debugState.claudeSessions, null, 2)}</pre>
    </section>

    <section>
      <h4>Logs ({debugState.logs.length})</h4>
      {#if debugState.logs.length === 0}
        <p class="empty">No logs</p>
      {:else}
        <div class="log-list">
          {#each debugState.logs as entry, i (entry.timestamp + i)}
            <div class="log-entry log-{entry.level}">
              <span class="log-time">{entry.timestamp.slice(11, 19)}</span>
              <span class="log-level">{entry.level}</span>
              <span class="log-source">{entry.source}</span>
              <span class="log-msg">{entry.message}</span>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {:else if loading}
    <p>Loading...</p>
  {/if}
</div>

<style>
  .debug-panel {
    padding: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  h3 {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .debug-actions {
    display: flex;
    gap: 0.25rem;
  }

  .debug-actions button {
    padding: 0.125rem 0.5rem;
    font-size: 0.7rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 3px;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .debug-actions button:hover:not(:disabled) {
    color: var(--color-accent-primary);
    border-color: var(--color-accent-primary);
  }

  .debug-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  section {
    margin-bottom: 0.75rem;
  }

  h4 {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 0.25rem;
    border-bottom: 1px solid var(--color-border-primary);
    padding-bottom: 0.125rem;
  }

  .debug-json {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 3px;
    padding: 0.375rem;
    font-size: 0.65rem;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .empty {
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .log-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--color-border-primary);
    border-radius: 3px;
  }

  .log-entry {
    display: flex;
    gap: 0.375rem;
    padding: 0.125rem 0.375rem;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.65rem;
    border-bottom: 1px solid var(--color-border-primary);
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .log-time {
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .log-level {
    flex-shrink: 0;
    font-weight: 600;
    min-width: 2.5rem;
  }

  .log-source {
    color: var(--color-accent-primary);
    flex-shrink: 0;
  }

  .log-msg {
    color: var(--color-text-primary);
    word-break: break-all;
  }

  .log-info .log-level {
    color: var(--color-accent-primary);
  }

  .log-warn .log-level {
    color: var(--color-badge-yellow);
  }

  .log-error .log-level {
    color: var(--color-badge-red);
  }
</style>

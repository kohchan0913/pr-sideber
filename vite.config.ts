import { crx } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import manifest from "./src/manifest.json";

export default defineConfig({
	plugins: [svelte(), crx({ manifest })],
	build: {
		target: "esnext",
	},
});

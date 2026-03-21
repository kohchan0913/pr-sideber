import svelte from "eslint-plugin-svelte";

export default [
	...svelte.configs["flat/recommended"],
	{
		files: ["**/*.svelte"],
	},
	{
		ignores: ["dist/", "node_modules/", "pkg/", "target/"],
	},
];

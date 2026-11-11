// Vite's `?raw` suffix imports a file as a string (used to check the README).
declare module '*?raw' {
	const content: string;
	export default content;
}

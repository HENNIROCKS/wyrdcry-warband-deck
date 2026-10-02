/** Resolves once the frame after the next one has started, so the current state is on screen. */
export function painted(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

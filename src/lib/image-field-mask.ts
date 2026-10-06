import maskShape from './image-field-mask.svg?raw';

/**
 * The mask the card's image field is cut with, as a CSS value. The shape comes
 * from the Card Creator, where it is called the runemark. Inlined as a data URL
 * because a mask cannot point at a Svelte import.
 */
export const imageFieldMask = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(maskShape)}")`;

/**
 * A fighter's photo: shrunk on the way in, laid out in the square image field.
 * The layout functions are plain arithmetic, so they run without a DOM.
 */

import type { PhotoCrop, StoredPhoto } from './types/warband';

export class PhotoError extends Error {}

/** What the card needs to draw a photo: the object URL and the two background values. */
export interface PhotoView {
	url: string;
	size: string;
	position: string;
}

const SHORT_EDGE = 768;
export const MAX_ZOOM = 2;
export const CENTRE: PhotoCrop = { x: 0.5, y: 0.5, zoom: 1 };

const UNREADABLE =
	'This photo could not be read. A HEIC photo opens in Safari only – export it as JPEG or pick it on the iPhone.';

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
	try {
		const bitmap = await createImageBitmap(file);
		return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
	} catch {
		const url = URL.createObjectURL(file);
		try {
			const img = new Image();
			img.src = url;
			await img.decode();
			return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
		} catch {
			throw new PhotoError(UNREADABLE);
		} finally {
			URL.revokeObjectURL(url);
		}
	}
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Decodes the file, shrinks it to `SHORT_EDGE` on the shorter side (never
 * enlarging) and encodes it as WebP, or as JPEG where the browser cannot write
 * WebP – it then hands back PNG without saying so, hence the check on the type.
 */
export async function readPhoto(file: File): Promise<StoredPhoto> {
	const image = await decode(file);
	try {
		if (!image.width || !image.height) throw new PhotoError(UNREADABLE);
		const k = Math.min(1, SHORT_EDGE / Math.min(image.width, image.height));
		const width = Math.max(1, Math.round(image.width * k));
		const height = Math.max(1, Math.round(image.height * k));
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new PhotoError(UNREADABLE);
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(image.source, 0, 0, width, height);
		let blob = await encode(canvas, 'image/webp', 0.8);
		if (blob?.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', 0.82);
		if (!blob) throw new PhotoError(UNREADABLE);
		return { bytes: await blob.arrayBuffer(), type: blob.type, width, height, crop: { ...CENTRE }, updatedAt: new Date().toISOString() };
	} finally {
		image.release();
	}
}

/** The share of the square field the whole image takes along each axis, at zoom 1 the shorter side being 1. */
function extent(width: number, height: number, zoom: number): { w: number; h: number } {
	const a = width / height;
	return a >= 1 ? { w: a * zoom, h: zoom } : { w: zoom, h: zoom / a };
}

/** `background-size` and `-position` for the square image field. */
export function photoLayout(width: number, height: number, crop: PhotoCrop): { size: string; position: string } {
	const { w, h } = extent(width, height, crop.zoom);
	return { size: `${w * 100}% ${h * 100}%`, position: `${crop.x * 100}% ${crop.y * 100}%` };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The crop after the picture was dragged by dx/dy screen pixels in a field `boxPx` wide. */
export function panCrop(crop: PhotoCrop, width: number, height: number, boxPx: number, dx: number, dy: number): PhotoCrop {
	const { w, h } = extent(width, height, crop.zoom);
	const bw = boxPx * w;
	const bh = boxPx * h;
	return {
		...crop,
		x: bw > boxPx ? clamp(crop.x - dx / (bw - boxPx), 0, 1) : crop.x,
		y: bh > boxPx ? clamp(crop.y - dy / (bh - boxPx), 0, 1) : crop.y
	};
}

export function zoomCrop(crop: PhotoCrop, zoom: number): PhotoCrop {
	return { ...crop, zoom: clamp(zoom, 1, MAX_ZOOM) };
}

/* Reine Client-App: es gibt keinen Server, der etwas vorrendern könnte, und
   IndexedDB ist beim Prerender ohnehin nicht erreichbar. */
export const prerender = true;
export const ssr = false;

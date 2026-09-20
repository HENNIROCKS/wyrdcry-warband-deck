/* Pure client app: there is no server that could prerender anything, and
   IndexedDB is out of reach during prerendering anyway. */
export const prerender = true;
export const ssr = false;

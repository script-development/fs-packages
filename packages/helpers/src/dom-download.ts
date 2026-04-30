/**
 * Triggers a browser download for a Blob.
 *
 * Creates a transient `<a>` element pointing at an object URL, dispatches a
 * click, then revokes the URL. The browser's download UI captures its own
 * reference during click(), so revoking immediately does not interrupt the
 * in-flight download — it simply releases the blob reference held by the URL.
 *
 * Lives in `fs-helpers` rather than `fs-http` so the HTTP factory remains a
 * transport-only library with no DOM coupling (fs-packages issue #59).
 */
export const triggerDownload = (blob: Blob, filename: string): void => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
};

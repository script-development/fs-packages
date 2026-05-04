// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {triggerDownload} from '../src';

describe('triggerDownload', () => {
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        createObjectURL = vi.fn(() => 'blob:https://test/fake-object-url');
        revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', {createObjectURL, revokeObjectURL});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('creates an anchor with the object URL and download filename, clicks, then revokes', () => {
        // Arrange
        const blob = new Blob(['file-content'], {type: 'application/pdf'});
        const link = document.createElement('a');
        const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => {});
        const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(link);

        // Act
        triggerDownload(blob, 'report.pdf');

        // Assert — anchor created with the right shape and clicked
        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(createObjectURL).toHaveBeenCalledWith(blob);
        expect(link.href).toBe('blob:https://test/fake-object-url');
        expect(link.download).toBe('report.pdf');
        expect(clickSpy).toHaveBeenCalledTimes(1);

        // Assert — revoked with the same URL that was assigned to href
        expect(revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:https://test/fake-object-url');
    });

    it('revokes after click so the browser can release the blob reference', () => {
        // Arrange — record the order of click vs revoke
        const callOrder: string[] = [];
        const blob = new Blob(['data']);
        const link = document.createElement('a');
        vi.spyOn(link, 'click').mockImplementation(() => {
            callOrder.push('click');
        });
        vi.spyOn(document, 'createElement').mockReturnValue(link);
        revokeObjectURL.mockImplementation(() => {
            callOrder.push('revoke');
        });

        // Act
        triggerDownload(blob, 'file.bin');

        // Assert — click fires before revoke (the in-flight download captures its own ref)
        expect(callOrder).toEqual(['click', 'revoke']);
    });
});

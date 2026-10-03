import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

/**
 * WR-1991: a listbox's open state has one writer, `useListbox`. A component that flips `open`
 * itself skips the close path, so the typed string and its timer outlive the closed list. The
 * composable returns `open` read-only, but a cast gets past the type, so the source is asserted too.
 */
const COMPONENTS = path.join(import.meta.dirname, '..', 'src', 'components');

const FILES = readdirSync(COMPONENTS)
    .filter((name) => name.endsWith('.vue'))
    .map((name) => ({name, source: readFileSync(path.join(COMPONENTS, name), 'utf8')}));

const LISTBOX_HOSTS = FILES.filter(({source}) => source.includes('useListbox('));

const DIRECT_OPEN_WRITE = /\bopen\.value\s*=(?!=)/u;

describe('listbox open state has one owner', () => {
    it('found the listbox components it is meant to scan', () => {
        // Without this the guard passes over an empty list — a clean report from a scan that never ran.
        expect(LISTBOX_HOSTS.map(({name}) => name).sort()).toEqual([
            'Combobox.vue',
            'GroupCombobox.vue',
            'GroupSelect.vue',
            'MultiCombobox.vue',
            'MultiSelect.vue',
            'SingleSelect.vue',
        ]);
    });

    it('no component writes open.value directly', () => {
        const offenders = FILES.filter(({source}) => DIRECT_OPEN_WRITE.test(source)).map(({name}) => name);

        expect(offenders).toEqual([]);
    });
});

// Browser-mode SHADOW-DOM spec (real Chromium) — scope: contract + interaction only.
//
// This file exists because happy-dom does NOT retarget composed events: in the unit suite a
// click inside a shadow root still reports the inner element as `event.target`, so the unit
// layer cannot tell `event.target` from `composedPath()` and cannot prove this fix. Chromium
// retargets for real, which is the whole point.
import {afterEach, describe, expect, it} from 'vitest';
import {createApp, defineComponent, h, ref} from 'vue';

import MultiSelect from '../../src/components/MultiSelect.vue';
import uiCss from '../../styles.css?inline';

interface Fruit {
    id: number;
    name: string;
}

const FRUITS: Fruit[] = [
    {id: 1, name: 'Watermelon'},
    {id: 2, name: 'Apricot'},
    {id: 3, name: 'Mango'},
];

let host: HTMLElement | null = null;
let app: ReturnType<typeof createApp> | null = null;
let documentStyle: HTMLStyleElement | null = null;

afterEach(() => {
    app?.unmount();
    host?.remove();
    documentStyle?.remove();
    app = null;
    host = null;
    documentStyle = null;
});

/** Mount a MultiSelect inside a real open shadow root, with the package stylesheet adopted. */
const mountInShadow = (model: {value: number[]}): ShadowRoot => {
    // The realistic shadow-DOM adoption: the sheet goes in BOTH places. `:where(:root)` cannot
    // match inside a shadow tree (a ShadowRoot is not an element), so the document copy is what
    // declares the `--ui-*` values — custom properties then inherit through the host. The
    // shadow copy is what brings the `.ui-*` class rules into the encapsulated tree.
    documentStyle = document.createElement('style');
    documentStyle.textContent = uiCss;
    document.head.append(documentStyle);

    host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({mode: 'open'});

    // The popup never leaves the shadow root, so this encapsulated sheet reaches it — the
    // property the earlier teleport gave away.
    const style = document.createElement('style');
    style.textContent = uiCss;
    shadow.append(style);

    const mountPoint = document.createElement('div');
    shadow.append(mountPoint);
    app = createApp(
        defineComponent(
            () => () =>
                h(MultiSelect, {
                    options: FRUITS,
                    label: 'name',
                    id: 'fruit',
                    modelValue: model.value,
                    'onUpdate:modelValue': (value: number[]) => {
                        model.value = value;
                    },
                }),
        ),
    );
    app.mount(mountPoint);
    return shadow;
};

/** A real composed click — what a user gesture produces, and what document retargets. */
const click = (element: Element) => element.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));

describe('shadow DOM — click-outside survives event retargeting (KD-1136)', () => {
    it('keeps MultiSelect open when an option inside the shadow root is committed', async () => {
        const model = ref<number[]>([]);
        const shadow = mountInShadow(model);

        click(shadow.querySelector('#fruit') as HTMLElement);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(shadow.querySelector('.ui-multiselect__menu')).not.toBeNull();

        // The decisive click. At the document listener Chromium retargets this to the shadow
        // HOST — an ancestor of the control root, not a descendant — so `root.contains(target)`
        // is false. Without composedPath(), onOutside() fires and the menu closes on commit.
        click(shadow.querySelectorAll('.ui-multiselect__option')[0] as HTMLElement);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Options render sorted by label, so index 0 is Apricot (id 2).
        expect(model.value).toEqual([2]);
        // The load-bearing assertion: toggle-and-stay-open survived. Without composedPath()
        // the retargeted click reads as outside and the menu closes here.
        expect(shadow.querySelector('.ui-multiselect__menu')).not.toBeNull();
    });

    it('still closes on a genuine outside click', async () => {
        const model = ref<number[]>([]);
        const shadow = mountInShadow(model);

        click(shadow.querySelector('#fruit') as HTMLElement);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(shadow.querySelector('.ui-multiselect__menu')).not.toBeNull();

        click(document.body);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(shadow.querySelector('.ui-multiselect__menu')).toBeNull();
    });

    it('adopts the shadow root stylesheet on the popup — it never leaves the tree', async () => {
        const model = ref<number[]>([]);
        const shadow = mountInShadow(model);

        click(shadow.querySelector('#fruit') as HTMLElement);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const menu = shadow.querySelector('.ui-multiselect__menu') as HTMLElement;
        expect(menu).not.toBeNull();
        // A teleported popup would sit in the light DOM with none of this applied.
        expect(getComputedStyle(menu).backgroundColor).toBe('rgb(255, 255, 255)'); // --ui-menu-bg
        expect(getComputedStyle(menu).borderTopLeftRadius).toBe('8px'); // --ui-menu-radius
    });
});

// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it, vi} from 'vitest';

import Textarea from '../src/components/Textarea.vue';

describe('Textarea', () => {
    it('renders a textarea reflecting the model and valid state', () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', placeholder: 'Notes', modelValue: 'hello'}});
        const textarea = wrapper.find('textarea');

        expect((textarea.element as HTMLTextAreaElement).value).toBe('hello');
        expect(textarea.classes()).toContain('ui-control');
        expect(textarea.classes()).toContain('ui-textarea');
        expect(textarea.classes()).not.toContain('is-invalid');
        expect(textarea.attributes('aria-invalid')).toBeUndefined();
        expect(textarea.attributes('aria-required')).toBeUndefined();
    });

    it('renders empty for a null model', () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', placeholder: 'Notes', modelValue: null}});
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('');
    });

    it('honours placeholder/rows/required/invalid/describedby', () => {
        const wrapper = mount(Textarea, {
            props: {
                id: 'notes',
                modelValue: 'hi',
                placeholder: 'Notes',
                rows: 4,
                required: true,
                invalid: true,
                describedby: 'notes-error',
            },
        });
        const textarea = wrapper.find('textarea');

        expect(textarea.attributes('placeholder')).toBe('Notes');
        expect(textarea.attributes('rows')).toBe('4');
        expect(textarea.classes()).toContain('is-invalid');
        expect(textarea.attributes('aria-invalid')).toBe('true');
        expect(textarea.attributes('aria-required')).toBe('true');
        expect(textarea.attributes('aria-describedby')).toBe('notes-error');
    });

    it('emits the text on input', async () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', placeholder: 'Notes', modelValue: null}});
        await wrapper.find('textarea').setValue('a note');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['a note']);
    });

    it("emits '' when the textarea is cleared (raw native value; middleware maps to null)", async () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', placeholder: 'Notes', modelValue: 'hi'}});
        await wrapper.find('textarea').setValue('');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['']);
    });

    it('renders the disabled attribute when disabled', () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', placeholder: 'Notes', disabled: true, modelValue: null}});
        expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
    });

    it("follows the parent's model: a new value shows, and null shows an empty field", async () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', placeholder: 'Notes', modelValue: 'hi'}});
        const element = wrapper.find('textarea').element;

        await wrapper.setProps({modelValue: 'there'});
        expect(element.value).toBe('there');

        await wrapper.setProps({modelValue: null});
        expect(element.value).toBe('');
    });

    it('puts every attribute, class and style included, on the textarea: it is its own root', () => {
        const wrapper = mount(Textarea, {
            props: {id: 'notes', placeholder: 'Notes', modelValue: null},
            attrs: {class: 'w-40', style: 'margin: 1px', 'data-test': 'notes', maxlength: '500'},
        });
        const textarea = wrapper.find('textarea');

        expect(wrapper.element).toBe(textarea.element);
        expect(textarea.classes()).toEqual(expect.arrayContaining(['ui-control', 'w-40']));
        expect(textarea.attributes('style')).toBe('margin: 1px;');
        expect(textarea.attributes('data-test')).toBe('notes');
        expect(textarea.attributes('maxlength')).toBe('500');
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Textarea autogrow (happy-dom: wiring only; the sizing is pinned in the browser suite)', () => {
    const props = {id: 'notes', placeholder: 'Notes', modelValue: 'x'};

    it('marks itself is-autogrow and sets its own height, only when asked', () => {
        const grown = mount(Textarea, {props: {...props, autogrow: true}});
        const plain = mount(Textarea, {props});

        expect(grown.find('textarea').classes()).toContain('is-autogrow');
        expect(grown.find('textarea').element.style.height).toMatch(/px$/);
        expect(plain.find('textarea').classes()).not.toContain('is-autogrow');
        expect(plain.find('textarea').element.style.height).toBe('');
    });

    // happy-dom has no layout, so these give the textarea measurements to size from.
    const measured = (scrollHeight: number, style: Partial<CSSStyleDeclaration>) => {
        const height = vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
        vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            borderTopWidth: '1px',
            borderBottomWidth: '1px',
            paddingTop: '8px',
            paddingBottom: '8px',
            lineHeight: '20px',
            fontSize: '14px',
            ...style,
        } as CSSStyleDeclaration);
        return height;
    };

    it('sizes to the content plus its borders, and caps at maxRows lines, scrolling past that', () => {
        measured(100, {});
        const free = mount(Textarea, {props: {...props, autogrow: true}});
        const capped = mount(Textarea, {props: {...props, autogrow: true, maxRows: 3}});

        expect(free.find('textarea').element.style.height).toBe('102px');
        expect(free.find('textarea').element.style.overflowY).toBe('hidden');
        // 3 lines of 20px, 16px padding, 2px border
        expect(capped.find('textarea').element.style.height).toBe('78px');
        expect(capped.find('textarea').element.style.overflowY).toBe('auto');
    });

    it("falls back to 1.2 × the font size for a 'normal' line height, and to 0 for an unset length", () => {
        measured(100, {lineHeight: 'normal', borderTopWidth: '', borderBottomWidth: ''});
        const capped = mount(Textarea, {props: {...props, autogrow: true, maxRows: 2}});

        // 2 × 16.8px + 16px padding, no border
        expect(capped.find('textarea').element.style.height).toBe('49.6px');
    });

    it('refits after a model change from the parent, and on input while an input method composes', async () => {
        const height = measured(100, {});
        const wrapper = mount(Textarea, {props: {...props, autogrow: true}});
        const element = wrapper.find('textarea').element;

        height.mockReturnValue(140);
        await wrapper.setProps({modelValue: 'x\ny\nz'});
        expect(element.style.height).toBe('142px');

        // While composing, v-model does not update the model, so only the input event can refit.
        height.mockReturnValue(180);
        element.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
        element.value = 'x\ny\nz\nか';
        element.dispatchEvent(new Event('input', {bubbles: true}));
        expect(element.style.height).toBe('182px');
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });
    it('refits when its width changes, and only then; observes nothing without autogrow', () => {
        const observers: {callback: ResizeObserverCallback; observed: Element[]; disconnected: boolean}[] = [];
        vi.stubGlobal(
            'ResizeObserver',
            class {
                record: (typeof observers)[number];
                constructor(callback: ResizeObserverCallback) {
                    this.record = {callback, observed: [], disconnected: false};
                    observers.push(this.record);
                }
                observe(element: Element) {
                    this.record.observed.push(element);
                }
                disconnect() {
                    this.record.disconnected = true;
                }
            },
        );
        const resize = (index: number, width: number) =>
            observers[index]!.callback([{contentRect: {width}} as ResizeObserverEntry], {} as ResizeObserver);

        const height = measured(100, {});
        const wrapper = mount(Textarea, {props: {...props, autogrow: true}});
        const plain = mount(Textarea, {props});
        const element = wrapper.find('textarea').element;
        expect(observers[0]!.observed).toEqual([element]);
        expect(observers[1]!.observed).toEqual([]);

        resize(0, 400);
        height.mockReturnValue(300);
        resize(0, 400);
        expect(element.style.height).toBe('102px');

        resize(0, 150);
        expect(element.style.height).toBe('302px');

        wrapper.unmount();
        plain.unmount();
        expect(observers.every(({disconnected}) => disconnected)).toBe(true);
        vi.unstubAllGlobals();
    });
});

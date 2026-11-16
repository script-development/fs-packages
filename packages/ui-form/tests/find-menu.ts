import type {VueWrapper} from '@vue/test-utils';

import OptionList from '../src/components/OptionList.vue';

/**
 * The VTU handle onto the open listbox's `<ul>`. The listbox is promoted to the top layer in
 * place (KD-1136), so it stays inside the control; every select renders the one `OptionList`, so
 * a spec finds the menu the same way whatever the control's class prefix.
 */
export const menu = (wrapper: VueWrapper) => wrapper.findComponent(OptionList);

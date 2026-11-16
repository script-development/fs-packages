/** The id of a field's message, which the control names in `aria-describedby`. */
export const messageId = (id: string): string => `${id}-error`;

/** The id of a field's label, which a native element names in `aria-labelledby`. */
export const labelId = (id: string): string => `${id}-label`;

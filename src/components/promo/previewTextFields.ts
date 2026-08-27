/** The three text fields as they appear on the card, in order. */
export const PREVIEW_TEXT_FIELDS = [
  {
    field: 'title' as const,
    placeholder: 'Your headline',
    emptyClassName: 'text-xl font-semibold',
    marginClassName: 'mb-1',
    defaultAlign: 'center' as const,
  },
  {
    field: 'subtitle' as const,
    placeholder: 'A supporting line',
    emptyClassName: 'text-sm font-medium',
    marginClassName: 'mb-2',
    defaultAlign: 'center' as const,
  },
  {
    field: 'description' as const,
    placeholder: 'A little more about the offer',
    emptyClassName: 'text-xs',
    marginClassName: 'mb-2',
    defaultAlign: 'left' as const,
  },
];

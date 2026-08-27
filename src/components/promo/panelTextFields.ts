/**
 * The panel's three text fields, in order. Only the wording differs between
 * them; everything else is PromoTextField.
 */
export const PANEL_TEXT_FIELDS = [
  {
    field: 'title' as const,
    label: 'Title',
    placeholder: 'Your headline',
    info: 'Titles work best as a single line — marketing best practice. Adjust font size or shorten text to fit.',
    className: '!mt-6',
    headerClassName: '!mt-0 flex items-center justify-between',
  },
  {
    field: 'subtitle' as const,
    label: 'Subtitle',
    placeholder: 'A supporting line',
    info: 'Subtitles are optimised for 2 lines for better engagement. Adjust font size or styling to fit.',
    className: undefined,
    headerClassName: undefined,
  },
  {
    field: 'description' as const,
    label: 'Description',
    placeholder: 'A little more about the offer',
    info: 'Descriptions are capped at 3 lines for readability. Adjust font size or styling to fit your message.',
    className: undefined,
    headerClassName: undefined,
  },
];

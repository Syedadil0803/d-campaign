# Requirements Document: Announcement List Table Layout Redesign

## Introduction

The AnnouncementListPanel currently displays announcements using a chip/pill layout with horizontal wrapping. This feature converts the layout to a table-based structure with column headers (Order, Message, Status, Timing, Menu) to improve readability and usability. The redesign maintains all existing functionality including drag-and-drop reordering, message selection, menu actions, and deletion, while presenting information in a more scannable format organized by Live and Scheduled sections with scroll support.

## Glossary

- **AnnouncementListPanel**: The container component displaying the list of announcements in a table format.
- **Live Messages**: Announcements currently active (state: "current" or "openEndedCurrent").
- **Scheduled Messages**: Announcements scheduled to start in the future (state: "future" or "openEndedFuture").
- **Drag Handle**: The reordering affordance (≡ icon) in the first column, visually indicating drag capability.
- **Status Column**: Column displaying the live/scheduled status with color coding (emerald for live, amber for scheduled).
- **Timing Column**: Column displaying schedule information (start/end dates, active indicators, open-ended notes).
- **Message Column**: Column displaying truncated message text with full text available in tooltip.
- **Menu Button**: The three-dot (⋮) action menu button in the final column.
- **Row Visibility Threshold**: Maximum of 3 rows displayed per section before scrolling is required.
- **Section Header**: Subheading labeling "Live Messages" or "Scheduled Messages" section.

## Requirements

### Requirement 1: Table Structure with Five Columns

**User Story:** As a user, I want messages presented in a structured table format with clear column headers, so that I can quickly scan and understand message information at a glance.

#### Acceptance Criteria

1. THE AnnouncementListPanel SHALL render announcements in a table structure with exactly five columns: Order, Message, Status, Timing, and Menu.
2. WHILE rendering the table, THE AnnouncementListPanel SHALL display column headers at the top of each section (Live Messages and Scheduled Messages) with bold, uppercase text.
3. THE table SHALL use plain backgrounds with no zebra striping (alternating row colors).
4. THE AnnouncementListPanel SHALL apply consistent column widths across all rows within a section.
5. THE column widths SHALL be proportional to content needs: Order (small fixed width), Message (40% flexible), Status (15% flexible), Timing (25% flexible), Menu (small fixed width).

### Requirement 2: Drag Handle in First Column

**User Story:** As a user, I want a clear visual affordance indicating which column supports drag-and-drop reordering, so that I know I can drag rows to reorder messages.

#### Acceptance Criteria

1. THE Order column (first column) SHALL display a drag handle icon (≡) at the start of each row.
2. THE drag handle SHALL be positioned consistently within the column and remain visible at all times.
3. WHEN the user hovers over a row, THE drag handle SHALL remain visible and NOT fade or hide.
4. THE drag handle icon SHALL use the same visual styling as status icons (12px height, inherit text color from row).
5. WHILE dragging, THE drag handle row SHALL show reduced opacity (60%) to indicate it is being moved.

### Requirement 3: Live Messages Section

**User Story:** As a user managing multiple announcement states, I want currently active messages grouped in a "Live Messages" section at the top, so that I can focus on active content first.

#### Acceptance Criteria

1. WHEN there are announcements with schedule state "current" or "openEndedCurrent", THE AnnouncementListPanel SHALL display a "Live Messages" section above the Scheduled Messages section.
2. THE "Live Messages" section header SHALL display in bold, uppercase text with the label "LIVE MESSAGES".
3. THE Live Messages section SHALL display a maximum of 3 rows visible without scrolling.
4. IF the Live Messages section contains more than 3 rows, THE section container SHALL enable vertical scrolling with a stable scrollbar gutter.
5. WHILE Live Messages section is present, THE section background SHALL remain plain (no zebra striping) with consistent row height.
6. THE live status indicator (emerald-colored) SHALL appear in the Status column for each live message.

### Requirement 4: Scheduled Messages Section

**User Story:** As a user planning future announcements, I want future messages grouped in a "Scheduled Messages" section below the Live section, so that I can see my planned content separately.

#### Acceptance Criteria

1. WHEN there are announcements with schedule state "future" or "openEndedFuture", THE AnnouncementListPanel SHALL display a "Scheduled Messages" section below the Live Messages section.
2. THE "Scheduled Messages" section header SHALL display in bold, uppercase text with the label "SCHEDULED MESSAGES".
3. THE Scheduled Messages section SHALL display a maximum of 3 rows visible without scrolling.
4. IF the Scheduled Messages section contains more than 3 rows, THE section container SHALL enable vertical scrolling with a stable scrollbar gutter.
5. WHILE Scheduled Messages section is present, THE section background SHALL remain plain (no zebra striping) with consistent row height.
6. THE scheduled status indicator (amber-colored) SHALL appear in the Status column for each scheduled message.

### Requirement 5: Message Column Content and Truncation

**User Story:** As a user, I want to see the announcement message text in a dedicated column with proper truncation, so that I can preview the content without text overflowing table columns.

#### Acceptance Criteria

1. THE Message column SHALL display the stripped HTML text of each announcement (no HTML tags).
2. THE Message column text SHALL truncate with an ellipsis if the message exceeds the column width (max width ~300px).
3. WHEN the user hovers over the Message column cell, A tooltip SHALL display the full untruncated message text.
4. THE Message column text SHALL use left alignment and inherit the row's text color.
5. THE Message column SHALL have a minimum width that accommodates typical message lengths without excessive overflow.

### Requirement 6: Status Column with Color-Coded Indicators

**User Story:** As a user, I want a clear visual status indicator for each message, so that I can quickly distinguish between live and scheduled announcements.

#### Acceptance Criteria

1. THE Status column SHALL display the schedule state of each announcement using color-coded indicators.
2. WHEN an announcement is live (state: "current" or "openEndedCurrent"), THE Status cell SHALL display an emerald-colored (emerald-500 / emerald-400 dark) active dot indicator.
3. WHEN an announcement is scheduled (state: "future" or "openEndedFuture"), THE Status cell SHALL display an amber-colored (amber-600 / amber-400 dark) clock icon indicator.
4. WHEN an announcement has an invalid schedule (end date before start date), THE Status cell SHALL display a red triangle icon (TriangleAlert) instead of the schedule state indicator.
5. THE Status column indicators SHALL use 12px height icons and remain consistent in style across all rows.
6. THE Status column SHALL use the existing color scheme: emerald for live, amber for scheduled, red for invalid.

### Requirement 7: Timing Column Information Display

**User Story:** As a user, I want to see schedule timing details for each message, so that I understand when each announcement runs or will run.

#### Acceptance Criteria

1. THE Timing column SHALL display schedule information including start date, end date, and open-ended indicators.
2. WHEN an announcement has no end date (state: "openEndedCurrent" or "openEndedFuture"), THE Timing cell SHALL display an infinity icon (∞) indicator alongside or instead of the end date.
3. WHEN an announcement has an invalid schedule, THE Timing cell text SHALL indicate the invalidity or remain empty while the Status column shows the alert icon.
4. THE Timing column SHALL display dates in a human-readable format (e.g., "Mar 15 - Mar 20" or "Mar 15 onwards").
5. THE Timing column SHALL use left alignment and inherit the row's text color.
6. THE Timing column width SHALL accommodate typical date ranges without truncation when possible.

### Requirement 8: Menu Button in Final Column

**User Story:** As a user, I want a consistent menu button location for each announcement, so that I can access edit, duplicate, and delete options without confusion.

#### Acceptance Criteria

1. THE Menu column (final column) SHALL display a three-dot menu button (MoreVertical icon) on each row.
2. THE Menu button SHALL open the existing action menu when clicked, displaying options for edit, duplicate, and delete.
3. WHEN the user hovers over a row, THE Menu button SHALL remain visible and accessible at all times (no conditional hiding).
4. THE Menu button click event SHALL call the existing openActionMenu function with the row index and button element.
5. THE Menu button SHALL remain in the same visual position across all rows for consistency.

### Requirement 9: Drag-and-Drop Reordering Maintained

**User Story:** As a user managing announcement order, I want to drag rows to reorder announcements, so that I can organize messages by importance or timing without using separate dialogs.

#### Acceptance Criteria

1. THE AnnouncementListPanel SHALL preserve the existing drag-and-drop reordering functionality from the chip layout.
2. WHEN a user drags a row, THE dragged row SHALL show reduced opacity (60%) to indicate movement.
3. WHEN a user drops a row on another row, THE announcements SHALL reorder according to the drop target position.
4. WHEN a user drags within a section (Live or Scheduled), THE drop target SHALL accept the drag and reorder within that section.
5. WHEN a user starts dragging, THE drag handle icon SHALL indicate the drag is active (via opacity change on the row).
6. THE drag-and-drop functionality SHALL NOT prevent the user from accessing the menu button or selecting the row.

### Requirement 10: Row Selection and Editor Integration

**User Story:** As a user editing announcements, I want to click a row to load it into the editor, so that I can make changes without opening a separate edit dialog.

#### Acceptance Criteria

1. WHEN the user clicks a row, THE announcement text SHALL load into the rich editor (via loadAnnouncementIntoSelection).
2. WHEN the user clicks the same row again (when already selected), THE selection SHALL clear (via clearSelection).
3. WHEN a row is selected, THE row styling SHALL reflect the selection state (existing border and background changes).
4. THE click event SHALL NOT trigger menu opening or other unintended actions.
5. THE row click functionality SHALL remain unchanged from the current chip layout behavior.

### Requirement 11: Color Scheme Consistency with Existing Styles

**User Story:** As a maintainer, I want the table layout to reuse the existing color scheme and design tokens, so that the redesign remains consistent with the current visual system.

#### Acceptance Criteria

1. THE live status indicator SHALL use emerald colors (emerald-500 / emerald-400 dark) consistent with current usage.
2. THE scheduled status indicator SHALL use amber colors (amber-600 / amber-400 dark) consistent with current usage.
3. THE invalid state indicator SHALL use red colors (red-600 / red-400 dark) for error alerts.
4. THE row background SHALL use the existing primary color scheme (primary/20 background) without modification.
5. THE text colors SHALL inherit from the component's existing dark mode styles (text-[#5a4138] / dark:text-[#dbc1b3]).
6. THE table SHALL NOT introduce new colors or design tokens outside the existing palette.

### Requirement 12: Scroll Behavior and Container Constraints

**User Story:** As a user viewing many announcements, I want scroll support for sections with more than 3 rows, so that I can navigate the full list without losing the header context.

#### Acceptance Criteria

1. THE Live Messages section container SHALL have a fixed visible height accommodating exactly 3 rows plus the section header.
2. THE Scheduled Messages section container SHALL have a fixed visible height accommodating exactly 3 rows plus the section header.
3. WHEN a section exceeds 3 rows, THE scrollbar SHALL appear on the right edge with stable gutter (scrollbarGutter: 'stable').
4. THE scrollbar styling SHALL use the existing campaign-custom-scrollbar class for visual consistency.
5. THE parent AnnouncementListPanel container height SHALL remain 320px total (unchanged from current design).
6. THE scroll behavior within each section SHALL NOT affect the other section's visibility or scroll position.

### Requirement 13: Empty State and No Announcements

**User Story:** As a user with no announcements, I want a clear empty state message, so that I understand the panel is ready for new content.

#### Acceptance Criteria

1. WHEN there are no announcements in the list, THE AnnouncementListPanel SHALL display an empty state message: "Added text from the left input box will be displayed here".
2. THE empty state SHALL be centered within the 120px visible area (unchanged from current design).
3. THE empty state message SHALL NOT display table headers or column structure.
4. WHEN the first announcement is added, THE empty state SHALL immediately disappear and the appropriate section (Live or Scheduled) SHALL appear.

### Requirement 14: Status and Timing Icons Consistency

**User Story:** As a designer, I want consistent icon sizing and styling across all table cells, so that the visual presentation remains balanced and professional.

#### Acceptance Criteria

1. ALL status and timing icons (ActiveDot, Clock, InfinityIcon, TriangleAlert) SHALL use 12px height consistently.
2. ALL icons SHALL inherit the text color from their row (no independent color overrides except for their semantic colors: emerald, amber, red).
3. THE icon spacing relative to text in each cell SHALL remain consistent (6px gap) across all columns.
4. THE icon vertical alignment SHALL be centered relative to the row text baseline.

### Requirement 15: Menu Action Preservation

**User Story:** As a user managing announcements, I want all existing menu actions (edit, duplicate, delete) to remain available, so that the table redesign doesn't remove functionality.

#### Acceptance Criteria

1. THE Menu button SHALL invoke the existing openActionMenu function without modification to its behavior or parameters.
2. WHEN the user clicks the Menu button, THE action menu popup SHALL display and position relative to the button element.
3. THE delete action from the menu SHALL trigger the confirmation dialog (existing behavior maintained).
4. THE duplicate action from the menu SHALL create a new announcement copy (existing behavior maintained).
5. THE edit action from the menu SHALL load the announcement into selection mode (existing behavior maintained).

### Requirement 16: Header and Toolbar Preservation

**User Story:** As a user, I want the section header, title, and toolbar elements to remain unchanged, so that the redesign focuses only on the message list display.

#### Acceptance Criteria

1. THE "Manage Announcements" title and description SHALL remain at the top of the panel (unchanged).
2. THE message count display (e.g., "Message List (5)") SHALL remain in the toolbar.
3. THE "Clear All" button and inline confirmation SHALL remain in the toolbar (unchanged).
4. THE status legend (Invalid, No End Date, Starts Later, Active Now) SHALL remain in the toolbar (unchanged).
5. THE divider line between header and content SHALL remain in place (unchanged).


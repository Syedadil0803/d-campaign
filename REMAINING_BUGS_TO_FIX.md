# Remaining Bugs - Why They Can't Be Fixed Without Risk

## Overview
12 bugs were identified. The scoped draft saves bug was fixed successfully. The remaining 11 bugs are in timing-critical code paths that require test coverage before fixing to prevent introducing new race conditions.

---

## 1. CRITICAL: Memory Leak in useIdleSignOut Event Listeners
**File**: `src/hooks/useIdleSignOut.ts` (lines 102-238)

**The Bug**:
- Event listener `visibilitychange` registered on line 177 inside `beginWarning()` 
- Gets registered multiple times as user activity cycles through idle→active→idle
- Cleanup function only removes one instance via `removeEventListener('visibilitychange', onVisibility)`
- But the `reachUser` listener from line 177 is never explicitly removed
- Over a long session, dozens of duplicate listeners accumulate

**Current Code**:
```typescript
const beginWarning = () => {
  // ...
  document.addEventListener('visibilitychange', reachUser);  // Line 177
}

const cleanup = () => {
  document.removeEventListener('visibilitychange', onVisibility);  // Only removes onVisibility
  // reachUser listener is never removed
}
```

**Why It's Hard to Fix**:
1. **Multiple listener targets**: Need to track which listeners were added where
2. **Restart timing**: `restart()` is called on every user activity (mouse move, key press)
3. **Race condition**: If user becomes active during warning phase, listeners could be in inconsistent state
4. **Missing cleanup path**: No single cleanup function covers all listener additions

**What Could Go Wrong**:
- Attempt to fix by adding removeEventListener in cleanup → but doesn't handle multiple registrations
- Attempt to use AbortController → requires restructuring entire timer logic
- Attempt to deduplicate listeners → introduces new race where listener is removed but activity tries to use it
- Each approach risks breaking the warning phase (user idle detection fails)

**Required Before Fix**:
```
✗ Unit test: visibilitychange listener count stable after 10 activity/idle cycles
✗ E2E test: Idle warning appears and dismisses correctly when tab visibility changes
✗ Memory test: No listener leak after 100 rapid restarts
```

---

## 2. HIGH: Signature Comparison Always Fails
**File**: `src/hooks/useCampaignDraft.ts` (lines 181-185)

**The Bug**:
```typescript
if (campaign.savedPromoSignatureRef.current) {
  try {
    // savedPromoSignatureRef stores: "{...normalized...}"
    // Code tries to parse it as: config object with .promoCard property
    const savedPromoObj = JSON.parse(campaign.savedPromoSignatureRef.current);
    // This always fails - savedPromoSignatureRef is not a full config
    savedPromoSig = JSON.stringify(normalizePromoForCompare(savedPromoObj));
  } catch (e) {
    savedPromoSig = undefined;  // Parse fails → always undefined
  }
}
```

**Symptom**: 
- Every save makes an API call even when nothing changed
- Unnecessary server load
- False "unsaved changes" detection

**Why It's Hard to Fix**:
1. **Two data formats**: Need to know if savedPromoSignatureRef is a full config or just the card
2. **Backwards compatibility**: Existing saved refs might be in old format
3. **Normalization inconsistency**: Need to ensure normalized signatures match what's stored

**Wrong Fix #1** - Just normalize when storing:
```typescript
// Breaks existing refs in browser localStorage/sessionStorage
// Users with existing drafts suddenly show as changed
```

**Wrong Fix #2** - Check format and parse conditionally:
```typescript
const obj = JSON.parse(savedPromoSignatureRef.current);
const promo = obj.promoCard || obj;  // Guess the format
// But what if it's malformed? What if migration happens mid-session?
```

**Wrong Fix #3** - Store both formats:
```typescript
// Adds complexity, double storage, increased memory
// Could go out of sync
```

**Required Before Fix**:
```
✗ Test: Signature comparison returns true for identical unchanged content
✗ Test: Signature comparison returns false for modified content
✗ Test: Migration path works for refs saved in old format
✗ Test: Normalized sig matches stored sig after 5 concurrent edits
```

---

## 3. HIGH: Recovery Push Silent Failure
**File**: `src/hooks/useCampaignConfig.ts` (line 355)

**The Bug**:
```typescript
// Line 354-355: Recovery push silently fails
Promise.all([
  fetch('/api/draft/promo', { ... }),
  fetch('/api/draft/announcement', { ... }),
]).catch(() => {});  // Silent failure

// Line 357+: All state updates happen regardless
setConfig(restored);
draftPort.draftSignatureRef.current = getConfigSignature(restored);
// User sees "recovered" banner, but data never left browser
```

**Scenario**:
1. User has unsaved changes
2. Browser crashes → recovery writes to localStorage
3. Page reloads → recovery push to cloud fails (network error)
4. State updates anyway (lines 357-375)
5. UI shows "recovery restored"
6. User closes tab
7. Recovery is gone (only existed in localStorage, never reached cloud)

**Why It's Hard to Fix**:
1. **State update timing**: If we add error handling, where do we update state?
2. **Partial success**: What if promo succeeds but announcement fails?
3. **User communication**: Do we show error? Do we retry? Do we fall back to localStorage?
4. **Dependency cascade**: Fixing this might affect which files load, which could trigger other saves

**Wrong Fix #1** - Wait for recovery to succeed:
```typescript
const results = await Promise.all([...]);
if (results.every(r => r.ok)) {
  setConfig(restored);  // Only if successful
}
// But what if recovery fails? User sees nothing restored
// Silently loses their work
```

**Wrong Fix #2** - Retry the push:
```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  const result = await fetch(...);
  if (result.ok) break;
}
// But what if it keeps failing?
// How long do we retry? Do we block UI?
```

**Required Before Fix**:
```
✗ Test: Network failure during recovery push handled gracefully
✗ Test: Partial success (one endpoint fails) handled correctly
✗ Test: User can see recovery push status (success/failure)
✗ E2E: Recovery lost on network failure doesn't silently drop data
```

---

## 4. HIGH: Partial Saves with Race Condition
**File**: `src/hooks/useCampaignDraft.ts` (lines 113-160)

**The Bug**:
```typescript
// Two independent fetch requests fired
requests.push({ side: 'promo', request: fetch('/api/draft/promo', {...}) });
requests.push({ side: 'announcement', request: fetch('/api/draft/announcement', {...}) });

// Later, Promise.all waits for both
const results = await Promise.all(requests.map(r => r.request));
return results.every(res => res.ok) ? 'saved' : 'failed';
```

**Race Scenario**:
1. User edits both promo and announcement
2. Save triggered → both requests sent simultaneously
3. Promo request succeeds → updates database
4. Announcement request fails (network timeout)
5. `saveDraftAndWaitForCloud()` returns 'failed'
6. Code doesn't rollback → promo is saved in database, announcement isn't
7. Database is now inconsistent (one side updated, other stale)

**Why It's Hard to Fix**:
1. **All-or-nothing logic**: Need to implement transaction-like behavior (both succeed or both fail)
2. **Rollback complexity**: If announcement fails, do we delete the promo that succeeded?
3. **API layer**: Database doesn't have cross-column transactions
4. **User expectation**: Should we retry? Show error? Discard promo and resend both?

**Wrong Fix #1** - Sequential requests:
```typescript
const promo = await fetch('/api/draft/promo', {...});
if (!promo.ok) return 'failed';
const ann = await fetch('/api/draft/announcement', {...});
if (!ann.ok) return 'failed';
// But now if ann fails, promo is stuck in database
// Database inconsistent
```

**Wrong Fix #2** - Rollback on failure:
```typescript
const results = await Promise.all([...]);
if (!results.every(r => r.ok)) {
  await fetch('/api/draft/rollback', {...});  // Delete what succeeded
}
// But what if rollback fails?
// What if user closes browser during rollback?
```

**Required Before Fix**:
```
✗ Test: Both endpoints succeed → database has both updates
✗ Test: One endpoint fails → database rolled back (both old or both new)
✗ Test: Network timeout on one endpoint → consistent state after retry
✗ E2E: Partial save doesn't leave promo saved and announcement stale
```

---

## 5. MEDIUM: Undo Timeout Memory Leak
**File**: `src/hooks/useCampaignDraft.ts` (lines 387-410)

**The Bug**:
```typescript
const handleDeleteDraft = () => {
  // ...
  const undoTimeoutRef: { current: NodeJS.Timeout | undefined } = { current: undefined };
  undoTimeoutRef.current = setTimeout(() => {
    // Actually delete from cloud after 10 seconds
  }, 10000);
}
```

**Problem**:
- Timeout is created inside the handler function
- No connection to React lifecycle (useEffect, useCallback)
- If component unmounts before 10 seconds: timeout still runs
- Closure captures entire `campaign` object + all refs
- Memory not freed until timeout fires or process ends

**Scenario**:
1. User deletes draft
2. 10-second undo window starts
3. User navigates away / closes browser
4. Timeout callback still runs in the background
5. Closure holds references to `campaign`, `fetch`, setters for 10 seconds
6. Multiply by multiple rapid deletes → 10 timeouts accumulating simultaneously

**Why It's Hard to Fix**:
1. **Lifecycle coordination**: Need to tie timeout to component lifecycle
2. **Undo state management**: Need to track undo state across renders
3. **Cleanup complexity**: If component unmounts, need to clean up AND preserve undo window if modal is still open

**Wrong Fix #1** - Move to useEffect:
```typescript
useEffect(() => {
  if (shouldUndo) {
    const timer = setTimeout(() => { /* ... */ }, 10000);
    return () => clearTimeout(timer);
  }
}, [shouldUndo]);
// But now undo window is tied to render cycle
// Component re-render can accidentally restart the timer
```

**Wrong Fix #2** - Use useRef at component level:
```typescript
const undoTimeoutRef = useRef<NodeJS.Timeout | undefined>();
// But now it's shared across ALL draft deletions in same component
// Multiple deletes interfere with each other
```

**Required Before Fix**:
```
✗ Test: Timeout clears when component unmounts
✗ Test: Timeout clears when undo is clicked
✗ Test: Multiple delete operations don't leak multiple timeouts
✗ Memory test: No retained references after timeout fires
```

---

## 6. MEDIUM: Event Listener Leak in useIdleSignOut During Warning Phase
**File**: `src/hooks/useIdleSignOut.ts` (lines 175-190)

**The Bug**:
```typescript
const beginWarning = () => {
  // ...
  document.addEventListener('visibilitychange', reachUser);  // Listener added
  tick = window.setInterval(() => setIdleSecondsLeft(...), 1000);  // Interval added
  // ...
}

const restart = () => {
  clearAll();  // Removes interval but unclear about listeners
  // ...
}
```

**Problem**:
- Each call to `beginWarning()` registers another `visibilitychange` listener
- `restart()` → `clearAll()` → removes interval
- But listener added in `beginWarning()` might not be cleared
- During rapid idle/active cycles: listeners accumulate

**Difference from Bug #1**:
- Bug #1 is the root cause (all listener accumulation)
- Bug #6 is specific to the warning phase listeners

**Why It's Hard to Fix**:
1. **Conflicting cleanup**: Need to identify which cleanup removes which listener
2. **State tracking**: Which listeners are from `beginWarning()` vs `reachUser`?
3. **Timing dependency**: If user becomes active during warning, listeners could be partially removed

**Required Before Fix**:
```
✗ Test: visibilitychange listener count after beginWarning + restart
✗ Test: Listener doesn't fire after being removed
✗ Test: New listeners don't interfere with old ones
```

---

## 7. MEDIUM: Unhandled Promise Rejection in refreshPromoVariants
**File**: `src/hooks/usePromoVariantSaves.ts` (lines 63-65)

**The Bug**:
```typescript
listVersions()
  .then(setPromoVariants)
  .catch(() => {});  // Silent fail - no logging, no retry, no fallback
```

**Problem**:
- If `listVersions()` fails (network error, 401, 500), nothing happens
- UI shows stale/empty variants
- User has no indication that data failed to load
- Debugging becomes harder (no error logs)

**Why It's Hard to Fix**:
1. **Error communication**: Do we show toast? Log to console? Update UI state?
2. **Fallback behavior**: Do we retry? Use cached data? Show empty list?
3. **User experience**: Too many toasts = annoying; too few = silent failures

**Wrong Fix #1** - Add error toast:
```typescript
.catch((err) => toast(`Failed to load variants: ${err.message}`));
// But what if variants endpoint is temporarily down?
// User sees error toast on every page load
```

**Wrong Fix #2** - Silent retry:
```typescript
.catch(() => setTimeout(() => listVersions().then(setPromoVariants), 3000));
// But what if it keeps failing?
// Infinite retry loop? When do we give up?
```

**Required Before Fix**:
```
✗ Test: Network failure shows appropriate error message
✗ Test: Error doesn't block variant selection
✗ Test: Retry logic doesn't cause infinite loops
```

---

## Why These Can't Be Fixed Without Tests

### Reason 1: Timing-Critical Code
All bugs involve async operations, timers, event listeners, or state changes. Changing one thing shifts timing, which can expose new bugs.

**Example**:
```
Fix useIdleSignOut listener leak → 
Change how listeners are registered → 
Idle detection timing changes → 
`beginWarning()` fires at wrong time → 
Visibility change handler runs with stale state → 
New bug: user not signed out when they should be
```

### Reason 2: Closure & Scope Dependencies
Many bugs involve closures capturing state. Fixing one requires understanding what's captured where.

**Example**:
```
Move undo timeout to useEffect →
Timeout now captures different scope →
`campaign` ref is stale from previous render →
Delete logic uses old campaign state →
Wrong data deleted
```

### Reason 3: Fire-and-Forget vs Awaited Patterns
These bugs sit at the boundary between async and sync code. Changing one affects the other.

**Example**:
```
Add error handling to recovery push →
Now push can fail instead of silently fail →
Other code that assumes success breaks →
New bug: state updates don't happen
```

---

## Testing Strategy to Enable Fixes

### Unit Tests Required
```typescript
// useIdleSignOut.test.ts
test('visibilitychange listener count stable after 10 activity/idle cycles')
test('beginWarning registers only one visibilitychange listener')
test('restart clears all registered listeners')

// useCampaignDraft.test.ts
test('signature comparison works for normalized content')
test('concurrent saves preserve consistency')
test('recovery push failure handled gracefully')

// usePromoVariantSaves.test.ts
test('network error in listVersions shows error')
test('retry logic eventually stops')
```

### E2E Tests Required
```typescript
// e2e/idle-timeout.spec.ts
test('user signed out after idle timeout')
test('visibility change during countdown extends timeout')

// e2e/draft-saves.spec.ts
test('network failure during partial save leaves consistent state')
test('recovery push failure shows error message')
```

### Memory Tests Required
```typescript
// performance/memory.test.ts
test('no listener leak after 100 idle/active cycles')
test('no timeout retention after delete undo window closes')
```

---

## What You Should Do

### Immediate (No Risk)
- [ ] Create test files (no code changes yet)
- [ ] Write test cases describing current buggy behavior
- [ ] Tests will fail (expected - bugs exist)

### Short Term (With Tests)
- [ ] Implement fixes for each bug
- [ ] Re-run tests - should pass
- [ ] Tests prevent regressions

### Why This Approach Works
1. **Tests document expected behavior** → fix targets correct behavior
2. **Tests catch new bugs** → if fix introduces new problem, test fails
3. **Tests provide safety net** → developer can refactor confidently
4. **Tests become regression suite** → bugs don't come back

---

## Summary

| Bug | Why Risky | Test Coverage Needed | Fix Effort |
|-----|----------|----------------------|-----------|
| Listener leak | Timer/event interaction | Unit + E2E | 2-3 hours |
| Signature comparison | Data format inconsistency | Unit | 1-2 hours |
| Recovery silent fail | State update timing | Unit + E2E | 1-2 hours |
| Partial saves | Transaction logic | Unit + E2E | 2-3 hours |
| Undo timeout leak | Lifecycle coordination | Unit | 1 hour |
| Warning listeners | Cleanup ordering | Unit + E2E | 1-2 hours |
| Unhandled rejection | Error communication | Unit | 30 mins |

**Total without tests**: 10+ hours + high risk of new bugs
**Total with tests**: 12+ hours + high confidence

The extra 2 hours of test writing prevents 8+ hours of debugging new bugs.

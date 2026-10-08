'use client';

import type { ComponentProps } from 'react';
import {
  IdleCountdownDialog,
  NotificationsPromptDialog,
} from '@/components/shell/SessionDialogs';
import {
  PostPublishDraftDialog,
  WelcomeBackDialog,
  DiscardDraftDialog,
  ReplaceDraftDialog,
} from '@/components/shell/DraftDialogs';
import {
  UnsavedWorkDialog,
  VariantSlotFullDialog,
  PublishConfirmDialog,
  DashboardUnsavedDialog,
} from '@/components/shell/UnsavedWorkDialogs';

/**
 * Every prop is the dialog's own, so the types are read off the dialogs rather
 * than restated — a dialog changing its props changes this with it.
 */
type PageDialogsProps = ComponentProps<typeof PostPublishDraftDialog> &
  ComponentProps<typeof WelcomeBackDialog> &
  ComponentProps<typeof IdleCountdownDialog> &
  ComponentProps<typeof NotificationsPromptDialog> &
  ComponentProps<typeof UnsavedWorkDialog> &
  ComponentProps<typeof VariantSlotFullDialog> &
  ComponentProps<typeof PublishConfirmDialog> &
  ComponentProps<typeof DashboardUnsavedDialog> &
  ComponentProps<typeof DiscardDraftDialog> &
  ComponentProps<typeof ReplaceDraftDialog>;

/**
 * The page's dialogs, in the order the page always rendered them.
 *
 * Order is load-bearing: they are siblings at the end of the page, and when
 * two are up at once the later one paints on top. Lifted out whole so the
 * page keeps its state and handlers while this keeps the markup — it owns no
 * state of its own and decides nothing.
 */
export function PageDialogs({
  postPublishDraft,
  setPostPublishDraft,
  clearDraft,
  toast,
  welcomeBack,
  draftOffer,
  editorWorkAtRisk,
  acceptOfferedDraft,
  dismissWelcomeBack,
  idleSecondsLeft,
  idleRestartRef,
  askNotifications,
  setAskNotifications,
  pendingDraftAction,
  savedDraftSignature,
  setPendingDraftAction,
  saveDraftAndContinue,
  continueWithoutDraft,
  pendingVariantSave,
  selectedPendingVariant,
  savePendingVariantAndClose,
  updateExistingVariantAndClose,
  cancelPendingVariantSave,
  publishConfirm,
  isConfirming,
  setIsConfirming,
  setIsPublishing,
  setPublishConfirm,
  pendingDashboardAction,
  setPendingDashboardAction,
  writeDraftNow,
  startCreatePromo,
  openPublishedPicker,
  confirmDiscardDraft,
  setConfirmDiscardDraft,
  discardDraft,
  confirmReplaceDraft,
  setConfirmReplaceDraft,
}: PageDialogsProps) {
  return (
    <>
      {/* A draft outlived a publish and holds something else. Asked rather
          than assumed: it is the user's copy, and only they know whether the
          card they just put live replaced it or was never related to it. */}
      <PostPublishDraftDialog
        postPublishDraft={postPublishDraft}
        setPostPublishDraft={setPostPublishDraft}
        clearDraft={clearDraft}
        toast={toast}
      />

      {/* One dialog for one moment.
          Coming back to work in progress has three shapes — edits rescued from
          a session that ended, those edits alongside a parked draft, or a
          draft on its own — and they were being told by two different dialogs
          with two different voices. They describe the same situation from
          different angles, so they are one thing that reads its state.
          Held until the promo tab: it talks about the canvas and My Draft,
          which are that editor's. Announcement work is still restored, just
          not announced here — this message has nowhere to say it. */}
      <WelcomeBackDialog
        welcomeBack={welcomeBack}
        draftOffer={draftOffer}
        editorWorkAtRisk={editorWorkAtRisk}
        acceptOfferedDraft={acceptOfferedDraft}
        dismissWelcomeBack={dismissWelcomeBack}
      />

      {/* The countdown.
          Always a dialog in the page, because that is the only warning
          everyone gets — permission may never have been granted, and a desktop
          notification is suppressed while the tab is visible anyway. It blocks
          the editor on purpose: the point is to be answered. */}
      <IdleCountdownDialog
        idleSecondsLeft={idleSecondsLeft}
        idleRestartRef={idleRestartRef}
      />

      {/* Our ask, in front of the browser's.
          The browser's own prompt is a one-shot: decline it and no code can
          raise it again. So "Not now" closes only this, and the real prompt is
          reached solely by someone who chose Allow.

          A corner card rather than a modal. This is an offer, not a decision
          the editor should be held up for — a full dialog gave a small
          convenience the same weight as losing work, and it was the first
          thing people met on the way in. */}
      <NotificationsPromptDialog
        askNotifications={askNotifications}
        setAskNotifications={setAskNotifications}
        welcomeBack={welcomeBack}
        idleSecondsLeft={idleSecondsLeft}
      />

      <UnsavedWorkDialog
        pendingDraftAction={pendingDraftAction}
        savedDraftSignature={savedDraftSignature}
        setPendingDraftAction={setPendingDraftAction}
        saveDraftAndContinue={saveDraftAndContinue}
        continueWithoutDraft={continueWithoutDraft}
      />

      <VariantSlotFullDialog
        pendingVariantSave={pendingVariantSave}
        selectedPendingVariant={selectedPendingVariant}
        savePendingVariantAndClose={savePendingVariantAndClose}
        updateExistingVariantAndClose={updateExistingVariantAndClose}
        cancelPendingVariantSave={cancelPendingVariantSave}
      />

      {/* No "welcome back" popup. Saving a draft is a deliberate act, so
          announcing it back on every load interrupts the one moment someone
          wants to start working. The draft is restored into the editor
          silently and the My Draft chip carries a dot instead. */}

      {/* Publish Confirmation */}
      <PublishConfirmDialog
        publishConfirm={publishConfirm}
        isConfirming={isConfirming}
        setIsConfirming={setIsConfirming}
        setIsPublishing={setIsPublishing}
        setPublishConfirm={setPublishConfirm}
      />

      {/* First-run campaign setup, opened from the dashboard's "Create promo
          card". Same dialog the guided flow uses, so the questions asked are
          identical wherever a campaign starts. */}
      {/* HIDDEN: Set up your campaign
      {setup.visible && (
        <PromoSetupDialog
          sourceLabel="a blank card"
          scheduleOnly
          onContinue={startNewPromo}
          startDate={setup.startDate}
          endDate={setup.endDate}
          scheduleMode={setup.mode}
          onChangeMode={setup.setMode}
          onChangeStart={setup.setStartDate}
          onChangeEnd={setup.setEndDate}
          onChoose={() => startNewPromo()}
          onClose={() => setup.setVisible(false)}
        />
      )}
      */}

      {/* Unsaved promo work, caught at the dashboard before an action that
          would replace the canvas. Saving is offered, never required — the
          same rule as Clear Canvas. */}
      <DashboardUnsavedDialog
        pendingDashboardAction={pendingDashboardAction}
        savedDraftSignature={savedDraftSignature}
        setPendingDashboardAction={setPendingDashboardAction}
        writeDraftNow={writeDraftNow}
        startCreatePromo={startCreatePromo}
        openPublishedPicker={openPublishedPicker}
      />

      {/* Discard Draft consent — deleting a draft is destructive, so confirm first */}
      <DiscardDraftDialog
        confirmDiscardDraft={confirmDiscardDraft}
        setConfirmDiscardDraft={setConfirmDiscardDraft}
        discardDraft={discardDraft}
      />

      {/* Replace-draft consent — there's only one draft slot, so saving again
          overwrites whatever's already there. */}
      <ReplaceDraftDialog
        confirmReplaceDraft={confirmReplaceDraft}
        setConfirmReplaceDraft={setConfirmReplaceDraft}
        writeDraftNow={writeDraftNow}
      />
    </>
  );
}

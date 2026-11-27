// Copyright (c) 2026. All rights reserved.

import { describe, it, expect } from 'vitest';
import {
  conversationReducer,
  createInitialConversationState,
} from '../conversationReducer';
import { ConversationMessage } from '../../types/conversation';

function makeSpeakerMsg(id: string, text: string): ConversationMessage {
  return {
    id,
    role: 'hearing',
    text,
    timestamp: 1000,
    language: 'en-IN',
  };
}

describe('conversationReducer', () => {
  it('creates expected initial state', () => {
    const state = createInitialConversationState('en-IN', 'cloud-auto');
    expect(state.phase).toBe('idle');
    expect(state.connectionState).toBe('idle');
    expect(state.ttsEchoGuardActive).toBe(false);
    expect(state.messages).toEqual([]);
    expect(state.activeProviderLabel).toBe('Cloud Proxy (Auto)');
  });

  it('transitions idle -> starting -> listening -> paused -> listening -> ended', () => {
    let state = createInitialConversationState('en-IN', 'browser-fallback');

    state = conversationReducer(state, {
      type: 'SESSION_START_REQUESTED',
      sessionId: 'sess-1',
      language: 'en-IN',
      providerMode: 'browser-fallback',
      providerLabel: 'Browser Speech Fallback',
    });
    expect(state.phase).toBe('starting');
    expect(state.connectionState).toBe('connecting');

    state = conversationReducer(state, {
      type: 'CONNECTION_STATE_CHANGED',
      connectionState: 'connected',
    });
    expect(state.phase).toBe('listening');
    expect(state.connectionState).toBe('connected');

    state = conversationReducer(state, { type: 'SESSION_PAUSED_BY_USER' });
    expect(state.phase).toBe('paused');
    expect(state.connectionState).toBe('paused');

    state = conversationReducer(state, { type: 'SESSION_RESUMED_BY_USER' });
    expect(state.phase).toBe('listening');
    expect(state.connectionState).toBe('connected');

    state = conversationReducer(state, {
      type: 'FINAL_CAPTION_RECEIVED',
      message: makeSpeakerMsg('m1', 'Hello there'),
    });
    expect(state.messages).toHaveLength(1);

    state = conversationReducer(state, { type: 'SESSION_STOPPED' });
    expect(state.phase).toBe('ended');
    expect(state.connectionState).toBe('idle');
    expect(state.livePartialCaption).toBe('');
  });

  it('activates TTS echo guard during listening and drops late partial/final captions', () => {
    let state = createInitialConversationState('en-IN', 'cloud-auto');
    state = conversationReducer(state, {
      type: 'CONNECTION_STATE_CHANGED',
      connectionState: 'connected',
    });
    state = conversationReducer(state, {
      type: 'PARTIAL_CAPTION_RECEIVED',
      text: 'Incoming speech...',
    });
    expect(state.livePartialCaption).toBe('Incoming speech...');

    state = conversationReducer(state, { type: 'TTS_PLAYBACK_STARTED' });
    expect(state.phase).toBe('speaking_tts');
    expect(state.isSpeakingTts).toBe(true);
    expect(state.ttsEchoGuardActive).toBe(true);
    expect(state.phaseBeforeTts).toBe('listening');
    expect(state.livePartialCaption).toBe('');

    // Late captions arriving during TTS must be discarded
    state = conversationReducer(state, {
      type: 'PARTIAL_CAPTION_RECEIVED',
      text: 'Echoed TTS audio',
    });
    expect(state.livePartialCaption).toBe('');

    state = conversationReducer(state, {
      type: 'FINAL_CAPTION_RECEIVED',
      message: makeSpeakerMsg('echo-1', 'Echoed TTS audio'),
    });
    expect(state.messages).toHaveLength(0);

    // Ending TTS restores listening phase
    state = conversationReducer(state, { type: 'TTS_PLAYBACK_ENDED' });
    expect(state.phase).toBe('listening');
    expect(state.isSpeakingTts).toBe(false);
    expect(state.ttsEchoGuardActive).toBe(false);
  });

  it('preserves manual pause across TTS playback', () => {
    let state = createInitialConversationState('en-IN', 'cloud-auto');
    state = conversationReducer(state, {
      type: 'CONNECTION_STATE_CHANGED',
      connectionState: 'connected',
    });
    state = conversationReducer(state, { type: 'SESSION_PAUSED_BY_USER' });
    expect(state.phase).toBe('paused');

    state = conversationReducer(state, { type: 'TTS_PLAYBACK_STARTED' });
    expect(state.phase).toBe('paused');
    expect(state.phaseBeforeTts).toBe('paused');
    expect(state.isSpeakingTts).toBe(true);

    state = conversationReducer(state, { type: 'TTS_PLAYBACK_ENDED' });
    expect(state.phase).toBe('paused');
    expect(state.isSpeakingTts).toBe(false);
  });

  it('handles reconnecting and error recovery transitions', () => {
    let state = createInitialConversationState('en-IN', 'cloud-auto');
    state = conversationReducer(state, {
      type: 'CONNECTION_STATE_CHANGED',
      connectionState: 'reconnecting',
    });
    expect(state.phase).toBe('reconnecting');

    state = conversationReducer(state, {
      type: 'ERROR_OCCURRED',
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'Socket dropped',
        recoverable: true,
      },
    });
    expect(state.phase).toBe('error');
    expect(state.lastError?.message).toBe('Socket dropped');

    state = conversationReducer(state, { type: 'ERROR_CLEARED' });
    expect(state.phase).toBe('idle');
    expect(state.lastError).toBeNull();
  });

  it('toggles rotated view and VAD speaking flag', () => {
    let state = createInitialConversationState('en-IN', 'cloud-auto');
    expect(state.isRotatedView).toBe(false);
    state = conversationReducer(state, { type: 'TOGGLE_ROTATED_VIEW' });
    expect(state.isRotatedView).toBe(true);

    state = conversationReducer(state, { type: 'SET_VAD_SPEAKING', speaking: true });
    expect(state.vadSpeaking).toBe(true);
  });
});

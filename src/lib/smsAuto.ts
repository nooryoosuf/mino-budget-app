import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { SAMPLE_SMS, fingerprint, parseSmsMessage } from './bmlParser';
import { categorize } from './categorize';
import { formatMVR } from './money';
import type { Store } from './store';

export const SMS_SENDER = '455';
const AUTO_LS = 'mino-sms-auto';

interface SmsConsentPlugin {
  startWatch(opts: { sender: string }): Promise<void>;
  stopWatch(): Promise<void>;
  addListener(
    event: 'smsReceived' | 'smsTimeout' | 'smsDenied' | 'smsError',
    cb: (info: { message?: string; error?: string }) => void,
  ): Promise<{ remove: () => void }>;
}

export interface SmsResult {
  status: 'imported' | 'duplicate' | 'needs-review';
  detail: string;
}

/** Shared pipeline: one raw 455 text → parsed, deduped, categorized, stored. */
export function handleIncomingSms(message: string, store: Store): SmsResult {
  const r = parseSmsMessage(message);
  if (!r.ok || !r.parsed) {
    return { status: 'needs-review', detail: r.errors[0] ?? 'Unknown format — kept out, enter manually.' };
  }
  const p = r.parsed;
  const date = p.date ?? new Date().toISOString().slice(0, 10);
  const fp = fingerprint(p.type, p.amountLaari, p.merchant, date);
  const dup = store.state.txns.some((t) => fingerprint(t.type, t.amountLaari, t.merchant, t.date) === fp);
  if (dup) return { status: 'duplicate', detail: `${p.merchant} ${formatMVR(p.amountLaari)} — already recorded, skipped.` };
  const cat = categorize(p.merchant, store.state.rules, store.state.learned, p.type).category;
  store.addTxn({
    amountLaari: p.amountLaari, currency: p.currency, type: p.type, merchant: p.merchant,
    category: cat, date, source: 'sms', reviewed: r.confidence >= 0.8,
    importMeta: { parserId: r.parserId, parserVersion: r.parserVersion, confidence: r.confidence, rawRef: message.slice(0, 120) },
  });
  return { status: 'imported', detail: `${p.merchant} · ${formatMVR(p.amountLaari)}${r.confidence < 0.8 ? ' — needs review' : ''}` };
}

export function useSmsAuto(store: Store) {
  const supported = Capacitor.isNativePlatform();
  const [enabled, setEnabledState] = useState(() => {
    try {
      return localStorage.getItem(AUTO_LS) === '1';
    } catch {
      return false;
    }
  });
  const [last, setLast] = useState<SmsResult | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  const listeners = useRef<{ remove: () => void }[]>([]);
  const plugin = useMemo(
    () => (supported ? registerPlugin<SmsConsentPlugin>('SmsConsent') : null),
    [supported],
  );

  const teardown = useCallback(async () => {
    listeners.current.forEach((l) => {
      try { l.remove(); } catch { /* ignore */ }
    });
    listeners.current = [];
    if (plugin) {
      try { await plugin.stopWatch(); } catch { /* native side already idle */ }
    }
  }, [plugin]);

  const arm = useCallback(async () => {
    if (!plugin) return;
    await teardown();
    try {
      await plugin.startWatch({ sender: SMS_SENDER });
      const onMsg = await plugin.addListener('smsReceived', ({ message }) => {
        if (message) setLast(handleIncomingSms(message, storeRef.current));
      });
      const onErr = await plugin.addListener('smsError', ({ error }) => {
        setLast({ status: 'needs-review', detail: `Watcher error: ${error ?? 'unknown'} — paste the 455 text instead.` });
      });
      listeners.current = [onMsg, onErr];
      setLast({ status: 'imported', detail: `Watching ${SMS_SENDER} — you'll get a one-tap prompt per alert.` });
    } catch {
      setLast({ status: 'needs-review', detail: 'Could not start watching (Play Services needed). Paste works regardless.' });
    }
  }, [plugin, teardown]);

  useEffect(() => {
    if (supported && enabled) void arm();
    else void teardown();
    return () => { void teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, enabled]);

  const setEnabled = useCallback((v: boolean) => {
    try {
      localStorage.setItem(AUTO_LS, v ? '1' : '0');
    } catch { /* ignore */ }
    setEnabledState(v);
    if (!v) setLast(null);
  }, []);

  const simulate = useCallback(() => {
    const sample = SAMPLE_SMS[Math.floor(Math.random() * SAMPLE_SMS.length)];
    setLast(handleIncomingSms(sample, storeRef.current));
  }, []);

  return { supported, enabled, setEnabled, last, simulate };
}

export type SmsAuto = ReturnType<typeof useSmsAuto>;

import { describe, it, expect } from 'vitest';
import {
  transactionFingerprint,
  investmentActivityFingerprint,
} from '../../src/lib/fingerprint.js';

describe('transactionFingerprint', () => {
  it('produces a 64-char hex hash', () => {
    const fp = transactionFingerprint('acc-1', '2025-01-15', -50.0, 'Coffee Shop');
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for same inputs', () => {
    const a = transactionFingerprint('acc-1', '2025-01-15', -50.0, 'Coffee Shop');
    const b = transactionFingerprint('acc-1', '2025-01-15', -50.0, 'Coffee Shop');
    expect(a).toBe(b);
  });

  it('differs when account changes', () => {
    const a = transactionFingerprint('acc-1', '2025-01-15', -50.0, 'Coffee Shop');
    const b = transactionFingerprint('acc-2', '2025-01-15', -50.0, 'Coffee Shop');
    expect(a).not.toBe(b);
  });

  it('differs when date changes', () => {
    const a = transactionFingerprint('acc-1', '2025-01-15', -50.0, 'Coffee Shop');
    const b = transactionFingerprint('acc-1', '2025-01-16', -50.0, 'Coffee Shop');
    expect(a).not.toBe(b);
  });

  it('differs when amount changes', () => {
    const a = transactionFingerprint('acc-1', '2025-01-15', -50.0, 'Coffee Shop');
    const b = transactionFingerprint('acc-1', '2025-01-15', -50.01, 'Coffee Shop');
    expect(a).not.toBe(b);
  });

  it('differs when description changes', () => {
    const a = transactionFingerprint('acc-1', '2025-01-15', -50.0, 'Coffee Shop');
    const b = transactionFingerprint('acc-1', '2025-01-15', -50.0, 'Tea Shop');
    expect(a).not.toBe(b);
  });
});

describe('investmentActivityFingerprint', () => {
  it('produces a 64-char hex hash', () => {
    const fp = investmentActivityFingerprint('acc-1', '2025-01-15', 'buy', 1000, 'VTI');
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', () => {
    const a = investmentActivityFingerprint('acc-1', '2025-01-15', 'buy', 1000, 'VTI');
    const b = investmentActivityFingerprint('acc-1', '2025-01-15', 'buy', 1000, 'VTI');
    expect(a).toBe(b);
  });

  it('differs when activity type changes', () => {
    const a = investmentActivityFingerprint('acc-1', '2025-01-15', 'buy', 1000, 'VTI');
    const b = investmentActivityFingerprint('acc-1', '2025-01-15', 'sell', 1000, 'VTI');
    expect(a).not.toBe(b);
  });

  it('differs when symbol changes', () => {
    const a = investmentActivityFingerprint('acc-1', '2025-01-15', 'buy', 1000, 'VTI');
    const b = investmentActivityFingerprint('acc-1', '2025-01-15', 'buy', 1000, 'VXUS');
    expect(a).not.toBe(b);
  });

  it('handles undefined symbol', () => {
    const a = investmentActivityFingerprint('acc-1', '2025-01-15', 'fee', 25);
    const b = investmentActivityFingerprint('acc-1', '2025-01-15', 'fee', 25, undefined);
    expect(a).toBe(b);
  });

  it('symbol vs no symbol produces different hash', () => {
    const a = investmentActivityFingerprint('acc-1', '2025-01-15', 'fee', 25);
    const b = investmentActivityFingerprint('acc-1', '2025-01-15', 'fee', 25, 'VTI');
    expect(a).not.toBe(b);
  });
});

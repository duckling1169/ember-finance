import { describe, it, expect } from 'vitest';
import {
  validateOnboarding,
  validateMemberProfile,
  validateHouseholdSettings,
} from '../../src/lib/validation.js';

describe('validateOnboarding', () => {
  const valid = {
    householdName: 'Smith Family',
    displayName: 'Adam',
    birthday: '1990-01-15',
    targetRetirementAge: 55,
  };

  it('passes with valid required fields', () => {
    expect(validateOnboarding(valid)).toEqual([]);
  });

  it('passes with all optional fields', () => {
    const errors = validateOnboarding({
      ...valid,
      taxFilingStatus: 'married_jointly',
      state: 'CA',
      currency: 'USD',
      annualIncome: 120000,
      employmentType: 'w2',
      riskTolerance: 'aggressive',
    });
    expect(errors).toEqual([]);
  });

  it('fails when householdName missing', () => {
    const errors = validateOnboarding({ ...valid, householdName: '' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'householdName' }));
  });

  it('fails when displayName missing', () => {
    const errors = validateOnboarding({ ...valid, displayName: '' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'displayName' }));
  });

  it('fails when birthday missing', () => {
    const errors = validateOnboarding({ ...valid, birthday: undefined });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'birthday' }));
  });

  it('fails when birthday is in the future', () => {
    const errors = validateOnboarding({ ...valid, birthday: '2099-01-01' });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'birthday', message: expect.stringContaining('past') }),
    );
  });

  it('accepts missing targetRetirementAge (optional, defaults to 65)', () => {
    const errors = validateOnboarding({ ...valid, targetRetirementAge: undefined });
    expect(errors.some((e: { field: string }) => e.field === 'targetRetirementAge')).toBe(false);
  });

  it('fails when targetRetirementAge <= current age', () => {
    const errors = validateOnboarding({ ...valid, targetRetirementAge: 20 });
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: 'targetRetirementAge',
        message: expect.stringContaining('greater than current age'),
      }),
    );
  });

  it('fails with invalid taxFilingStatus', () => {
    const errors = validateOnboarding({ ...valid, taxFilingStatus: 'divorced' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'taxFilingStatus' }));
  });

  it('fails with invalid state', () => {
    const errors = validateOnboarding({ ...valid, state: 'XX' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'state' }));
  });

  it('fails with invalid employmentType', () => {
    const errors = validateOnboarding({ ...valid, employmentType: 'freelance' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'employmentType' }));
  });

  it('fails with invalid riskTolerance', () => {
    const errors = validateOnboarding({ ...valid, riskTolerance: 'yolo' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'riskTolerance' }));
  });
});

describe('validateMemberProfile', () => {
  it('passes with valid partial update', () => {
    const errors = validateMemberProfile({ displayName: 'Updated Name' });
    expect(errors).toEqual([]);
  });

  it('fails with empty displayName', () => {
    const errors = validateMemberProfile({ displayName: '' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'displayName' }));
  });

  it('fails with future birthday', () => {
    const errors = validateMemberProfile({ birthday: '2099-01-01' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'birthday' }));
  });
});

describe('validateHouseholdSettings', () => {
  it('passes with valid partial update', () => {
    const errors = validateHouseholdSettings({ name: 'New Name', state: 'NY' });
    expect(errors).toEqual([]);
  });

  it('fails with empty name', () => {
    const errors = validateHouseholdSettings({ name: '' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('allows clearing optional fields with null', () => {
    const errors = validateHouseholdSettings({});
    expect(errors).toEqual([]);
  });
});

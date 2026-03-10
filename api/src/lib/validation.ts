import {
  TAX_FILING_STATUSES,
  EMPLOYMENT_TYPES,
  RISK_TOLERANCES,
  US_STATES,
} from '../types/index.js';

type ValidationError = { field: string; message: string };

export function validateOnboarding(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Household fields
  if (!body.householdName || typeof body.householdName !== 'string' || !body.householdName.trim()) {
    errors.push({ field: 'householdName', message: 'Household name is required' });
  }

  if (body.taxFilingStatus != null) {
    if (!TAX_FILING_STATUSES.includes(body.taxFilingStatus as never)) {
      errors.push({
        field: 'taxFilingStatus',
        message: `Must be one of: ${TAX_FILING_STATUSES.join(', ')}`,
      });
    }
  }

  if (body.state != null) {
    if (!US_STATES.includes(body.state as never)) {
      errors.push({ field: 'state', message: 'Must be a valid US state abbreviation' });
    }
  }

  if (body.currency != null && typeof body.currency !== 'string') {
    errors.push({ field: 'currency', message: 'Must be a string' });
  }

  // Member fields
  if (!body.displayName || typeof body.displayName !== 'string' || !body.displayName.trim()) {
    errors.push({ field: 'displayName', message: 'Display name is required' });
  }

  if (!body.birthday || typeof body.birthday !== 'string') {
    errors.push({ field: 'birthday', message: 'Birthday is required' });
  } else {
    const bd = new Date(body.birthday);
    if (isNaN(bd.getTime()) || bd >= new Date()) {
      errors.push({ field: 'birthday', message: 'Must be a valid past date' });
    }
  }

  if (body.targetRetirementAge != null) {
    if (typeof body.targetRetirementAge !== 'number' || body.targetRetirementAge <= 0) {
      errors.push({ field: 'targetRetirementAge', message: 'Must be a positive number' });
    } else if (typeof body.birthday === 'string') {
      const bd = new Date(body.birthday);
      if (!isNaN(bd.getTime())) {
        const currentAge = Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (body.targetRetirementAge <= currentAge) {
          errors.push({
            field: 'targetRetirementAge',
            message: 'Must be greater than current age',
          });
        }
      }
    }
  }

  errors.push(...validateOptionalMemberFields(body));

  return errors;
}

export function validateMemberProfile(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.displayName != null) {
    if (typeof body.displayName !== 'string' || !body.displayName.trim()) {
      errors.push({ field: 'displayName', message: 'Display name cannot be empty' });
    }
  }

  if (body.birthday != null) {
    if (typeof body.birthday !== 'string') {
      errors.push({ field: 'birthday', message: 'Must be a date string' });
    } else {
      const bd = new Date(body.birthday);
      if (isNaN(bd.getTime()) || bd >= new Date()) {
        errors.push({ field: 'birthday', message: 'Must be a valid past date' });
      }
    }
  }

  if (body.targetRetirementAge != null) {
    if (typeof body.targetRetirementAge !== 'number' || body.targetRetirementAge <= 0) {
      errors.push({ field: 'targetRetirementAge', message: 'Must be a positive number' });
    }
    // If birthday is also provided, cross-validate
    if (typeof body.birthday === 'string') {
      const bd = new Date(body.birthday);
      if (!isNaN(bd.getTime())) {
        const currentAge = Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if ((body.targetRetirementAge as number) <= currentAge) {
          errors.push({
            field: 'targetRetirementAge',
            message: 'Must be greater than current age',
          });
        }
      }
    }
  }

  errors.push(...validateOptionalMemberFields(body));

  return errors;
}

export function validateHouseholdSettings(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.name != null) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push({ field: 'name', message: 'Household name cannot be empty' });
    }
  }

  if (body.taxFilingStatus != null) {
    if (!TAX_FILING_STATUSES.includes(body.taxFilingStatus as never)) {
      errors.push({
        field: 'taxFilingStatus',
        message: `Must be one of: ${TAX_FILING_STATUSES.join(', ')}`,
      });
    }
  }

  if (body.state != null) {
    if (!US_STATES.includes(body.state as never)) {
      errors.push({ field: 'state', message: 'Must be a valid US state abbreviation' });
    }
  }

  if (body.currency != null && typeof body.currency !== 'string') {
    errors.push({ field: 'currency', message: 'Must be a string' });
  }

  return errors;
}

function validateOptionalMemberFields(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.annualIncome != null) {
    if (typeof body.annualIncome !== 'number' || body.annualIncome <= 0) {
      errors.push({ field: 'annualIncome', message: 'Must be a positive number' });
    }
  }

  if (body.employmentType != null) {
    if (!EMPLOYMENT_TYPES.includes(body.employmentType as never)) {
      errors.push({
        field: 'employmentType',
        message: `Must be one of: ${EMPLOYMENT_TYPES.join(', ')}`,
      });
    }
  }

  if (body.riskTolerance != null) {
    if (!RISK_TOLERANCES.includes(body.riskTolerance as never)) {
      errors.push({
        field: 'riskTolerance',
        message: `Must be one of: ${RISK_TOLERANCES.join(', ')}`,
      });
    }
  }

  return errors;
}

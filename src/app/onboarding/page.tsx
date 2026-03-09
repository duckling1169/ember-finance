'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createHousehold } from '@/lib/api';
import { RequireAuth } from '@/lib/require-auth';

const inputStyle = {
  width: '100%',
  padding: 8,
  border: '1px solid #ccc',
  borderRadius: 4,
  boxSizing: 'border-box' as const,
};

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <OnboardingContent />
    </RequireAuth>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      householdName: form.get('householdName'),
      displayName: form.get('displayName'),
      birthday: form.get('birthday'),
      targetRetirementAge: Number(form.get('targetRetirementAge')),
    };

    // Optional fields
    const tax = form.get('taxFilingStatus');
    if (tax) data.taxFilingStatus = tax;
    const state = form.get('state');
    if (state) data.state = state;
    const income = form.get('annualIncome');
    if (income) data.annualIncome = Number(income);
    const employment = form.get('employmentType');
    if (employment) data.employmentType = employment;
    const risk = form.get('riskTolerance');
    if (risk) data.riskTolerance = risk;

    try {
      await createHousehold(data);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Set Up Your Household</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Tell us about yourself to get started.</p>

      <form onSubmit={handleSubmit}>
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 24px 0' }}>
          <legend style={{ fontWeight: 600, marginBottom: 12 }}>Household</legend>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Household Name *</label>
            <input name="householdName" required placeholder="Smith Family" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Tax Filing Status</label>
            <select name="taxFilingStatus" style={inputStyle} defaultValue="">
              <option value="">--</option>
              <option value="single">Single</option>
              <option value="married_jointly">Married Filing Jointly</option>
              <option value="married_separately">Married Filing Separately</option>
              <option value="head_of_household">Head of Household</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>State</label>
            <input name="state" placeholder="CA" maxLength={2} style={inputStyle} />
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 24px 0' }}>
          <legend style={{ fontWeight: 600, marginBottom: 12 }}>Your Profile</legend>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Display Name *</label>
            <input name="displayName" required placeholder="Adam" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Birthday *</label>
            <input name="birthday" type="date" required style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Target Retirement Age *</label>
            <input
              name="targetRetirementAge"
              type="number"
              required
              min={1}
              placeholder="55"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Annual Income</label>
            <input
              name="annualIncome"
              type="number"
              min={0}
              placeholder="150000"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Employment Type</label>
            <select name="employmentType" style={inputStyle} defaultValue="">
              <option value="">--</option>
              <option value="w2">W-2</option>
              <option value="1099">1099</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Risk Tolerance</label>
            <select name="riskTolerance" style={inputStyle} defaultValue="">
              <option value="">--</option>
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>
        </fieldset>

        {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 10,
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Creating...' : 'Create Household'}
        </button>
      </form>
    </div>
  );
}

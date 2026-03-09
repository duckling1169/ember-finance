'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createHousehold } from '@/lib/api';
import { RequireAuth } from '@/lib/require-auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

  return (
    <div className="flex min-h-screen items-start justify-center p-6 pt-16">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Set Up Your Household</CardTitle>
          <CardDescription>Tell us about yourself to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Household</legend>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Household Name *</label>
                <Input name="householdName" required placeholder="Smith Family" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tax Filing Status</label>
                <select name="taxFilingStatus" className={selectClass} defaultValue="">
                  <option value="">--</option>
                  <option value="single">Single</option>
                  <option value="married_jointly">Married Filing Jointly</option>
                  <option value="married_separately">Married Filing Separately</option>
                  <option value="head_of_household">Head of Household</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">State</label>
                <Input name="state" placeholder="CA" maxLength={2} />
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Your Profile</legend>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Display Name *</label>
                <Input name="displayName" required placeholder="Adam" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Birthday *</label>
                <Input name="birthday" type="date" required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Target Retirement Age *</label>
                <Input name="targetRetirementAge" type="number" required min={1} placeholder="55" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Annual Income</label>
                <Input name="annualIncome" type="number" min={0} placeholder="150000" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Employment Type</label>
                <select name="employmentType" className={selectClass} defaultValue="">
                  <option value="">--</option>
                  <option value="w2">W-2</option>
                  <option value="1099">1099</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Risk Tolerance</label>
                <select name="riskTolerance" className={selectClass} defaultValue="">
                  <option value="">--</option>
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
            </fieldset>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create Household'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

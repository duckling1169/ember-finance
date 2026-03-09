'use client';

import { use } from 'react';

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Account Detail</h1>
      <p className="text-sm text-muted-foreground">Account ID: {id}</p>
      <p className="text-sm text-muted-foreground">
        Tabs (Overview, Transactions, Holdings, Sources) coming soon.
      </p>
    </div>
  );
}

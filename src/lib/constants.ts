export const TAX_BUCKET_LABELS: Record<string, string> = {
  taxable: 'Taxable',
  traditional: 'Traditional (pre-tax)',
  roth: 'Roth (after-tax)',
  hsa: 'HSA',
  none: 'N/A',
};

export const TAX_BUCKET_OPTIONS = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'traditional', label: 'Traditional (pre-tax)' },
  { value: 'roth', label: 'Roth (after-tax)' },
  { value: 'hsa', label: 'HSA' },
  { value: 'none', label: 'N/A' },
] as const;

export const API_PROVIDERS: readonly string[] = ['teller', 'snaptrade'];

export const devBypass =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';

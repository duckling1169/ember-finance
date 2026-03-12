export const TAX_TREATMENT_LABELS: Record<string, string> = {
  pre_tax: 'Pre-tax',
  after_tax: 'After-tax',
  tax_free: 'Tax-free',
  none: 'N/A',
};

export const TAX_TREATMENT_OPTIONS = [
  { value: 'pre_tax', label: 'Pre-tax' },
  { value: 'after_tax', label: 'After-tax' },
  { value: 'tax_free', label: 'Tax-free' },
  { value: 'none', label: 'N/A' },
] as const;

export const API_PROVIDERS: readonly string[] = ['teller', 'snaptrade'];

export const devBypass =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';

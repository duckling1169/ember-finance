import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root
config({ path: resolve(__dirname, '../../../.env.local') });

const projectRoot = resolve(__dirname, '../../..');

export const env = {
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // Teller
  tellerAppId: process.env.TELLER_APP_ID!,
  tellerEnvironment: process.env.TELLER_ENVIRONMENT || 'sandbox',
  tellerCertPath: resolve(projectRoot, process.env.TELLER_CERT_PATH || './certificate.pem'),
  tellerKeyPath: resolve(projectRoot, process.env.TELLER_KEY_PATH || './private_key.pem'),
  tellerTokenSigningSecret: process.env.TOKEN_SIGNING_SECRET!,

  // SnapTrade
  snaptradeClientId: process.env.SNAPTRADE_CLIENT_ID!,
  snaptradeSecret: process.env.SNAPTRADE_SECRET!,

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY!,

  // Server
  port: parseInt(process.env.API_PORT || '3001', 10),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
} as const;

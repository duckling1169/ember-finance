# Ember Finance -- iOS Companion App Development Guide

This document covers everything needed to build a native iOS app that shares the same Hono API backend and Supabase auth infrastructure as the Ember web app.

---

## 1. Architecture Overview

The iOS app is a thin native client that consumes the existing Ember API. No new backend is required -- the same Hono server that powers the Next.js web app serves the iOS app.

```
┌─────────────────┐      ┌─────────────────┐
│   Next.js Web   │      │    iOS App       │
│   (port 3000)   │      │  (SwiftUI)       │
└────────┬────────┘      └────────┬─────────┘
         │  HTTP/JSON             │  HTTP/JSON
         │  Bearer JWT            │  Bearer JWT
         ▼                        ▼
┌──────────────────────────────────────────┐
│           Hono API Server (port 3001)    │
│  ── auth middleware ──────────────────── │
│  ── rate limiting ────────────────────── │
│  ── route handlers ───────────────────── │
└────────────────────┬─────────────────────┘
                     │  Supabase client
                     ▼
┌──────────────────────────────────────────┐
│         Supabase (Postgres + Auth)       │
│  ── RLS policies (household scoping) ─── │
│  ── DB functions / views ─────────────── │
└──────────────────────────────────────────┘
```

### What is shared

| Layer             | Shared? | Notes                                 |
| ----------------- | ------- | ------------------------------------- |
| API endpoints     | Yes     | Same Hono server, same routes         |
| Auth (Supabase)   | Yes     | Same project, same JWT issuer         |
| Types / contracts | Yes     | `shared/types/index.ts` is the source |
| Database + RLS    | Yes     | Single Supabase project               |
| UI components     | No      | SwiftUI replaces React                |
| State management  | No      | SwiftData/CoreData replaces SWR       |
| Charts            | No      | Swift Charts replaces Nivo            |

### Recommended iOS stack

- **SwiftUI** for all views
- **Swift Charts** (iOS 16+) for line/pie charts
- **Supabase Swift SDK** for auth
- **URLSession + async/await** for API calls
- **SwiftData** (iOS 17+) for local persistence and offline support
- **Keychain Services** for secure token storage

---

## 2. Auth Integration

### 2.1 Supabase Swift SDK setup

Add the Supabase Swift package:

```swift
// Package.swift or Xcode SPM
.package(url: "https://github.com/supabase/supabase-swift", from: "2.0.0")
```

Initialize the client:

```swift
import Supabase

let supabase = SupabaseClient(
    supabaseURL: URL(string: "https://YOUR_PROJECT.supabase.co")!,
    supabaseKey: "YOUR_ANON_KEY"
)
```

The `supabaseURL` and `supabaseKey` values match the `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables used by the API server.

### 2.2 Token flow

```
Sign Up / Sign In (Supabase Auth)
        │
        ▼
  Receive Session (access_token + refresh_token)
        │
        ▼
  Store tokens in Keychain
        │
        ▼
  All API calls: Authorization: Bearer <access_token>
        │
        ▼
  On 401 → refresh token → retry
```

**Sign up:**

```swift
let session = try await supabase.auth.signUp(
    email: email,
    password: password
)
// session.accessToken is the JWT to send to the API
```

**Sign in:**

```swift
let session = try await supabase.auth.signIn(
    email: email,
    password: password
)
```

**Get current token for API calls:**

```swift
let session = try await supabase.auth.session
let accessToken = session.accessToken
```

### 2.3 Token refresh

The Supabase Swift SDK handles token refresh automatically via `supabase.auth.session`. When you access the session, the SDK checks expiry and refreshes if needed.

For manual refresh:

```swift
let session = try await supabase.auth.refreshSession()
```

### 2.4 Keychain storage

The Supabase Swift SDK stores tokens automatically. If you need custom Keychain access (e.g., for sharing tokens with a widget extension), use a wrapper:

```swift
import Security

enum KeychainHelper {
    static func save(key: String, data: Data) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemDelete(query as CFDictionary)
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    static func load(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &result)
        return result as? Data
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
```

### 2.5 Onboarding flow

After auth, a new user must call `POST /api/onboarding` to create their household and member profile before any other API calls will work. The API returns 404 from `requireMember` middleware if no member record exists.

Flow: Sign Up -> POST /api/onboarding -> App ready

For partner invites: Sign Up -> POST /api/onboarding/accept-invite -> App ready

---

## 3. API Client Setup

### 3.1 Base URL configuration

```swift
enum EmberAPI {
    #if DEBUG
    // iOS Simulator connects to Mac's localhost directly
    static let baseURL = URL(string: "http://localhost:3001")!
    #else
    static let baseURL = URL(string: "https://api.ember.finance")!
    #endif
}
```

For physical devices during development, use your Mac's local IP:

```swift
// Physical device → Mac's IP on the same Wi-Fi network
static let baseURL = URL(string: "http://192.168.1.XXX:3001")!
```

### 3.2 Request / response patterns

All API communication uses JSON over HTTP with Bearer token auth.

```swift
actor EmberClient {
    private let baseURL: URL
    private let supabase: SupabaseClient
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(baseURL: URL, supabase: SupabaseClient) {
        self.baseURL = baseURL
        self.supabase = supabase
        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder.dateDecodingStrategy = .iso8601
        self.encoder = JSONEncoder()
        self.encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    func request<T: Decodable>(
        method: String,
        path: String,
        body: (any Encodable)? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        let session = try await supabase.auth.session

        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body {
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw EmberError.invalidResponse
        }

        // Track rate limit headers
        if let remaining = http.value(forHTTPHeaderField: "X-RateLimit-Remaining"),
           let remainingInt = Int(remaining), remainingInt < 10 {
            // Log or throttle — approaching limit
        }

        switch http.statusCode {
        case 200...299:
            return try decoder.decode(T.self, from: data)
        case 401:
            // Token expired — try refresh and retry once
            _ = try await supabase.auth.refreshSession()
            return try await self.request(method: method, path: path, body: body, queryItems: queryItems)
        case 429:
            let retryAfter = http.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init) ?? 60
            throw EmberError.rateLimited(retryAfterSeconds: retryAfter)
        default:
            let apiError = try? decoder.decode(APIError.self, from: data)
            throw EmberError.api(status: http.statusCode, message: apiError?.error ?? "Unknown error")
        }
    }
}
```

### 3.3 Error handling

All API errors return a consistent JSON shape:

```json
{ "error": "Human-readable error message" }
```

Validation errors include additional detail:

```json
{
  "error": "Validation failed",
  "details": [{ "field": "birthday", "message": "Birthday is required" }]
}
```

Swift models:

```swift
struct APIError: Decodable {
    let error: String
    let details: [ValidationError]?
}

struct ValidationError: Decodable {
    let field: String
    let message: String
}

enum EmberError: Error {
    case invalidResponse
    case api(status: Int, message: String)
    case rateLimited(retryAfterSeconds: Int)
    case noSession
}
```

### 3.4 Rate limit headers

Every response includes these headers:

| Header                  | Description                          |
| ----------------------- | ------------------------------------ |
| `X-RateLimit-Limit`     | Max requests per window (100)        |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset`     | Unix timestamp when window resets    |
| `Retry-After`           | Seconds to wait (only on 429)        |

Global limit: **100 requests per 60 seconds** per IP/user.
Onboarding endpoints: **10 requests per 60 seconds** (stricter).

---

## 4. API Reference Summary

Base path: `/api` (all require `Authorization: Bearer <token>`)

### Health (public)

| Method | Path      | Description                |
| ------ | --------- | -------------------------- |
| GET    | `/health` | Server status and DB check |

### Onboarding

| Method | Path                            | Description                               |
| ------ | ------------------------------- | ----------------------------------------- |
| POST   | `/api/onboarding`               | Create household + owner member           |
| POST   | `/api/onboarding/accept-invite` | Accept invite and join existing household |

### Settings

Resolved from auth token (no householdId in path).

| Method | Path                              | Description                        |
| ------ | --------------------------------- | ---------------------------------- |
| GET    | `/api/settings/household`         | Get household settings             |
| PATCH  | `/api/settings/household`         | Update household (owner only)      |
| GET    | `/api/settings/profile`           | Get current member profile         |
| PATCH  | `/api/settings/profile`           | Update member profile              |
| GET    | `/api/settings/members`           | List household members             |
| DELETE | `/api/settings/members/:memberId` | Remove a member (owner only)       |
| GET    | `/api/settings/invites`           | List pending invites (owner only)  |
| POST   | `/api/settings/invites`           | Send invite email (owner only)     |
| DELETE | `/api/settings/invites/:inviteId` | Cancel pending invite (owner only) |

### Accounts

| Method | Path                                             | Description                     | Query params                    |
| ------ | ------------------------------------------------ | ------------------------------- | ------------------------------- |
| GET    | `/api/accounts/:householdId`                     | List active accounts (enriched) |                                 |
| GET    | `/api/accounts/:householdId/history/net-worth`   | Net worth time series           | `from`, `to`                    |
| GET    | `/api/accounts/:householdId/history/investments` | Investment balance time series  | `from`, `to`                    |
| GET    | `/api/accounts/:householdId/:accountId`          | Full account detail             |                                 |
| GET    | `/api/accounts/:householdId/:accountId/holdings` | Account holdings                |                                 |
| GET    | `/api/accounts/:householdId/:accountId/lots`     | Account open tax lots           |                                 |
| GET    | `/api/accounts/:householdId/:accountId/balances` | Account balance snapshots       | `from`, `to`                    |
| GET    | `/api/accounts/:householdId/:accountId/history`  | Account timeline events         | `limit`, `offset`, `from`, `to` |
| POST   | `/api/accounts/:householdId`                     | Create account                  |                                 |
| PATCH  | `/api/accounts/:householdId/:accountId`          | Update account                  |                                 |
| DELETE | `/api/accounts/:householdId/:accountId`          | Soft-delete account             |                                 |

### Activity

| Method | Path                                      | Description                 | Query params                                                           |
| ------ | ----------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/activity/transactions/:householdId` | List transactions (visible) | `accountId`, `from`, `to`, `limit` (100), `offset` (0)                 |
| GET    | `/api/activity/investments/:householdId`  | List investment activity    | `accountId`, `from`, `to`, `symbol`, `activityType`, `limit`, `offset` |

### Holdings

| Method | Path                         | Description                                     |
| ------ | ---------------------------- | ----------------------------------------------- |
| GET    | `/api/holdings/:householdId` | Household positions, summary, and open tax lots |

### Ingest

| Method | Path                                         | Description                                        |
| ------ | -------------------------------------------- | -------------------------------------------------- |
| POST   | `/api/ingest/manual/:householdId/:accountId` | Manual data entry (JSON body)                      |
| POST   | `/api/ingest/csv/:householdId/:accountId`    | CSV file upload (multipart, max 10 MB)             |
| POST   | `/api/ingest/sync/:householdId/:sourceId`    | Provider sync (returns 501 -- not yet implemented) |

### Duplicates

| Method | Path                                                   | Description                     |
| ------ | ------------------------------------------------------ | ------------------------------- |
| GET    | `/api/duplicates/transactions/:householdId/:accountId` | List hidden transactions        |
| GET    | `/api/duplicates/activity/:householdId/:accountId`     | List hidden investment activity |
| GET    | `/api/duplicates/review/:householdId/:accountId`       | Get duplicate candidate groups  |
| POST   | `/api/duplicates/hide/transaction/:id`                 | Hide transaction                |
| POST   | `/api/duplicates/unhide/transaction/:id`               | Unhide transaction              |
| POST   | `/api/duplicates/hide/activity/:id`                    | Hide investment activity        |
| POST   | `/api/duplicates/unhide/activity/:id`                  | Unhide investment activity      |

### Planning

Resolved from auth token (no householdId in path).

| Method | Path                                           | Description                  | Query params  |
| ------ | ---------------------------------------------- | ---------------------------- | ------------- |
| GET    | `/api/planning/income-sources`                 | List income sources          | `member_id`   |
| POST   | `/api/planning/income-sources`                 | Create income source         |               |
| PATCH  | `/api/planning/income-sources/:sourceId`       | Update income source         |               |
| DELETE | `/api/planning/income-sources/:sourceId`       | Delete income source         |               |
| GET    | `/api/planning/flows`                          | List cashflow items          | `member_id`   |
| POST   | `/api/planning/flows`                          | Create cashflow item         |               |
| PATCH  | `/api/planning/flows/:flowId`                  | Update cashflow item         |               |
| DELETE | `/api/planning/flows/:flowId`                  | Delete cashflow item         |               |
| GET    | `/api/planning/expense-categories`             | List expense categories      |               |
| POST   | `/api/planning/expense-categories`             | Create expense category      |               |
| PATCH  | `/api/planning/expense-categories/:categoryId` | Update expense category      |               |
| DELETE | `/api/planning/expense-categories/:categoryId` | Delete expense category      |               |
| GET    | `/api/planning/scenarios`                      | List planning scenarios      |               |
| POST   | `/api/planning/scenarios`                      | Create scenario              |               |
| PATCH  | `/api/planning/scenarios/:scenarioId`          | Update scenario              |               |
| GET    | `/api/planning/cashflow-summary`               | Computed waterfall breakdown | `scenario_id` |
| GET    | `/api/planning/projections`                    | Portfolio projection         | `scenario_id` |
| GET    | `/api/planning/metrics`                        | FI metrics + savings rates   | `scenario_id` |

---

## 5. Delta Sync Strategy

The iOS app should implement a layered sync strategy to minimize data transfer and keep the local store current.

### 5.1 Recommended sync flow

```
App Launch
    │
    ├── First launch? → Full Load (all accounts, holdings, etc.)
    │
    └── Returning? → Delta Sync
            │
            ├── Fetch accounts list (lightweight, always fresh)
            ├── Fetch updated balances / holdings
            └── Check for new transactions since lastSyncDate
```

### 5.2 Implementation approach

Since the API uses standard pagination and date filtering, delta sync is achieved by combining query parameters:

```swift
// Fetch only transactions since last sync
let newTransactions: [Transaction] = try await client.request(
    method: "GET",
    path: "/api/activity/transactions/\(householdId)",
    queryItems: [
        URLQueryItem(name: "from", value: lastSyncDate),  // YYYY-MM-DD
        URLQueryItem(name: "limit", value: "500"),
    ]
)
```

**Track sync timestamps per entity type:**

```swift
@Model
class SyncMetadata {
    var entityType: String        // "transactions", "activity", "balances"
    var householdId: String
    var lastSyncedAt: Date
    var lastFullSyncAt: Date

    // Full sync weekly, delta sync every 15 minutes
    var needsFullSync: Bool {
        Date().timeIntervalSince(lastFullSyncAt) > 7 * 24 * 3600
    }
}
```

### 5.3 Background fetch

Register for background app refresh to keep data current:

```swift
import BackgroundTasks

func registerBackgroundSync() {
    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "finance.ember.sync",
        using: nil
    ) { task in
        handleBackgroundSync(task: task as! BGAppRefreshTask)
    }
}

func scheduleBackgroundSync() {
    let request = BGAppRefreshTaskRequest(identifier: "finance.ember.sync")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 min
    try? BGTaskScheduler.shared.submit(request)
}
```

### 5.4 SwiftData schema mapping

Map the API types to SwiftData models for local persistence:

```swift
import SwiftData

@Model
class AccountModel {
    @Attribute(.unique) var id: String
    var householdId: String
    var memberId: String?
    var name: String
    var institution: String?
    var accountType: String
    var currency: String
    var isActive: Bool
    var isLiability: Bool
    var includeInFIPortfolio: Bool
    var taxTreatment: String
    var balance: Double
    var balanceDate: String?
    var linked: Bool
    var lastSynced: String?
    var createdAt: String

    @Relationship(deleteRule: .cascade)
    var holdings: [HoldingModel]

    @Relationship(deleteRule: .cascade)
    var transactions: [TransactionModel]
}

@Model
class HoldingModel {
    @Attribute(.unique) var id: String
    var householdId: String
    var accountId: String
    var symbol: String
    var name: String?
    var quantity: Double
    var price: Double?
    var marketValue: Double
    var costBasis: Double?
    var assetClass: String?
    var asOf: String
}

@Model
class TransactionModel {
    @Attribute(.unique) var id: String
    var householdId: String
    var accountId: String
    var date: String
    var amount: Double
    var descriptionText: String
    var category: String?
    var isTransfer: Bool
}
```

---

## 6. Shared Type Mapping

### 6.1 TypeScript to Swift Codable

The source of truth for API types is `shared/types/index.ts`. Map these to Swift `Codable` structs.

| TypeScript                | Swift                      |
| ------------------------- | -------------------------- |
| `string`                  | `String`                   |
| `number`                  | `Double` (amounts) / `Int` |
| `boolean`                 | `Bool`                     |
| `string \| null`          | `String?`                  |
| `Record<string, unknown>` | `[String: AnyCodable]`     |
| union string literals     | `enum: String, Codable`    |

Example type mapping:

```swift
// From: shared/types/index.ts → AccountType
enum AccountType: String, Codable, CaseIterable {
    case checking, savings, credit, brokerage
    case retirement, hsa, loan, mortgage, other
}

// From: shared/types/index.ts → Account
struct Account: Codable, Identifiable {
    let id: String
    let householdId: String
    let memberId: String?
    let name: String
    let institution: String?
    let accountType: AccountType
    let currency: String
    let isActive: Bool
    let isLiability: Bool
    let includeInFiPortfolio: Bool
    let taxTreatment: TaxTreatment
    let createdAt: String
}

// From: shared/types/index.ts → EnrichedAccount
struct EnrichedAccount: Codable, Identifiable {
    let id: String
    let householdId: String
    let name: String
    let institution: String?
    let accountType: AccountType
    let currency: String
    let isActive: Bool
    let isLiability: Bool
    let balance: Double
    let balanceDate: String?
    let linked: Bool
    let lastSynced: String?
}

// From: shared/types/index.ts → ActivityType
enum ActivityType: String, Codable {
    case buy, sell, dividend, reinvestment, split
    case transferIn = "transfer_in"
    case transferOut = "transfer_out"
    case fee, interest
    case returnOfCapital = "return_of_capital"
}

// From: shared/types/index.ts → TaxTreatment
enum TaxTreatment: String, Codable {
    case preTax = "pre_tax"
    case afterTax = "after_tax"
    case taxFree = "tax_free"
    case none
}

// From: shared/types/index.ts → AssetClass
enum AssetClass: String, Codable {
    case equity, fixedIncome = "fixed_income", cash
    case crypto, realEstate = "real_estate", commodity, other
}

// From: shared/types/index.ts → FIMetrics
struct FIMetrics: Codable {
    let fireNumber: Double
    let securityFi: Double
    let coastFi: Double
    let boilingPoint: Double
    let progressPct: Double
    let yearsToFire: Double?
    let projectedRetirementAge: Double?
    let onTrack: OnTrackStatus

    enum OnTrackStatus: String, Codable {
        case ahead, onTrack = "on_track", behind, unreachable
    }
}

// From: shared/types/index.ts → SavingsRates
struct SavingsRates: Codable {
    let investmentRate: Double
    let savingsRate: Double
    let totalSavingsRate: Double
}

// From: shared/types/index.ts → ProjectionYear
struct ProjectionYear: Codable {
    let year: Int
    let age: Int?
    let startingPortfolio: Double
    let contributions: Double
    let growth: Double
    let endingPortfolio: Double
}
```

### 6.2 Code generation

For keeping Swift types in sync with the TypeScript source, consider:

- **quicktype** (`npm install -g quicktype`): Generate Swift from TypeScript or JSON samples.

  ```bash
  quicktype shared/types/index.ts -o EmberTypes.swift --lang swift
  ```

- **Manual maintenance**: For a project this size (~40 types), manual mapping with unit tests is reasonable and gives you full control over Swift idioms.

### 6.3 Key enums to mirror

These enums must match the API exactly:

| TypeScript enum     | Values                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `AccountType`       | checking, savings, credit, brokerage, retirement, hsa, loan, mortgage, other                          |
| `ActivityType`      | buy, sell, dividend, reinvestment, split, transfer_in, transfer_out, fee, interest, return_of_capital |
| `AssetClass`        | equity, fixed_income, cash, crypto, real_estate, commodity, other                                     |
| `TaxTreatment`      | pre_tax, after_tax, tax_free, none                                                                    |
| `TaxFilingStatus`   | single, married_jointly, married_separately, head_of_household                                        |
| `EmploymentType`    | w2, 1099, mixed                                                                                       |
| `RiskTolerance`     | conservative, moderate, aggressive                                                                    |
| `CashflowDirection` | inflow, outflow                                                                                       |
| `CashflowBucket`    | savings, employer_match, expense                                                                      |
| `CashflowFrequency` | monthly, biweekly, annual, one_time                                                                   |
| `IncomeSourceType`  | employment, self_employment, passive, other                                                           |
| `AssetCategory`     | real_estate, vehicle, other                                                                           |

---

## 7. Push Notifications (Future)

Push notifications are not yet implemented. This section outlines the planned architecture.

### 7.1 Planned flow

```
iOS App                          API Server                    APNs
   │                                │                            │
   ├─ Register for push ───────────►│                            │
   │  POST /api/settings/devices    │                            │
   │  { deviceToken, platform }     │                            │
   │                                │                            │
   │                    (event triggers notification)             │
   │                                ├── Send push ──────────────►│
   │                                │   { alert, badge, data }   │
   │◄───────────────────────────────┼────────────────────────────┤
   │  Receive notification          │                            │
```

### 7.2 Placeholder endpoint design

```
POST /api/settings/devices
Body: {
    "deviceToken": "<apns_hex_token>",
    "platform": "ios",
    "name": "iPhone 15 Pro"        // optional
}

DELETE /api/settings/devices/:deviceId
```

### 7.3 Notification types to consider

- Sync completed (new transactions imported)
- Account connection lost (provider link broken)
- Net worth milestone reached
- FI progress update (monthly)
- Invite accepted by partner

---

## 8. Development Setup

### 8.1 Prerequisites

1. Xcode 16+ with iOS 17 SDK
2. Ember API server running locally (`cd api && npm run dev`)
3. Supabase project (local or hosted)

### 8.2 Local API connection from simulator

The iOS Simulator runs on the same machine as the API, so `localhost` works:

```swift
// For Simulator
let apiBaseURL = "http://localhost:3001"
```

For physical device testing, use your Mac's IP:

```bash
# Find your Mac's local IP
ifconfig en0 | grep "inet "
# → inet 192.168.1.42 ...
```

```swift
// For physical device
let apiBaseURL = "http://192.168.1.42:3001"
```

### 8.3 CORS configuration

The API server reads allowed origins from the `CORS_ORIGIN` environment variable (comma-separated). For iOS development, CORS is not a concern -- CORS is a browser-only restriction. Native HTTP clients (URLSession) are not subject to CORS policies.

No CORS changes are needed for iOS.

### 8.4 Environment variables

The iOS app needs these values (store in a config file or Xcode build settings, never hardcode in source):

| Variable            | Description                   | Example                       |
| ------------------- | ----------------------------- | ----------------------------- |
| `SUPABASE_URL`      | Supabase project URL          | `https://xxxxx.supabase.co`   |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGciOi...`               |
| `API_BASE_URL`      | Ember API server URL          | `http://localhost:3001` (dev) |

Create a `Secrets.xcconfig` file (git-ignored):

```
SUPABASE_URL = https:$()/$()/xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOi...
API_BASE_URL = http:$()/$()/localhost:3001
```

Access in code:

```swift
enum Config {
    static let supabaseURL = Bundle.main.infoDictionary!["SUPABASE_URL"] as! String
    static let supabaseAnonKey = Bundle.main.infoDictionary!["SUPABASE_ANON_KEY"] as! String
    static let apiBaseURL = Bundle.main.infoDictionary!["API_BASE_URL"] as! String
}
```

### 8.5 Verifying connectivity

```bash
# Health check (no auth required)
curl http://localhost:3001/health
# → {"status":"ok","db":"connected","timestamp":"2026-03-12T..."}

# Authenticated request (replace TOKEN with a valid Supabase JWT)
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/settings/profile
# → {"id":"...","household_id":"...","display_name":"..."}
```

---

## 9. Key Conventions

### Amounts

- **Negative = money out** (expenses, withdrawals, sells)
- **Positive = money in** (income, deposits, buys)
- All monetary amounts are `Double` (not cents/integers)
- Currency is always specified per account (default `USD`)

### Dates

- All dates are **ISO 8601 strings**: `YYYY-MM-DD` for dates, full ISO for timestamps
- The API does not use Unix timestamps in request/response bodies
- Date filtering uses query params: `?from=2025-01-01&to=2025-12-31`

### IDs

- All entity IDs are **UUIDs** (v4), generated server-side by Postgres
- Format: `550e8400-e29b-41d4-a716-446655440000`
- Use `String` in Swift (not `UUID` type) since they arrive as JSON strings

### Pagination

- Pattern: `?limit=N&offset=M`
- Default limit varies by endpoint (100 for transactions, 50 for timeline events)
- Offset is 0-based
- Responses return the data array directly (no wrapper with total count)

### Soft deletes

- Accounts use soft delete (`is_active = false`), not hard delete
- Transactions/activity use `is_hidden` for duplicate management
- Deleted accounts stop appearing in list endpoints but data is preserved

### Household scoping

- Every data record belongs to a `household_id`
- The API enforces this via middleware -- the iOS app never needs to worry about cross-household data leakage
- A user belongs to exactly one household
- The `householdId` is resolved from the auth token for settings/planning routes, or passed as a path param for account/activity routes

### Error codes

| HTTP Status | Meaning                            |
| ----------- | ---------------------------------- |
| 400         | Validation error or bad input      |
| 401         | Missing/invalid/expired auth token |
| 403         | Not a member of this household     |
| 404         | Resource not found                 |
| 409         | Conflict (duplicate invite, etc.)  |
| 410         | Gone (expired invite)              |
| 429         | Rate limited                       |
| 500         | Server error                       |
| 501         | Not implemented (provider sync)    |

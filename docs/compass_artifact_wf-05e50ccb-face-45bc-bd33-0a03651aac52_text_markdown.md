# Ember Feature Strategy: What FIRE Power Users Actually Demand

## TL;DR

- **Table stakes for serious FIRE tooling are now: probabilistic projections (Monte Carlo + historical backtest), deep multi-account net-worth tracking with manual-entry power, transparent/editable assumptions, year-by-year tax-aware projections, and scenario comparison.** Ember already plans the simulation engine; the differentiators it should chase _beyond_ Monte Carlo/drawdown/sync are (1) Roth-conversion + tax-bracket optimization, (2) radical assumption transparency/auditability, and (3) account-aggregation reliability paired with first-class manual workflows.
- **The biggest churn driver across every tool is account-sync breakage** (Plaid/Yodlee/MX + brokerage hostility), and the biggest trust killer is "black box" projections with hidden or oversimplified tax math. Ember's auditable timeline + transparent tax engine are its strongest natural wedges — lean into them.
- **Willingness to pay clusters at ~$100/yr, spikes negatively at Kubera's $249/yr, and "Empower is free" is the anchor that makes any subscription hard to justify** unless the tool solves a specific pain (privacy, alt assets, projection depth, tax optimization). ProjectionLab ($109/yr Premium or $1,199 lifetime) and Boldin ($144/yr) define the FIRE-planning price band.

## Key Findings

1. **FIRE planning is bifurcated into two product categories that Ember is trying to merge.** Net-worth trackers (Kubera, Empower, Monarch, Copilot) aggregate balances; planning engines (ProjectionLab, Boldin, Pralana, MaxiFi, cFIREsim/FICalc) project the future. Power users routinely run TWO tools — a tracker plus a planner — and complain about it. A credible single-app merge of _accurate tracking + respected projections_ is the open market gap.

2. **ProjectionLab is the reference product for FIRE specifically**, winning on UI/UX, Monte Carlo depth (10,000 runs on Premium), historical backtest, scenario branching ("what-if" compare mode), Sankey income-flow visualization, and configurable/transparent assumptions. It deliberately does NOT link accounts — and users praise that as a privacy feature ("I love that I don't need to connect any financial accounts").

3. **Boldin (formerly NewRetirement) is the reference for tax/decumulation depth** — Roth Conversion Explorer (optimizes to lowest lifetime tax or highest estate value), Social Security Explorer, IRMAA reporting, RMD modeling, 250+ inputs, up to 10 simultaneous scenarios. Now at ~350,000 users tracking ~$300B in assets following its early-2026 rebrand. But it's criticized as clunky, linear, and a partial "black box" (no user-settable standard deviation; omits NIIT and AMT from projections; no ACA-subsidy modeling).

4. **Tax modeling is the single most valuable differentiator for the FIRE audience**, because the early-retirement "tax planning window" (retirement → RMD age 73/75) is where five- and six-figure lifetime savings are won via Roth conversion ladders, ACA-subsidy management, and bracket-filling. Boldin itself documents lifetime savings of "$20,000–$100,000+" from strategic conversions in this window.

5. **Sync reliability is the #1 churn driver and is largely outside any app's control**, which paradoxically makes excellent manual-entry workflows and CSV ingest (which Ember already has) a competitive advantage, not a fallback.

## Details

### A. Table Stakes vs. Differentiators

**TABLE STAKES** (power users leave immediately if missing):

- **Comprehensive multi-account net-worth tracking** incl. illiquid/alt assets, multi-currency, debt. (Ember ✅)
- **Historical net-worth charting & an auditable history model.** (Ember ✅) Note: Empower is criticized because it "only starts tracking from the day you sign up" with no balance-history backfill — Ember's timeline model is a genuine edge if it supports backdating.
- **Holdings + cost-basis/tax-lot tracking.** (Ember ✅) This is precisely where Monarch/Copilot fail FIRE users: Monarch's own docs admit it "only receives cost basis data from brokerages ~50% of the time," gates it behind a paid Monarch Plus tier, and refreshes holdings only daily.
- **Probabilistic projection (Monte Carlo) + historical/sequence-of-returns backtest** with a single "success probability" headline number and percentile bands. (Ember planned)
- **Year-by-year, tax-aware deterministic projection.** (Ember ✅ — strong starting position)
- **Editable, visible assumptions** (return, inflation, spending). Non-negotiable for this audience.
- **Scenario comparison / what-if** (retire 2 years earlier, 30% market drop, side-by-side). (Ember partial)

**DIFFERENTIATORS** (create loyalty and willingness-to-pay):

- **Roth-conversion / bracket-filling optimization** (Boldin's moat).
- **Withdrawal-sequencing & guardrail drawdown strategies** (Guyton-Klinger, VPW, fixed-real, % portfolio, dynamic/Merton). (Ember planned)
- **Radical assumption transparency / "audit the math"** (ProjectionLab's appeal; the structural-engineer Bogleheads complaint that "all of these fancy looking software packages are black boxes with limited user inputs, e.g., Boldin doesn't allow standard of deviation to be entered" is the exact pain Ember can solve).
- **Beautiful, interactive visualization** (Sankey flows, rainbow Monte Carlo bands). (Ember has Sankey ✅)
- **Privacy / "we don't sell your data"** positioning (Kubera and ProjectionLab both lean in hard).
- **Account-aggregation reliability** via best-of-breed routing (Kubera uses multiple aggregators — Plaid, Yodlee, Flinks, Salt Edge — and auto-picks the optimal connector per institution).

### B. Specific Feature Depth

**Monte Carlo & sequence-of-returns (MUST-HAVE; Ember planned).** Expectations: configurable run count (Boldin runs 1,000 iterations producing 1,000 distinct curves; ProjectionLab Premium runs 10,000), both historical-backtest (Shiller data 1871–present, à la cFIREsim/FICalc/Engaging Data) AND parametric Monte Carlo modes, a single success-probability %, percentile bands, and the ability to set asset-class-specific return/standard-deviation. Power-user critiques to avoid: Boldin doesn't let users enter standard deviation; tools that "assume each account declines with every other account" (no uncorrelated assets) get dropped for Pralana. ProjectionLab's implementation is the respected reference because results are easy to interpret and assumptions are visible. _Best-in-class reference: ProjectionLab (parametric/UI), Engaging Data "Rich, Broke or Dead" (visualization of longevity risk)._

**Drawdown / withdrawal modeling (STRONG-WANT; Ember planned).** Expected strategies: fixed real (4% rule), fixed %, fixed dollar, Guyton-Klinger guardrails (with configurable bands, raise/cut %, "skip raise after loss year" toggle), VPW (age-based), and dynamic/Merton. Critically, **account withdrawal sequencing** across taxable → traditional → Roth, with the bridge/Roth-conversion-ladder phase modeled. Kitces' "risk-based guardrails" critique of Guyton-Klinger (that GK can force a ~45% real income cut in a Great-Depression-type sequence) is worth surfacing in-product as an assumption note. _Best-in-class reference: Boldin (sequencing), ProjectionLab (cash-flow priority system)._

**Tax modeling depth (HIGHEST DIFFERENTIATION VALUE).** What FIRE users specifically care about, ranked:

- **Roth conversion ladders & bracket-filling** (the marquee feature — Boldin's Explorer optimizes for lowest lifetime tax or highest estate value, cycling through every federal bracket).
- **ACA-subsidy cliff (400% FPL)** — uniquely important to _early_ retirees pre-65; one dollar over can wipe out $10k-15k+ in premium tax credits. **This is a verified gap even in Boldin and ProjectionLab** — neither integrates ACA-cliff modeling, and it is rare across the whole category. A clear opening for Ember.
- **IRMAA cliffs** (2-year MAGI lookback, Medicare surcharges) — matters at 63+; a "cliff" tax where exceeding by $1 triggers the full surcharge.
- **Capital gains vs. ordinary income, NIIT (3.8%)** — Boldin explicitly omits NIIT/AMT from projections; a real accuracy gap.
- **RMDs** (SECURE 2.0 ages 73/75), **state tax** (the optimal conversion can differ by ~$50k between a FL and CA resident), **Social Security taxation interaction**.
- **Asset location** (taxable vs. traditional vs. Roth) — research cited by FIRE writers suggests 20-50+ bps of "free" annual value.
- **Tax-loss harvesting** with wash-sale awareness.
  Ember already has federal brackets + state + FICA + joint filing; the high-value additions are Roth-conversion modeling, ACA/IRMAA cliffs, NIIT, and RMDs. _Best-in-class reference: Boldin (consumer), MaxiFi (optimization rigor — its Roth optimizer claims six-figure lifetime spending gains)._

**Account aggregation / live sync (TABLE STAKES but RELIABILITY IS THE BATTLE; Ember planned Teller/SnapTrade).** Plaid is described by fintech builders as "simultaneously the best and worst vendor they use... so unreliable... the time spent building product workarounds at every company to account for Plaid issues is tremendous." SnapTrade is specialized for brokerage/investment data and praised by developers ("our customer support tickets have quite literally dropped in half post-integration"). Empower's post-rebrand OAuth migration broke Fidelity/Vanguard/PNC links for many users ("half the accounts do not sync"). Strategy: multi-aggregator routing (Kubera's model), SnapTrade for brokerages specifically, Teller/Plaid for banking, and treat manual entry + CSV as first-class, not fallback.

**Net worth, allocation, drift/rebalancing (STRONG-WANT).** Expectations: allocation across ALL accounts (not one brokerage), drift tracking vs. target with threshold alerts (5pp common), tax-aware rebalancing suggestions (rebalance-by-contribution in accumulation; rebalance-via-withdrawal in decumulation), and an asset-location view. Monarch lacks investment-allocation tracking entirely — this is an opening.

**Scenario comparison / what-if (STRONG-WANT; Ember partial).** Side-by-side plan forking ("retire at 50 vs 55", "spending +20% after kids", "market drops 30%"). ProjectionLab's compare mode is the reference; Boldin supports up to 10 simultaneous scenarios but its comparison UI draws bug complaints ("It really needs a lot of improvement. I will probably let my subscription lapse.").

**Goal tracking & FIRE variants (NICE-TO-HAVE but identity-defining).** CoastFI, BaristaFI, LeanFIRE, FatFIRE milestones, custom milestone definitions (not just a single net-worth target), milestone celebration. Ember already has CoastFI/SecurityFI/FIRE number/years-to-FI — a strong base.

### C. UX / Product Expectations

- **Onboarding friction tolerance is HIGH for this audience but only if time-to-first-value is fast.** ProjectionLab is criticized for setup overwhelm; the lesson is progressive disclosure — a 5-minute quick-start (Boldin's model: a readiness snapshot in under five minutes) that produces a headline number, then unlimited depth.
- **Assumption transparency is core, not optional.** The defining FIRE complaint is the "black box," and the most sophisticated users abandon SaaS tools for their own Excel/R Monte Carlo models when they can't see or trust the math. Ember's auditable timeline + visible tax engine should be a marketed feature: show the formula, let users edit every assumption, expose the math.
- **Desktop-primary, spreadsheet-replacement audience.** ProjectionLab had no mobile app for years and still became the FIRE reference; this is a "money date" / desktop deep-work audience migrating from elaborate spreadsheets. Mobile is a nice-to-have for balance-checking, not the primary surface.
- **Privacy / no-data-selling matters and justifies subscription pricing.** Empower's free tool funds wealth-management advisory charging 0.89% of AUM on the first $1M (declining to 0.49% over $10M); the resented sales calls are its reputational tax ("We decided on a hard pass with Empower after the sales pitch call... I still do get hit up with emails and calls"). Kubera and ProjectionLab explicitly position on "we don't sell your data" (no ads, no upsells). ProjectionLab's $1,199 lifetime tier even enables a "private host" mode for offline data with advanced encryption. Ember (Supabase, subscription) should make privacy an explicit pillar.
- **Spreadsheet switchers stay for:** beautiful visualization, Monte Carlo they can't easily build, scenario branching, and not having to maintain formulas — but they leave if the math is hidden or wrong. Offering plan export (JSON/CSV) reduces lock-in anxiety.

### D. What Users Complain About / Churn Drivers (ranked)

1. **Sync breakage (#1)** — named: Empower↔Fidelity/Vanguard/PNC post-OAuth migration ("Essentially half the accounts do not sync"); Monarch↔Vanguard mis-categorizing 401k contributions as debits and doubling apparent spend; Plaid/Yodlee unreliability; even Vanguard's own external-account dashboard "broken for years."
2. **"Black box" projections / hidden assumptions** — Boldin's lack of standard-deviation input; "ALL models are wrong; some are useful."
3. **Oversimplified / incomplete tax math** — Boldin omits NIIT and AMT ("not included in the projections"); can't specify per-investment tax treatment; ACA subsidies unmodeled.
4. **Subscription fatigue** — letting subscriptions lapse when the tool underdelivers; Kubera's $249/yr is the most-cited resistance point ("Should you shell out $249 a year for a net worth tracker? For the average investor... no").
5. **Empower advisor sales calls** — near-universally resented (0.89% AUM, a 75-individual-stock portfolio pitch).
6. **Investment-tracking weakness in budgeting-first apps** — Monarch/Copilot cost-basis incomplete (~50% for Monarch), daily-only refresh, no native dividend category, no allocation tracking; Copilot can't surface transactions for blended brokerage/cash accounts.
7. **Missing features repeatedly requested** — inherited IRA support (caused PL trial abandonment before it was added), user-settable volatility, uncorrelated-asset modeling, withdrawal-order _optimization_ (vs. just evaluation), and historical balance backfill.

### E. Pricing / Willingness to Pay

- **ProjectionLab:** Free (basic, incl. Monte Carlo); Premium $109/yr (or ~$14/mo); lifetime $1,199 (risen from $450 → $799 → $1,199); Pro (advisor) ~$45/mo. (One PL-sponsored site cites $129/yr; unaffiliated reviews and Bogleheads converge on $109/yr.)
- **Boldin:** Free Basic (unusually generous — incl. Monte Carlo, Social Security Explorer, Roth Explorer before paying); PlannerPlus $144/yr ($12/mo billed annually; $120 grandfathered for existing subs); PlannerPro ~$990/yr.
- **Kubera:** $249/yr Essentials; $2,499/yr Black. No free tier ($1 14-day trial). Most-cited price resistance.
- **Empower:** Free dashboard (monetized via 0.89% AUM advisory on first $1M, down to 0.49% over $10M).
- **Monarch:** ~$99.99/yr or $14.99/mo. **YNAB:** ~$109/yr.
- **MaxiFi:** $109 Standard / $149 Premium. **Pralana:** ~$119/yr.
- **Free tier benchmarks:** cFIREsim, FICalc, FIRECalc, Engaging Data, Portfolio Visualizer.
- **Models:** Subscription dominates; ProjectionLab's lifetime option is beloved by FIRE users (breaks even in ~9–11 years vs. annual) and is a strong differentiator for a multi-decade-horizon audience. The recurring psychological threshold is the ~$100/yr line; willingness rises sharply only when a tool solves a specific, expensive problem (tax optimization, alt assets, privacy).

### F. Competitive Landscape Snapshot

- **ProjectionLab** — Best: FIRE-native UX, Monte Carlo, scenario branching, Sankey, transparency. Worst: no account sync, Social Security support basic (manual input only, no claiming wizard), tax thinner than Boldin, setup overwhelm.
- **Boldin** — Best: Roth/tax/SS/IRMAA/RMD depth, generous free tier, education (live classes). Worst: clunky linear UI, partial black box (no SD input, no NIIT/AMT, no ACA-subsidy modeling), changes UI often.
- **Empower** — Best: free aggregation, polished dashboard. Worst: sales calls, sync breakage, no history backfill, data-as-product.
- **Kubera** — Best: alt/crypto/DeFi/illiquid assets, multi-currency, nested portfolios for trusts/LLCs, estate handover, clean UI, privacy. Worst: price ($249/yr), no budgeting, light planning/tax (rough per-asset estimate only).
- **Monarch** — Best: budgeting + collaboration + net-worth breadth. Worst: investment tracking (cost basis ~50%, no allocation, no dividend category).
- **Copilot** — Best: AI categorization, design. Worst: individual-focused, daily-only holdings, immature allocation/classification, blended-account gaps.
- **Fidelity/Vanguard planners** — Best: free, integrated. Worst: linear point-estimates (overly optimistic — no volatility), no FIRE/tax depth, lead-gen for advisory.
- **cFIREsim / FIRECalc / FICalc / Engaging Data** — Best: free, historical rigor (1871+), great visualization ("Rich, Broke or Dead"). Worst: no persistence/accounts, single-purpose.
- **MaxiFi / Pralana** — Best: optimization rigor (consumption smoothing; asset-class SD; uncorrelated assets). Worst: steep learning curve, dated UX.

**Opportunity gaps for Ember:** (1) merge accurate holdings/cost-basis tracking with respected projections in ONE tool; (2) be the most _transparent_ engine (audit the math); (3) model **ACA-subsidy cliffs + NIIT** (verified gaps even in Boldin and ProjectionLab); (4) first-class manual + reliable multi-aggregator sync; (5) household/joint-filing-native modeling (Ember already has joint filing + household onboarding).

## Recommendations (Prioritized Roadmap)

**Tier 1 — Finish table stakes (do first; users leave without these):**

1. **Monte Carlo + historical backtest** with success %, percentile bands, configurable runs, asset-class-specific return/SD (avoid Boldin's missing-SD complaint), and both parametric and historical modes. _(Ember planned; build it to ProjectionLab's transparency bar. High value, high complexity.)_
2. **Withdrawal-sequencing + guardrail drawdown toolkit** (fixed-real, %, GK guardrails, VPW, dynamic; taxable→traditional→Roth ordering; bridge phase). _(Ember planned. High value, high complexity.)_
3. **Scenario comparison / what-if (side-by-side plan forking).** _(Upgrade Ember's partial capability — high demand, moderate complexity. Beat Boldin's buggy compare UI.)_

**Tier 2 — Differentiate (highest loyalty/WTP per unit effort):** 4. **Roth-conversion ladder + bracket-filling modeling** with toggle (lowest-lifetime-tax vs. highest-estate). _(Highest differentiation; high complexity. Boldin is the bar — and even it is a partial "guesstimator," so accuracy + transparency wins.)_ 5. **ACA-subsidy cliff + IRMAA + NIIT + RMD modeling** — fills gaps even Boldin and ProjectionLab have; uniquely valuable to _early_ retirees who are pre-Medicare and ACA-dependent. _(High value, moderate complexity given Ember's existing tax engine. This is Ember's sharpest tax wedge.)_ 6. **"Audit the math" transparency layer** — expose every formula/assumption, editable, traceable through the existing timeline. _(Ember's natural moat; moderate complexity; outsized trust/marketing payoff against the "black box" complaint.)_ 7. **Asset allocation + drift/rebalancing** across all accounts with threshold alerts and tax-aware (location-aware) suggestions. _(Strong-want; moderate complexity; directly beats Monarch's gap.)_

**Tier 3 — Reliability & polish (retention):** 8. **Multi-aggregator sync** (SnapTrade for brokerages, Teller/Plaid for banking) with auto-routing + first-class manual/CSV reconciliation and dedup. _(Ember planned; market manual entry as a feature, not a fallback — it's a genuine edge given universal sync pain.)_ 9. **Privacy-first positioning** + plan export (JSON/CSV) to reduce lock-in anxiety and counter "Empower is free." 10. **FIRE-variant milestones** (Coast/Barista/Lean/Fat) with celebration + custom milestone criteria. _(Low complexity, identity-building, community-shareable.)_ 11. **Fast quick-start onboarding** (5-minute headline number) with progressive disclosure to full depth. _(Low-moderate complexity; addresses the PL "overwhelm" churn.)_

**Benchmarks that would change priorities:**

- If sync-reliability testing shows SnapTrade/Teller cannot reliably cover the top FIRE brokerages (Fidelity, Vanguard, Schwab), **de-prioritize live sync** and double down on manual/CSV + import automation (AI-assisted import like Kubera's).
- If user research shows the audience skews pre-retiree rather than accumulators, **raise Social Security claiming optimization** (a Boldin strength and ProjectionLab weakness) into Tier 2.
- If churn analytics show transparency/trust (not features) driving cancellations, **promote the "audit the math" layer to Tier 1.**

## Caveats

- Much competitor pricing/feature detail comes from review sites and affiliate-driven content (many bloggers earn ~$20/referral for Boldin/Empower signups), which can bias comparisons; vendor pages, help centers, and dated forum posts were prioritized where possible. The ProjectionLab Premium price specifically conflicts across sources ($109 vs $129/yr) — confirm at projectionlab.com/pricing before citing.
- Pricing is current as of early–mid 2026 and changes frequently (ProjectionLab lifetime rose $799→$1,199; Boldin $120→$144).
- "Best/worst" judgments synthesize hands-on reviewer testing (Rob Berger, White Coat Investor) and primary forum sentiment (Bogleheads.org, Early-Retirement.org, Hacker News). Reddit-specific threads (r/financialindependence, r/Fire) were difficult to retrieve directly this session, so FIRE-community sentiment leans on Bogleheads/Early-Retirement — adjacent but slightly older-skewing communities; treat the youngest-accumulator perspective as somewhat under-sampled.
- "Best-in-class" references describe current market leaders, not a ceiling; Ember's stated plan to merge tracking + projection + transparency is itself an untested but defensible wedge, and the ACA/NIIT modeling gap is the most concrete, verifiable opening for a new entrant.

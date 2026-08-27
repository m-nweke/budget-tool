<script setup lang="ts">
const stack = [
  { label: 'Client', value: 'Vue 3 (Composition API, single-file components) + TypeScript, Vite build' },
  { label: 'Server', value: 'Node.js + Express, TypeScript throughout' },
  { label: 'Database', value: 'SQLite via better-sqlite3 — synchronous, transactional, zero external ops' },
  { label: 'Auth', value: 'Session cookie + bcrypt password hashing, no third-party auth provider' },
  { label: 'Testing', value: 'Vitest (server: repository + route/integration tests via supertest)' },
];

const decisions = [
  {
    title: 'Multi-tenancy with a shared schema',
    body:
      "Every enterprise company and every individual's personal budget is a tenant row in the same tables, " +
      'not separate databases or a department-only model bolted on later. One login can hold multiple ' +
      'tenant_memberships (e.g. a personal budget plus a company account), and role/department scoping is ' +
      "resolved per-request from that membership — not from a single global role on the user. That's what " +
      'lets the same codebase serve a department-scoped enterprise approval workflow and a single-owner ' +
      'personal budget without forking the data model.',
  },
  {
    title: 'Role-based scoping resolved server-side, mirrored client-side',
    body:
      'Every route enforces its own access rules (requireRole, tenant-ownership checks on every mutation) — ' +
      'the client-side route guards exist purely to avoid rendering a view that would just 403, never as the ' +
      'actual security boundary. A UI redirect is a UX nicety; the API check is the one that matters.',
  },
  {
    title: 'A synchronous cash-flow simulation, not a scheduled job',
    body:
      "There's no background worker in this deployment. Recurring transactions materialize lazily on request " +
      '(generateDue() runs before any read that could be affected), and the cash-flow projection walks ' +
      "paycheck/debt/bill cadences forward in memory per request. Simpler to reason about and test than a " +
      'job queue, at the cost of a bit more per-request CPU — an acceptable tradeoff at this scale.',
  },
  {
    title: 'Denormalized-by-design outflow attribution',
    body:
      'Paycheck splits are the only inflow tied to a specific bank account; recurring transactions, debts, ' +
      'bills, and investment contributions never were. A bill or investment can optionally link a ' +
      "bank_account_id for display, but the cash-flow simulation still surfaces all of them as a separate " +
      "unattributed outflow list rather than subtracting from that account's own projected balance — an " +
      'explicit modeling choice, not a gap.',
  },
  {
    title: 'Delete-and-reinsert over diffing for owned child rows',
    body:
      "Paycheck splits have no independent lifecycle — updating a paycheck deletes all its splits and " +
      "reinserts the new set, rather than diffing against what's there. Splits carry no history/audit " +
      'requirement a diff would need to preserve, so the simpler approach won.',
  },
  {
    title: 'A documentation workflow enforced by convention, not tooling',
    body:
      "Every commit in this repo's history is one user story, with a matching \"how it works\" doc and a " +
      '"why & tradeoffs" doc. It\'s a discipline choice, not a generated artifact — the story you\'re reading ' +
      'this page from was itself built that way.',
  },
];
</script>

<template>
  <div class="about-view">
    <div class="hero">
      <h1>Budget Tool</h1>
      <p class="tagline">
        A multi-tenant budgeting app supporting both enterprise department budgets with an approval workflow, and
        an individual's personal budget with paychecks, bills, investments, savings goals, debts, and a cash-flow
        simulation.
      </p>
    </div>

    <section class="panel stack-panel">
      <h2>Stack</h2>
      <ul class="stack-list">
        <li v-for="item in stack" :key="item.label">
          <span class="stack-label">{{ item.label }}</span>
          <span class="stack-value">{{ item.value }}</span>
        </li>
      </ul>
    </section>

    <section class="decisions">
      <h2>Architecture &amp; key decisions</h2>
      <div v-for="decision in decisions" :key="decision.title" class="panel decision-card">
        <h3>{{ decision.title }}</h3>
        <p>{{ decision.body }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.about-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 760px;
}

.hero h1 {
  font-size: 2rem;
}

.tagline {
  margin-top: var(--space-3);
  font-size: 1rem;
  line-height: 1.6;
  max-width: 62ch;
}

.stack-panel h2,
.decisions h2 {
  margin-bottom: var(--space-4);
}

.stack-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.stack-list li {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: var(--space-3);
  font-size: 0.9rem;
}

.stack-label {
  font-weight: 600;
  color: var(--color-text);
}

.stack-value {
  color: var(--color-text-muted);
}

.decisions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.decision-card h3 {
  font-size: 1rem;
  margin-bottom: var(--space-2);
}

.decision-card p {
  font-size: 0.9rem;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .stack-list li {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>

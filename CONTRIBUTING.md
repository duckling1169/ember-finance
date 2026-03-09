# Contributing to FIreApp

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/<your-username>/FIreApp.git
   cd FIreApp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) to verify everything is working.

## Branch Naming Convention

Use the following prefixes for branch names:

- `feature/` — New features (e.g., `feature/user-auth`)
- `fix/` — Bug fixes (e.g., `fix/login-redirect`)
- `chore/` — Maintenance tasks (e.g., `chore/update-deps`)
- `docs/` — Documentation updates (e.g., `docs/api-reference`)
- `refactor/` — Code refactoring (e.g., `refactor/auth-module`)

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

<optional body>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

```
feat(auth): add login page
fix(api): handle null response from user endpoint
docs(readme): update installation steps
```

## PR Process

1. Create a feature branch from `main`.
2. Make your changes and commit following the commit message format above.
3. Ensure the project builds without errors (`npm run build`).
4. Run the linter and fix any issues (`npm run lint`).
5. Push your branch and open a Pull Request against `main`.
6. Fill out the PR description with a summary of changes and any relevant context.
7. Request a review from at least one maintainer.
8. Address any review feedback before merging.

## Code Style Guidelines

- **TypeScript** — Use strict typing. Avoid `any` where possible.
- **Components** — Use functional components with React hooks.
- **Styling** — Use Tailwind CSS utility classes. Avoid inline styles and custom CSS unless necessary.
- **Imports** — Use the `@/` path alias for imports from the `src/` directory.
- **Linting** — Run `npm run lint` before committing. All code must pass ESLint checks.
- **Formatting** — Keep files consistent with the existing codebase style.

## BDD (Behavior-Driven Development)

This project follows BDD practices to ensure features are built around expected behavior.

### Writing Specifications

- Write feature specifications in plain language using **Given / When / Then** format.
- Place `.feature` files or spec descriptions alongside the feature they describe.

### Example

```gherkin
Feature: User Login

  Scenario: Successful login with valid credentials
    Given the user is on the login page
    When they enter valid credentials and submit
    Then they should be redirected to the dashboard
```

### Guidelines

- Define behavior **before** writing implementation code.
- Collaborate with stakeholders to write acceptance criteria as BDD scenarios.
- Use descriptive test names that reflect the expected behavior (e.g., `it("should redirect to dashboard after successful login")`).
- Keep scenarios focused on a single behavior — avoid combining multiple assertions into one scenario.

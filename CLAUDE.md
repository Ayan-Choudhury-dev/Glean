# CLAUDE.md

## Purpose

This file defines guidelines and requirements for interacting with AI agents named Claude (from Anthropic) within this project. Follow these guidelines to ensure safe, ethical, and effective use of Claude for development, documentation, and decision-making.

---

## Project-Specific Details

- This project is a React Native application using Supabase for backend functionality.
- Sensitive data such as the Supabase URL and anon key are provided in the `.env` file. **Never share these values or copy them into prompts given to Claude.**
- The project may use Expo for development and deployment.
- Typical use cases for Claude may include:
  - Refactoring React Native components for maintainability, accessibility, or performance.
  - Generating TypeScript types or interfaces, ensuring alignment with Supabase schemas.
  - Writing or improving README, onboarding, or documentation files.
  - Explaining platform-specific differences for iOS and Android via Expo.
  - Assisting with debugging, testing, and proposing improvements—but not replacing human code review.
- All code and documentation generated with Claude should be consistent with team conventions and Expo/Supabase integration best practices.

---

### 1. Responsible Use

- Use Claude as an assistant for tasks such as code suggestions, documentation, bug triage, and code review.
- Do not use Claude to circumvent project conventions, security policies, or review workflows.
- When requesting architectural or code changes, provide Claude with the relevant parts of your Expo, React Native, and Supabase configuration to enable proper context—excluding secrets.

---

### 2. Security & Privacy

- Never share secrets, passwords, API keys, or sensitive data (e.g., anything from `.env`) with Claude.
- Mask or redact confidential information before pasting logs, stack traces, or errors.
- Do not request or suggest that Claude generate authentication credentials or embed secrets into files.
- If asking for help with environment configuration, explicitly state which details are *not* to be public.

---

### 3. Data & Context Guidelines

- When providing context:
  - Give relevant code files, error traces, or configuration *without* sensitive values.
  - Include the structure of Supabase tables or authentication flows only as needed, never credentials.
  - Avoid uploading large binaries or system files.
- Inputs/outputs may be stored/used for product improvement as per Anthropic's [terms of service](https://www.anthropic.com/legal/terms-of-service).

---

### 4. Attribution, Review, and Testing

- All output (code, docs, etc.) from Claude must be reviewed by a project team member before merging.
- Cite Claude in PRs or commits, e.g., "Assisted by Claude".
- Test all code generated or modified by Claude (including Expo builds on both iOS and Android, and Supabase functions).
- Only merge Claude-generated output after successful QA and code review.

---

### 5. Ethical Considerations

- Do not use Claude to generate or promote:
  - Insecure code, hardcoded credentials, or broken authentication flows.
  - Unethical, discriminatory, or non-inclusive solutions.
  - Content violating project policies, third-party licenses, or applicable laws.
- If uncertain, consult a team lead or maintainer.

---

### 6. Updating These Guidelines

- Update this file as workflows or Claude’s capabilities evolve.
- Submit changes via PR for maintainer review.
- Project-specific best practices (e.g., integration with Expo, React Native conventions, Supabase usage) should be reflected as they develop.

---

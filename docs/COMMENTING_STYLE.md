### Commenting Style Guide (Formative, Concise, Actionable)

- **Purpose-first**: Start files and significant functions with a one‑line summary of what they do and why it matters.
- **Inputs/outputs**: For functions that are reused or non-trivial, include short annotations for parameters and returns. Prefer language-native doc styles (e.g., PHPDoc, JSDoc).
- **Guide the reader**: Comments should help future maintainers make correct changes, not narrate obvious code. Focus on invariants, assumptions, and edge cases.
- **Decision rationale**: When behavior is surprising or there are trade-offs, document the reasoning and any operational implications.
- **Avoid noise**: Do not restate the code (“increment i”). Remove apologetic, vague, or chatty comments. Keep tone professional and direct.
- **Security and performance**: Call out security boundaries, validation, rate limits, and performance-sensitive areas explicitly.
- **Consistency**: Use consistent headings and verbs. Keep comments updated when code evolves.

Examples

PHP (PHPDoc)
```php
/**
 * Issue a short-lived access token and a rotating refresh token.
 * @param PDO $pdo Active DB connection
 * @param array $credentials ['username'|'email', 'password']
 * @return void Echoes JSON response and sets HTTP status
 */
```

JavaScript (JSDoc)
```js
/**
 * Attempt refresh with single-flight; clears tokens on failure.
 * @returns {Promise<string|null>} Fresh access token or null when unauthenticated
 */
```

Inline comments
- Use to explain non-obvious checks, fallback orders, or data shape assumptions.
- Prefer imperative voice: "Validate input", "Normalize payload", "Rotate refresh token".


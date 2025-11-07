# Contributing to nestjs-solana-kit

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please note we have a [Code of Conduct](CODE_OF_CONDUCT.md), please follow it in all your interactions with the project.

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 9.0.0
- Git

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/haihv/nestjs-solana-kit.git
cd nestjs-solana-kit

# Install dependencies
pnpm install

# Create a feature branch
git checkout -b feature/your-feature-name
```

## Development Workflow

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:cov
```

### Code Quality
```bash
# Type checking
pnpm type-check

# Linting (with auto-fix)
pnpm lint

# Formatting
pnpm format

# Run all checks (type, lint, build)
pnpm type-check && pnpm lint:check && pnpm build
```

### Building
```bash
# Build the library
pnpm build

# Clean build artifacts
rm -rf dist
```

## Making Changes

### Before You Start
1. Check existing [issues](https://github.com/haihv/nestjs-solana-kit/issues) and [pull requests](https://github.com/haihv/nestjs-solana-kit/pulls)
2. For large changes, open an issue first to discuss
3. Follow the project's [architecture guidelines](docs/ARCHITECTURE.md)

### Code Standards

- **TypeScript**: Strict mode enabled, all code must be typed
- **Formatting**: Use `prettier` with project config
- **Linting**: Pass ESLint checks
- **Tests**: All new features must have tests (aim for >80% coverage)
- **Docs**: Update documentation for API changes

### Naming Conventions

Follow the conventions established in [CLAUDE.md](CLAUDE.md):

- Variables and methods: camelCase
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- Type names: PascalCase (e.g., `BuildTransactionArgs`)
- Service method patterns: `get*`, `send*`, `on*`, `build*`, `is*`

### Type Derivation

All types in `src/solana/types/rpc.types.ts` must be **derived from @solana/kit** using TypeScript utility types (ReturnType, Omit, Awaited, etc.). Never manually redefine types.

See [CLAUDE.md](CLAUDE.md#type-system-architecture) for examples.

## Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests only
- `refactor`: Code refactoring
- `chore`: Build, deps, tooling
- `ci`: CI/CD changes

### Example Commits
```
feat(solana-rpc): add health check endpoint

Implement RPC health checking to verify connection status
before executing operations.

Fixes #123
```

```
fix(solana-account): handle null account info gracefully

Return null instead of throwing when account doesn't exist.
```

## Pull Request Process

1. **Create a feature branch**: `git checkout -b feature/description`
2. **Make your changes**: Write code following the standards above
3. **Write tests**: Add/update tests for your changes
4. **Run checks**: `pnpm type-check && pnpm lint && pnpm test`
5. **Update docs**: Update README or other docs if needed
6. **Commit**: Use conventional commit format
7. **Push**: `git push origin feature/description`
8. **Create PR**: Open PR with clear description
   - Reference any related issues
   - Explain the changes and why
   - List testing done

### PR Title Format
```
type(scope): description

Examples:
- feat(solana-transaction): add transaction retry logic
- fix(solana-subscription): handle disconnection gracefully
- docs(readme): update installation instructions
```

## Testing

### Test Structure
```typescript
// Good test example
describe('SolanaAccountService', () => {
  describe('getBalance', () => {
    it('should return balance in lamports', async () => {
      const result = await service.getBalance(mockAddress);
      expect(result).toBe(BigInt(1000000000));
    });

    it('should throw for invalid address', async () => {
      await expect(service.getBalance('invalid')).rejects.toThrow();
    });
  });
});
```

### Coverage Requirements
- Aim for 80%+ line coverage
- Test happy paths, error paths, and edge cases
- Mock external dependencies (RPC, WebSocket)

## Documentation

### README Updates
Update `README.md` for:
- New features
- API changes
- Installation/setup changes

### Service Documentation
Update `docs/SERVICES.md` for new or modified services.

### Inline Documentation
- All exported functions need JSDoc comments
- Complex logic needs inline comments
- Types should document their structure

## Reporting Issues

### Bug Reports
Create an issue with:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Environment (Node version, OS, etc.)
- Error messages/logs

### Feature Requests
Create an issue with:
- Clear title and description
- Use case and why it's needed
- Proposed solution (if any)
- Alternative approaches

## Release Process (Maintainers)

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit: `chore(release): v1.2.3`
4. Create and push tag: `git tag v1.2.3 && git push origin v1.2.3`
5. GitHub Actions handles publishing to npm

## Questions?

- Open an issue with label `question`
- Join our discussions
- Check existing documentation in `docs/` folder

## License

By contributing, you agree your code will be licensed under MIT License.

Thank you for contributing! 🎉

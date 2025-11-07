# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Initial Release

This is the first public release of nestjs-solana-kit, a comprehensive NestJS library for Solana blockchain integration.

**Commits:**
- `2187734` chore: setup project config and dev tools
- `43e4e7a` ci: add github actions workflows
- `b94ebc8` feat: implement nestjs solana integration library
- `d225696` build: update dependencies and prepare for npm release
- `62615c2` docs: add comprehensive project documentation

### Added

**Core Services:**
- `SolanaModule` with static and async registration patterns
- `SolanaConfigService` - configuration management with getter-based API
- `SolanaRpcService` - RPC client management and health checks
- `SolanaAccountService` - account queries and balance checks
- `SolanaBlockService` - block and epoch information
- `SolanaTransactionService` - transaction building, sending, and confirmation
- `SolanaSubscriptionService` - WebSocket subscriptions
- `SolanaProgramService` - program queries and filtering
- `SolanaUtilsService` - type conversions between SDKs

**Type System:**
- Type-derived API from @solana/kit v5.x (uses TypeScript utility types)
- Automatic type updates when SDK changes
- Full TypeScript strict mode support

**Testing & Quality:**
- 361+ comprehensive tests across 9 test files
- GitHub Actions workflows for CI/CD
- ESLint v9 with flat config
- Prettier v3 code formatting
- Jest v30 with coverage reporting

**Documentation:**
- README with quick start examples
- Complete API reference (docs/SERVICES.md)
- Contributing guide and development workflow
- Code of Conduct (Contributor Covenant v2.0)
- Security policy for vulnerability reporting
- Architecture guidelines (CLAUDE.md)
- GitHub issue and PR templates

**Project Setup:**
- EditorConfig for cross-editor consistency
- npm registry configuration
- TypeScript strict compiler options
- Build scripts for library compilation
- Test automation on Node 18, 20, 24

### Features

- **Modern SDK:** Built on @solana/kit v5.x (modular architecture)
- **Type-Safe:** Derived types matching actual SDK behavior
- **NestJS Native:** Full dependency injection and module patterns
- **Production-Ready:** Error handling, logging, retry logic
- **Flexible Config:** Static or async module registration
- **Real-Time:** WebSocket subscriptions with proper cleanup
- **Backward Compatible:** Supports NestJS v10 and v11

### Versioning

- Node.js: 18+, 20+, 24+ (LTS)
- NestJS: ^10.0.0 || ^11.0.0
- TypeScript: 5.9+
- Development: Latest versions (Jest 30, ESLint 9, Prettier 3)

---

## Release Checklist

When releasing a new version:

1. Update version in `package.json`
2. Update this `CHANGELOG.md` with:
   - New version number and date
   - Added/Changed/Fixed/Removed sections
   - Link to release comparison
3. Create commit: `chore(release): v1.2.3`
4. Create git tag: `git tag v1.2.3`
5. Push: `git push origin main && git push origin v1.2.3`
6. GitHub Actions will automatically:
   - Run full test suite
   - Build the package
   - Publish to npm
   - Create GitHub release

---

## Version Format

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Fixed
- Bug fixes

### Removed
- Deprecated features

### Deprecated
- Soon-to-be removed features

### Security
- Security vulnerability fixes
```

---

## Versioning Policy

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features (backward compatible)
- **PATCH** (0.0.X): Bug fixes (backward compatible)

### Breaking Changes
- Require MAJOR version bump
- Clearly documented in migration guide
- Preceded by deprecation notice in MINOR version
- Minimum 2-week deprecation period

### Supported Versions

| Version | Status | Support Ends |
|---------|--------|--------------|
| 0.1.x | Pre-release | See 1.0.0 |
| 1.x | Active | Current |

---

## Notes for Maintainers

- Always bump versions in `package.json` before tagging
- Write clear, user-focused changelog entries
- Link to related GitHub issues/PRs where relevant
- Keep changelog organized by impact (Added > Changed > Fixed)
- Use "Unreleased" section for development changes

# Security Policy

## Reporting Security Vulnerabilities

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in nestjs-solana-kit, please report it by emailing [haihv27@gmail.com](mailto:haihv27@gmail.com) with:

1. **Description** - What is the vulnerability?
2. **Location** - Where in the code is it?
3. **Severity** - Critical, High, Medium, or Low?
4. **Reproduction Steps** - How to reproduce it?
5. **Suggested Fix** - If you have one

**Please do not disclose the vulnerability publicly until we've had a chance to fix it.**

## Security Response Timeline

- **24 hours**: Acknowledgment of your report
- **7 days**: Initial assessment and plan
- **14 days**: Security patch released
- **30 days**: Public disclosure

Timelines may vary based on severity and complexity.

## Supported Versions

Security updates are provided for:

| Version | Status | Security Updates |
|---------|--------|-----------------|
| 1.x.x | Active | Yes |
| 0.x.x | Pre-release | Best effort |

## Security Best Practices

When using nestjs-solana-kit, follow these security practices:

### Configuration
- **Never hardcode RPC URLs** in code; use environment variables
- **Rotate RPC credentials** regularly
- **Use HTTPS/WSS URLs** for production
- **Validate cluster** before deployment

### Transactions
- **Never expose private keys** in code or logs
- **Sign transactions locally** only
- **Validate instruction data** before signing
- **Use commitment levels** appropriate for your use case

### Dependencies
- **Keep dependencies updated** - Run `pnpm install` regularly
- **Audit dependencies** - Run `pnpm audit` to check for vulnerabilities
- **Review major updates** - Breaking changes may affect security

### Monitoring
- **Log important operations** - Monitor transaction failures
- **Set up alerts** - Alert on unusual RPC errors
- **Track balance changes** - Implement account monitoring
- **Review WebSocket connections** - Ensure proper cleanup

## Vulnerability Reporting Process

1. **Report** - Email security concerns to our security contact
2. **Verify** - We confirm the vulnerability and gather details
3. **Collaborate** - We work with you on a fix
4. **Release** - Security patch is created and tested
5. **Disclose** - Vulnerability details published (after fix)
6. **Credit** - You're credited (if you wish)

## Known Issues

None currently reported.

## Dependencies Security

This project uses the following dependencies:

- **@solana/kit** - Solana's official SDK
- **@nestjs/\*** - NestJS framework packages
- **rxjs** - Reactive programming library

All dependencies are:
- Regularly updated to latest versions
- Scanned for vulnerabilities using `npm audit`
- Vetted for security practices

### Updating Dependencies
```bash
# Check for vulnerabilities
pnpm audit

# Update packages
pnpm update

# Verify tests still pass
pnpm test
```

## Secure Coding Guidelines

Contributors should follow these guidelines:

### Code Review
- All code changes require review
- Security-sensitive code gets extra scrutiny
- Tests must pass before merging

### Cryptography
- Use @solana/kit's built-in crypto functions
- Never implement custom crypto
- Avoid deprecated cryptographic algorithms

### Input Validation
- Validate all inputs (addresses, amounts, etc.)
- Sanitize error messages (don't leak sensitive info)
- Use type system (TypeScript strict mode)

### Logging
- Never log private keys or sensitive data
- Log failed authentication attempts
- Use structured logging for analysis

## Security Checklist for Releases

Before releasing a new version:

- [ ] Run full test suite: `pnpm test`
- [ ] Check for vulnerabilities: `pnpm audit`
- [ ] Update dependencies: `pnpm update`
- [ ] Review security-sensitive changes
- [ ] Check for hardcoded secrets
- [ ] Update CHANGELOG and SECURITY sections
- [ ] Get security review approval

## External Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Web security risks
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/) - Node.js specific
- [Solana Security](https://docs.solana.com/developers/security/) - Solana security guidelines
- [NestJS Security](https://docs.nestjs.com/security/) - NestJS security features

## Contact

- **Security Issues**: [haihv27@gmail.com](mailto:haihv27@gmail.com)
- **General Issues**: [GitHub Issues](https://github.com/haihv/nestjs-solana-kit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/haihv/nestjs-solana-kit/discussions)

Thank you for helping keep nestjs-solana-kit secure! 🛡️

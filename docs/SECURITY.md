# Security

Security considerations and how to report vulnerabilities.

## Responsible disclosure

If you find a security issue, please open a private issue or contact the maintainers directly. Avoid public disclosure until the issue is addressed.

## Hardening recommendations

- Never commit secrets to the repository. Use environment variables and secret management.
- Validate uploads server-side and restrict allowed MIME types.
- Use signed URLs or authenticated uploads for third-party storage (Cloudinary/S3) if possible.
- Rate limit endpoints in production with a robust store (Redis, etc.).
- Sanitize and validate all external data before processing.

## Dependencies

- Keep dependencies updated and audit them periodically.
- Use `npm audit` / Dependabot to detect vulnerable packages.

*** End Patch
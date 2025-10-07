# 🔒 Security Guide for PC Building System

## Overview
This document outlines the security measures implemented in the PC Building System and provides guidelines for maintaining security in production.

## 🛡️ Security Features Implemented

### 1. Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions system
- **Password Security**: Bcrypt hashing with strength validation
- **Account Lockout**: Rate limiting for failed login attempts
- **IP Blocking**: Ability to block suspicious IP addresses

### 2. Input Validation & Sanitization
- **SQL Injection Protection**: Prepared statements throughout
- **XSS Prevention**: HTML entity encoding
- **Input Sanitization**: Type-specific validation and cleaning
- **File Upload Security**: MIME type and size validation

### 3. Security Headers
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Enables browser XSS filtering
- **Content Security Policy**: Restricts resource loading
- **Strict-Transport-Security**: Enforces HTTPS in production

### 4. Rate Limiting & Monitoring
- **Login Rate Limiting**: 5 attempts per 15 minutes
- **OTP Rate Limiting**: 5 requests per hour
- **Security Logging**: Comprehensive audit trail
- **Failed Attempt Tracking**: IP and user-based monitoring

### 5. CORS Security
- **Origin Validation**: Configurable allowed origins
- **Credential Handling**: Secure cookie and header management
- **Preflight Caching**: Optimized CORS performance

## 🚀 Deployment Security Checklist

### Before Deploying to Hostinger

#### 1. Environment Configuration
```bash
# Copy and configure environment file
cp env.example .env

# Update these critical settings:
JWT_SECRET=your_super_secure_64_character_secret_key_here
REFRESH_JWT_SECRET=your_different_64_character_refresh_secret
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
APP_ENV=production
APP_DEBUG=0
```

#### 2. Database Security
- [ ] Change default database passwords
- [ ] Use strong database credentials
- [ ] Enable database SSL if available
- [ ] Regular database backups
- [ ] Limit database user permissions

#### 3. Server Configuration
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure proper file permissions (755 for directories, 644 for files)
- [ ] Set up proper .htaccess rules
- [ ] Disable directory listing
- [ ] Hide server version information

#### 4. Security Headers
- [ ] Verify all security headers are set
- [ ] Test CSP policy doesn't break functionality
- [ ] Ensure HSTS is properly configured

#### 5. Monitoring & Logging
- [ ] Set up log rotation
- [ ] Monitor security logs regularly
- [ ] Set up alerts for suspicious activity
- [ ] Regular security audits

## 🔧 Security Configuration

### JWT Configuration
```php
// In your .env file
JWT_SECRET=your_super_secure_jwt_secret_key_here_change_this_in_production
JWT_EXPIRY=3600  // 1 hour
REFRESH_JWT_SECRET=your_different_refresh_jwt_secret_key_here
REFRESH_JWT_EXPIRY=1209600  // 14 days
```

### Rate Limiting Configuration
```php
LOGIN_MAX_ATTEMPTS=5        // Max failed login attempts
LOGIN_LOCKOUT_TIME=900      // Lockout duration in seconds (15 minutes)
OTP_REQUEST_COOLDOWN=60     // OTP request cooldown in seconds
OTP_MAX_PER_HOUR=5          // Max OTP requests per hour
```

### CORS Configuration
```php
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## 🚨 Security Monitoring

### Key Metrics to Monitor
1. **Failed Login Attempts**: Track by IP and username
2. **Suspicious Activity**: Multiple failed attempts from same IP
3. **Token Usage**: Monitor for token abuse
4. **File Uploads**: Track and validate all uploads
5. **API Usage**: Monitor for unusual patterns

### Security Logs
Security events are logged in the `security_logs` table:
- `login_success` / `login_failed`
- `login_failed_inactive`
- `token_validation_failed`
- `suspicious_activity`
- `file_upload_attempt`

## 🛠️ Security Maintenance

### Regular Tasks
1. **Weekly**: Review security logs
2. **Monthly**: Update dependencies
3. **Quarterly**: Security audit and penetration testing
4. **Annually**: Review and rotate secrets

### Incident Response
1. **Immediate**: Block suspicious IPs
2. **Short-term**: Reset affected user passwords
3. **Long-term**: Update security measures based on findings

## 🔍 Security Testing

### Manual Testing Checklist
- [ ] Test SQL injection attempts
- [ ] Test XSS payloads
- [ ] Test CSRF attacks
- [ ] Test file upload security
- [ ] Test rate limiting
- [ ] Test authentication bypass attempts

### Automated Testing
Consider implementing:
- OWASP ZAP scanning
- Automated security tests in CI/CD
- Dependency vulnerability scanning

## 📋 Security Best Practices

### For Developers
1. **Never commit secrets** to version control
2. **Use prepared statements** for all database queries
3. **Validate all inputs** on both client and server
4. **Keep dependencies updated**
5. **Follow principle of least privilege**

### For Administrators
1. **Regular security updates**
2. **Monitor logs actively**
3. **Use strong passwords**
4. **Enable two-factor authentication** where possible
5. **Regular backups** with secure storage

## 🆘 Emergency Response

### If Security Breach Suspected
1. **Immediately**: Block suspicious IPs
2. **Reset**: All user passwords
3. **Rotate**: JWT secrets
4. **Review**: Security logs
5. **Update**: Security measures

### Contact Information
- **Security Team**: [Your security contact]
- **Hosting Provider**: Hostinger Support
- **Emergency**: [Emergency contact]

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PHP Security Best Practices](https://www.php.net/manual/en/security.php)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)
- [Hostinger Security Guide](https://www.hostinger.com/tutorials/website-security)

---

**Remember**: Security is an ongoing process, not a one-time setup. Regular monitoring and updates are essential for maintaining a secure system.

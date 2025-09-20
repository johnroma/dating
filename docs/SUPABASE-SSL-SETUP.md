# Supabase SSL Certificate Setup

This guide explains how to set up proper SSL certificates for Supabase database connections to resolve the "self-signed certificate in certificate chain" error on Vercel.

## The Problem

When deploying to Vercel, you may encounter this error:

```
Error: self-signed certificate in certificate chain
```

This happens because Vercel's Node.js environment doesn't trust Supabase's SSL certificates by default.

## Solution: Add Supabase CA Certificate

### Method 1: Download from Supabase Dashboard (Recommended)

**Why Option A doesn't work:** The `openssl s_client` command doesn't work with Supabase's pooler endpoint because it doesn't present the CA certificate in the way openssl expects. This is a common issue with database connection poolers.

**Correct approach:**

1. **Download the CA Certificate from Supabase Dashboard:**
   - Go to your Supabase project dashboard
   - Navigate to Settings → Database
   - Under "SSL Configuration", click "Download certificate"
   - Save the `prod-ca-2021.crt` file

2. **Convert to base64:**

   ```bash
   base64 -w0 prod-ca-2021.crt
   ```

3. **Add to Vercel environment variables:**
   ```bash
   PG_CA_CERT_B64=<base64-encoded-certificate>
   ```

**Important:** Certificate files (`.pem`, `.crt`, `.key`) are automatically gitignored and should never be committed to version control. Only use the base64-encoded version in environment variables.

### Method 2: Use the Script

We've provided a script to help you get the certificate:

```bash
./scripts/get-supabase-cert.sh
```

### Method 3: Manual Certificate (Fallback)

If the above methods fail, you can use the standard Supabase CA certificate. Check the [Supabase documentation](https://supabase.com/docs/guides/database/connecting-to-postgres#ssl-certificates) for the latest CA certificate.

## Environment Variables

Once you have the certificate, add it to your Vercel environment variables:

### Option A: Base64 Encoded Certificate

```bash
PG_CA_CERT_B64=LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t...
```

### Option B: PEM Certificate

```bash
PG_CA_CERT="-----BEGIN CERTIFICATE-----
MIIE...
-----END CERTIFICATE-----"
```

## How It Works

The application automatically detects the environment and configures SSL accordingly:

- **Development**: Uses relaxed SSL (`rejectUnauthorized: false`)
- **Production/Vercel**: Uses proper SSL verification with the Supabase CA certificate

## Files Updated

- `src/lib/db/adapters/postgres.ts` - Main database adapter
- `scripts/shared-db-config.ts` - Shared configuration for scripts

## Testing

After setting up the certificate:

1. Deploy to Vercel
2. Check the logs for SSL errors
3. Verify database connections work properly

## Troubleshooting

If you still get SSL errors:

1. Verify the certificate is correctly set in Vercel environment variables
2. Check that the certificate is valid and not expired
3. Ensure the certificate matches your Supabase region
4. Try using the direct database endpoint instead of the pooler

## Alternative: Disable SSL Verification (Not Recommended)

If you can't get the certificate working, you can temporarily disable SSL verification by setting:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**Warning**: This makes your connection insecure and should only be used for testing.

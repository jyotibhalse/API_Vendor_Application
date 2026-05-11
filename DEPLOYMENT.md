# Deployment Guide

## Prerequisites
- A Linux server (Ubuntu 22.04 recommended) with Docker + Docker Compose installed
- A domain name pointed at your server's IP
- SSL certificate (Certbot / Let's Encrypt)

## Quick Start

### 1. Clone and configure
```bash
git clone <your-repo> /opt/api-vendor
cd /opt/api-vendor
cp api-backend-fixed/.env.example api-backend-fixed/.env
# Fill in your real values in .env
```

### 2. Start services
```bash
cd api-backend-fixed
docker compose up -d
```
Backend runs on port 8000, frontend on port 80.

### 3. Enable SSL with Certbot
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 4. Nginx reverse proxy (optional, for single domain)
Point `api.yourdomain.com` to port 8000 and `yourdomain.com` to port 80.

## GitHub Actions CI/CD

Set these secrets in your GitHub repo (Settings → Secrets):

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Your Docker Hub username |
| `DOCKER_PASSWORD` | Your Docker Hub password / token |
| `SERVER_HOST` | Your server's IP or domain |
| `SERVER_USER` | SSH user (usually `root` or `ubuntu`) |
| `SERVER_SSH_KEY` | Private SSH key for the server |
| `VITE_API_URL` | Full URL to your backend API |

Every push to `main` will auto-build and deploy.

## Required .env values before going live
- `SECRET_KEY` — 64-char random string (`openssl rand -hex 32`)
- `POSTGRES_PASSWORD` — strong DB password
- `EMAIL_USER` + `EMAIL_PASSWORD` — Gmail App Password for OTP emails
- `PHONEPE_MERCHANT_ID` + `PHONEPE_SALT_KEY` — for live payments

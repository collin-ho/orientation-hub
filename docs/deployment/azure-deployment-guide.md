# Azure Deployment Guide - Feedback Forms App

## 🚀 **Deployment Architecture Options**

### **Option 1: Azure App Service (Recommended)**

```
┌─ Azure App Service ─────────────────┐
│  ┌─ Backend (Node.js) ──────────┐   │
│  │  • index.js                  │   │  
│  │  • services/                 │   │
│  │  • No .env file!             │   │
│  │  • Reads from process.env    │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌─ Frontend (React) ───────────┐   │
│  │  • Built static files        │   │
│  │  • Served by Express         │   │
│  │  • No secrets needed         │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
         ↓ Secrets from
┌─ Application Settings ──────────────┐
│  CLICKUP_TOKEN=pk_xxx...            │
│  MICROSOFT_CLIENT_ID=abc123...      │
│  MICROSOFT_CLIENT_SECRET=xyz789...  │
│  MICROSOFT_TENANT_ID=def456...      │
│  ORIENTATION_FROM_EMAIL=...         │
└─────────────────────────────────────┘
```

## 🔑 **Secret Management in Azure**

### **Azure App Service Application Settings**

**Where:** Azure Portal → App Services → Your App → Configuration → Application Settings

**How it works:**
1. You set environment variables in Azure portal
2. Azure securely injects them into your app as `process.env.VARIABLE_NAME`
3. Your existing code works unchanged!

```javascript
// Your existing code works as-is in Azure:
const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN;
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
```

**Security Benefits:**
✅ Encrypted at rest and in transit  
✅ Only accessible to your app  
✅ Not visible in logs  
✅ Can be updated without redeployment  
✅ Role-based access control  

### **Setup Process:**

#### **1. Deploy Your App Code (No Secrets)**
```bash
# Your app code goes to Azure WITHOUT any .env file
git push azure main
# or
az webapp up --name your-app-name
```

#### **2. Configure Secrets in Azure Portal**
```
Azure Portal → App Services → your-app → Configuration → Application Settings

Add these settings:
┌─────────────────────────────────────────────────────────────┐
│ Name                      │ Value                           │
├─────────────────────────────────────────────────────────────┤
│ CLICKUP_TOKEN            │ pk_your_actual_token_here        │
│ MICROSOFT_CLIENT_ID      │ your-azure-app-client-id        │
│ MICROSOFT_CLIENT_SECRET  │ your-azure-app-client-secret    │
│ MICROSOFT_TENANT_ID      │ your-organization-tenant-id     │
│ ORIENTATION_FROM_EMAIL   │ orientation@cogentanalytics.com │
│ NODE_ENV                 │ production                      │
│ PORT                     │ 8000                            │
└─────────────────────────────────────────────────────────────┘
```

#### **3. Your Code Automatically Works**
```javascript
// No changes needed - same code works locally and in Azure!
require('dotenv').config(); // Safely ignored in production

const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN; // ✅ Works everywhere
```

## 🏗️ **Advanced: Azure Key Vault Integration**

For **highly sensitive secrets**, integrate with Azure Key Vault:

### **Benefits:**
- Hardware-level security (HSM)
- Automatic secret rotation
- Audit logs for all access
- Fine-grained access control

### **Setup:**
```bash
# 1. Create Key Vault
az keyvault create --name your-keyvault --resource-group your-rg

# 2. Add secrets to Key Vault
az keyvault secret set --vault-name your-keyvault --name "ClickUpToken" --value "pk_your_token"
az keyvault secret set --vault-name your-keyvault --name "MicrosoftClientSecret" --value "your_secret"

# 3. Enable Managed Identity for your App Service
az webapp identity assign --name your-app --resource-group your-rg

# 4. Grant Key Vault access to your app
az keyvault set-policy --name your-keyvault --object-id your-app-identity --secret-permissions get
```

### **Reference Secrets in App Service:**
```
Application Settings:
┌──────────────────────────────────────────────────────────────────┐
│ Name                 │ Value                                       │
├──────────────────────────────────────────────────────────────────┤
│ CLICKUP_TOKEN       │ @Microsoft.KeyVault(SecretUri=https://...)  │
│ CLIENT_SECRET       │ @Microsoft.KeyVault(SecretUri=https://...)  │
└──────────────────────────────────────────────────────────────────┘
```

## 🔄 **Development vs Production Environments**

### **Best Practice: Separate App Services**

```
┌─ Development Environment ────────────┐    ┌─ Production Environment ──────────┐
│  feedback-forms-dev.azurewebsites    │    │  feedback-forms.azurewebsites     │
│                                      │    │                                   │
│  Application Settings:               │    │  Application Settings:            │
│  • CLICKUP_TOKEN=pk_dev_token...     │    │  • CLICKUP_TOKEN=pk_prod_token... │
│  • MICROSOFT_CLIENT_ID=dev_id...     │    │  • MICROSOFT_CLIENT_ID=prod_id... │
│  • NODE_ENV=development              │    │  • NODE_ENV=production            │
│  • Different email/tenant IDs       │    │  • Production email/tenant IDs   │
└──────────────────────────────────────┘    └───────────────────────────────────┘
```

## 📋 **Deployment Checklist**

### **Pre-Deployment:**
- [ ] Remove all `.env` files from deployment package
- [ ] Test that app works with environment variables
- [ ] Create separate ClickUp tokens for dev/prod
- [ ] Get Azure credentials from admin (use your email request!)

### **During Deployment:**
- [ ] Deploy code to Azure App Service
- [ ] Configure Application Settings in Azure Portal
- [ ] Test each secret is working (use test endpoints)
- [ ] Enable Application Insights for monitoring

### **Post-Deployment:**
- [ ] Test all functionality (calendar invites, ClickUp integration)
- [ ] Set up monitoring and alerts
- [ ] Document the deployment process
- [ ] Train team on updating secrets in Azure

## 🛡️ **Security Best Practices in Azure**

### **1. Managed Identity (Highly Recommended)**
```javascript
// Use managed identity instead of client secrets where possible
const { DefaultAzureCredential } = require('@azure/identity');
const credential = new DefaultAzureCredential();
```

### **2. Restrict App Service Access**
```
Azure Portal → App Service → Networking → Access Restrictions
• Only allow access from your organization's IP ranges
• Block public internet access if possible
```

### **3. Enable Diagnostic Logging**
```
Azure Portal → App Service → Monitoring → App Service logs
• Enable application logging
• Enable detailed error messages
• Monitor for unauthorized access attempts
```

## 🎯 **Summary: Your Secrets Journey**

```
Local Development:
├── .env file (contains secrets)
├── .gitignore (excludes .env)  ✅ Now fixed!
└── Your app reads process.env

Azure Development:
├── No .env file (not deployed)
├── Azure Application Settings (contains secrets)
└── Your app reads process.env (same code!)

Azure Production:
├── No .env file (not deployed) 
├── Azure Application Settings OR Key Vault
└── Your app reads process.env (same code!)
```

**The beauty:** Your Node.js code doesn't change between environments! `process.env.CLICKUP_TOKEN` works everywhere. 🎉 
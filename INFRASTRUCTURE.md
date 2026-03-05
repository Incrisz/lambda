# Uniti ID Verification Infrastructure

## Production Environment

| Service | Name | Details |
|---------|------|---------|
| **S3** | `uniti-id-verification-bucket` | Document & selfie storage |
| **Lambda** | `uniti-textract-id-analyzer` | ID document extraction (512MB, 60s timeout) |
| **Lambda** | `uniti-selfie-verification` | Face detection & verification (256MB, 30s timeout) |
| **API Gateway** | `91ohru6lw5` | REST API with `/prod` stage |
| **IAM Roles** | `uniti-textract-id-analyzer-role` | S3, Textract, CloudWatch permissions |
| **IAM Roles** | `uniti-selfie-verification-role` | S3, Rekognition, CloudWatch permissions |

### Production Endpoints
```
POST https://91ohru6lw5.execute-api.us-east-1.amazonaws.com/prod/textract
POST https://91ohru6lw5.execute-api.us-east-1.amazonaws.com/prod/selfie
```

---

## Staging Environment

| Service | Name | Details |
|---------|------|---------|
| **S3** | `uniti-id-verification-staging` | Document & selfie storage |
| **Lambda** | `uniti-staging-textract-id-analyzer` | ID document extraction (512MB, 60s timeout) |
| **Lambda** | `uniti-staging-selfie-verification` | Face detection & verification (256MB, 30s timeout) |
| **API Gateway** | `9ons2gxhza` | REST API with `/staging` stage |
| **IAM Roles** | `uniti-staging-textract-id-analyzer-role` | S3, Textract, CloudWatch permissions |
| **IAM Roles** | `uniti-staging-selfie-verification-role` | S3, Rekognition, CloudWatch permissions |

### Staging Endpoints
```
POST https://9ons2gxhza.execute-api.us-east-1.amazonaws.com/staging/textract
POST https://9ons2gxhza.execute-api.us-east-1.amazonaws.com/staging/selfie
```

---

## Key Dependencies
- **AWS Textract**: Document analysis
- **AWS Rekognition**: Face detection & biometric attributes
- **Google Gemini AI**: ID validation & field extraction
- **Node.js 22.x**: Lambda runtime
- **Region**: us-east-1

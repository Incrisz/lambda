# Creating AWS Lambda Functions - Step-by-Step Guide

Complete walkthrough of creating both identity verification Lambda functions using AWS CLI.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create S3 Bucket](#step-1-create-s3-bucket)
3. [Step 2: Create IAM Roles](#step-2-create-iam-roles)
4. [Step 3: Create Textract Function](#step-3-create-textract-function)
5. [Step 4: Create Selfie Function](#step-4-create-selfie-function)
6. [Step 5: Attach Policies to Roles](#step-5-attach-policies-to-roles)
7. [Step 6: Test the Functions](#step-6-test-the-functions)
8. [Step 7: Deploy with Environment Variables](#step-7-deploy-with-environment-variables)
9. [Step 8: Create API Gateway](#step-8-create-api-gateway)

---

## Prerequisites

Before starting, ensure you have:
- AWS CLI installed and configured (`aws configure`)
- Node.js 18+ installed
- AWS Account with sufficient permissions
- Google Gemini API key (for Textract function)
- Correct AWS region (this guide uses `us-east-1`)

### Verify AWS CLI Setup
```bash
aws sts get-caller-identity
```

This should return your account details. If it fails, run `aws configure` first.

---

## Step 1: Create S3 Bucket

Create an S3 bucket to store ID documents and selfie images.

```bash
# Set bucket name (must be globally unique)
BUCKET_NAME="id-verification-bucket"

# Create the bucket
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region us-east-1 \
  --create-bucket-configuration LocationConstraint=us-east-1

# Enable versioning (optional but recommended)
aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket $BUCKET_NAME \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }
    ]
  }'

echo "Bucket created: $BUCKET_NAME"
```

**Save the bucket name** - you'll need it for environment variables.

---

## Step 2: Create IAM Roles

### 2.1: Create Trust Policy Document

Create a file called `trust-policy.json`:

```bash
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
```

### 2.2: Create Textract Lambda Role

```bash
# Create role for Textract function
aws iam create-role \
  --role-name textract-id-analyzer-role \
  --assume-role-policy-document file://trust-policy.json \
  --region us-east-1

# Save the role ARN
TEXTRACT_ROLE_ARN=$(aws iam get-role --role-name textract-id-analyzer-role --query 'Role.Arn' --output text)
echo "Textract Role ARN: $TEXTRACT_ROLE_ARN"
```

### 2.3: Create Selfie Lambda Role

```bash
# Create role for Selfie function
aws iam create-role \
  --role-name selfie-verification-role \
  --assume-role-policy-document file://trust-policy.json \
  --region us-east-1

# Save the role ARN
SELFIE_ROLE_ARN=$(aws iam get-role --role-name selfie-verification-role --query 'Role.Arn' --output text)
echo "Selfie Role ARN: $SELFIE_ROLE_ARN"
```

---

## Step 3: Create Textract Function

### 3.1: Prepare the Function Code

Navigate to the textract directory and install dependencies:

```bash
cd textract/
npm install
```

### 3.2: Package the Function

```bash
# Create deployment package
zip -r textract-function.zip . \
  -x "node_modules/.bin/*" \
  "*.git*" \
  ".DS_Store"

# Verify the zip file
unzip -l textract-function.zip | head -20

echo "Package created: textract-function.zip"
```

### 3.3: Create Function with AWS CLI

```bash
# Deploy the function
aws lambda create-function \
  --function-name textract-id-analyzer \
  --runtime nodejs22.x \
  --role $TEXTRACT_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://textract-function.zip \
  --timeout 60 \
  --memory-size 512 \
  --region us-east-1

echo "Textract function created successfully!"
```

### 3.4: Add Environment Variables

```bash
# Set environment variables for Textract function
aws lambda update-function-configuration \
  --function-name textract-id-analyzer \
  --environment "Variables={BUCKET_NAME=$BUCKET_NAME,GEMINI_API_KEY=your-gemini-api-key}" \
  --region us-east-1

echo "Environment variables set for Textract function"
```

**Important**: Replace `your-gemini-api-key` with your actual Gemini API key from Google Cloud.

---

## Step 4: Create Selfie Function

### 4.1: Prepare the Function Code

Navigate to the selfie directory:

```bash
cd ../selfie/
npm install
```

### 4.2: Package the Function

```bash
# Create deployment package
zip -r selfie-function.zip . \
  -x "node_modules/.bin/*" \
  "*.git*" \
  ".DS_Store"

# Verify the zip file
unzip -l selfie-function.zip | head -20

echo "Package created: selfie-function.zip"
```

### 4.3: Create Function with AWS CLI

```bash
# Deploy the function
aws lambda create-function \
  --function-name selfie-verification \
  --runtime nodejs22.x \
  --role $SELFIE_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://selfie-function.zip \
  --timeout 30 \
  --memory-size 256 \
  --region us-east-1

echo "Selfie function created successfully!"
```

### 4.4: Add Environment Variables

```bash
# Set environment variables for Selfie function
aws lambda update-function-configuration \
  --function-name selfie-verification \
  --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" \
  --region us-east-1

echo "Environment variables set for Selfie function"
```

---

## Step 5: Attach Policies to Roles

### 5.1: Textract Function Policies

#### Policy 1: S3 Access

```bash
cat > textract-s3-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:*",
                "s3-object-lambda:*"
            ],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name textract-id-analyzer-role \
  --policy-name textract-s3-policy \
  --policy-document file://textract-s3-policy.json
```

#### Policy 2: Textract Access

```bash
cat > textract-textract-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "textract:*"
            ],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name textract-id-analyzer-role \
  --policy-name textract-textract-policy \
  --policy-document file://textract-textract-policy.json
```

#### Policy 3: CloudWatch Logs

```bash
cat > textract-logs-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "logs:CreateLogGroup",
            "Resource": "arn:aws:logs:us-east-1:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:logs:us-east-1:*:log-group:/aws/lambda/textract-id-analyzer:*"
            ]
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name textract-id-analyzer-role \
  --policy-name textract-logs-policy \
  --policy-document file://textract-logs-policy.json
```

### 5.2: Selfie Function Policies

#### Policy 1: Rekognition Access

```bash
cat > selfie-rekognition-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "rekognition:*"
            ],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name selfie-verification-role \
  --policy-name selfie-rekognition-policy \
  --policy-document file://selfie-rekognition-policy.json
```

#### Policy 2: S3 Access

```bash
cat > selfie-s3-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:*",
                "s3-object-lambda:*"
            ],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name selfie-verification-role \
  --policy-name selfie-s3-policy \
  --policy-document file://selfie-s3-policy.json
```

#### Policy 3: CloudWatch Logs

```bash
cat > selfie-logs-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "logs:CreateLogGroup",
            "Resource": "arn:aws:logs:us-east-1:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:logs:us-east-1:*:log-group:/aws/lambda/selfie-verification:*"
            ]
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name selfie-verification-role \
  --policy-name selfie-logs-policy \
  --policy-document file://selfie-logs-policy.json
```

---

## Step 6: Test the Functions

### 6.1: Verify Functions Are Created

```bash
# List all Lambda functions
aws lambda list-functions --region us-east-1 --query 'Functions[*].[FunctionName,LastModified]' --output table
```

### 6.2: Get Function Details

```bash
# Get Textract function details
aws lambda get-function \
  --function-name textract-id-analyzer \
  --region us-east-1 \
  --query 'Configuration.[FunctionName,Runtime,Role,Handler]' \
  --output table

# Get Selfie function details
aws lambda get-function \
  --function-name selfie-verification \
  --region us-east-1 \
  --query 'Configuration.[FunctionName,Runtime,Role,Handler]' \
  --output table
```

### 6.3: Test with Sample Payload

Create a test event file `test-payload.json`:

```bash
# For Textract function
cat > textract-test.json << 'EOF'
{
  "frontImage": "base64-encoded-front-image-here",
  "backImage": "base64-encoded-back-image-here",
  "userId": "test-user-123"
}
EOF

# Invoke the function
aws lambda invoke \
  --function-name textract-id-analyzer \
  --payload file://textract-test.json \
  --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  response-textract.json

# View the response
cat response-textract.json
```

```bash
# For Selfie function
cat > selfie-test.json << 'EOF'
{
  "image": "base64-encoded-selfie-image-here",
  "userId": "test-user-123"
}
EOF

# Invoke the function
aws lambda invoke \
  --function-name selfie-verification \
  --payload file://selfie-test.json \
  --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  response-selfie.json

# View the response
cat response-selfie.json
```

---

## Step 7: Deploy with Environment Variables

### 7.1: Update Textract Function Code

```bash
cd textract/
zip -r textract-function.zip . -x "node_modules/.bin/*" "*.git*" ".DS_Store"

aws lambda update-function-code \
  --function-name textract-id-analyzer \
  --zip-file fileb://textract-function.zip \
  --region us-east-1

echo "Textract function code updated"
```

### 7.2: Update Selfie Function Code

```bash
cd ../selfie/
zip -r selfie-function.zip . -x "node_modules/.bin/*" "*.git*" ".DS_Store"

aws lambda update-function-code \
  --function-name selfie-verification \
  --zip-file fileb://selfie-function.zip \
  --region us-east-1

echo "Selfie function code updated"
```

### 7.3: Verify Environment Variables

```bash
# Check Textract environment variables
aws lambda get-function-configuration \
  --function-name textract-id-analyzer \
  --region us-east-1 \
  --query 'Environment.Variables' \
  --output json

# Check Selfie environment variables
aws lambda get-function-configuration \
  --function-name selfie-verification \
  --region us-east-1 \
  --query 'Environment.Variables' \
  --output json
```

---

## Step 8: Create API Gateway

Your client app needs to communicate with the Lambda functions through API Gateway. Follow these steps to set up the REST API.

### 8.1: Create REST API

```bash
# Create the REST API
API_ID=$(aws apigateway create-rest-api \
  --name id-verification-api \
  --description "ID Verification API for document and selfie verification" \
  --region us-east-1 \
  --query 'id' \
  --output text)

echo "API ID: $API_ID"

# Get the root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region us-east-1 \
  --query 'items[0].id' \
  --output text)

echo "Root Resource ID: $ROOT_ID"
```

### 8.2: Create Textract Endpoint

```bash
# Create /textract resource
TEXTRACT_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part textract \
  --region us-east-1 \
  --query 'id' \
  --output text)

echo "Textract Resource ID: $TEXTRACT_RESOURCE"

# Create POST method for /textract
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $TEXTRACT_RESOURCE \
  --http-method POST \
  --authorization-type NONE \
  --region us-east-1

# Integrate with Textract Lambda
# Replace YOUR_ACCOUNT_ID with your actual AWS Account ID
YOUR_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $TEXTRACT_RESOURCE \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:$YOUR_ACCOUNT_ID:function:textract-id-analyzer/invocations" \
  --region us-east-1

echo "Textract endpoint created: /textract"
```

### 8.3: Create Selfie Endpoint

```bash
# Create /selfie resource
SELFIE_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part selfie \
  --region us-east-1 \
  --query 'id' \
  --output text)

echo "Selfie Resource ID: $SELFIE_RESOURCE"

# Create POST method for /selfie
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $SELFIE_RESOURCE \
  --http-method POST \
  --authorization-type NONE \
  --region us-east-1

# Integrate with Selfie Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $SELFIE_RESOURCE \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:$YOUR_ACCOUNT_ID:function:selfie-verification/invocations" \
  --region us-east-1

echo "Selfie endpoint created: /selfie"
```

### 8.4: Grant API Gateway Permission to Invoke Lambda Functions

```bash
# For Textract Lambda
aws lambda add-permission \
  --function-name textract-id-analyzer \
  --statement-id apigateway-textract-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:$YOUR_ACCOUNT_ID:$API_ID/*/*" \
  --region us-east-1

echo "Permission granted for API Gateway to invoke Textract Lambda"

# For Selfie Lambda
aws lambda add-permission \
  --function-name selfie-verification \
  --statement-id apigateway-selfie-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:$YOUR_ACCOUNT_ID:$API_ID/*/*" \
  --region us-east-1

echo "Permission granted for API Gateway to invoke Selfie Lambda"
```

### 8.5: Create API Deployment

```bash
# Create deployment to prod stage
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region us-east-1

# Get the API endpoint URL
API_ENDPOINT="https://$API_ID.execute-api.us-east-1.amazonaws.com/prod"
echo "========================================"
echo "API Gateway Deployment Complete!"
echo "========================================"
echo "API Endpoint: $API_ENDPOINT"
echo "Textract URL: $API_ENDPOINT/textract"
echo "Selfie URL:   $API_ENDPOINT/selfie"
echo "========================================"
```

















































### 8.6: Test the Endpoints

```bash
# Test Textract endpoint with sample data
curl -X POST $API_ENDPOINT/textract \
  -H "Content-Type: application/json" \
  -d '{
    "frontImage": "base64-encoded-front-image",
    "backImage": "base64-encoded-back-image",
    "userId": "test-user-123"
  }'

# Test Selfie endpoint with sample data
curl -X POST $API_ENDPOINT/selfie \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64-encoded-selfie-image",
    "userId": "test-user-123"
  }'
```


### API Gateway Management
```bash
# List all APIs
aws apigateway get-rest-apis --region us-east-1 --query 'items[*].[name,id]' --output table

# Get API Gateway details
aws apigateway get-rest-api --rest-api-id <API_ID> --region us-east-1

# Get all resources in API
aws apigateway get-resources --rest-api-id <API_ID> --region us-east-1 --query 'items[*].[pathPart,id]' --output table

# Update deployment (after code changes)
aws apigateway create-deployment --rest-api-id <API_ID> --stage-name prod --region us-east-1

# Delete API Gateway
aws apigateway delete-rest-api --rest-api-id <API_ID> --region us-east-1
```

### Update Function Configuration
```bash
# Update Textract timeout
aws lambda update-function-configuration \
  --function-name textract-id-analyzer \
  --timeout 120 \
  --region us-east-1

# Update Selfie memory
aws lambda update-function-configuration \
  --function-name selfie-verification \
  --memory-size 512 \
  --region us-east-1
```

### Delete Functions
```bash
# Delete functions if needed
aws lambda delete-function --function-name textract-id-analyzer --region us-east-1
aws lambda delete-function --function-name selfie-verification --region us-east-1

# Delete roles
aws iam delete-role --role-name textract-id-analyzer-role
aws iam delete-role --role-name selfie-verification-role

# Delete S3 bucket
aws s3 rb s3://$BUCKET_NAME --force
```

---

## Complete Automated Script

Save this as `deploy.sh` to run everything at once:

```bash
#!/bin/bash

set -e

echo "=== AWS Lambda Deployment Script ==="

# Variables
REGION="us-east-1"
BUCKET_NAME="id-verification-bucket-$(date +%s)"
GEMINI_API_KEY="your-gemini-api-key"

echo "Step 1: Creating S3 bucket..."
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $REGION \
  --create-bucket-configuration LocationConstraint=$REGION

echo "Step 2: Creating IAM roles..."
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role --role-name textract-id-analyzer-role --assume-role-policy-document file://trust-policy.json
aws iam create-role --role-name selfie-verification-role --assume-role-policy-document file://trust-policy.json

TEXTRACT_ROLE_ARN=$(aws iam get-role --role-name textract-id-analyzer-role --query 'Role.Arn' --output text)
SELFIE_ROLE_ARN=$(aws iam get-role --role-name selfie-verification-role --query 'Role.Arn' --output text)

echo "Step 3: Packaging and deploying Textract..."
cd textract/
npm install
zip -r textract-function.zip . -x "node_modules/.bin/*" "*.git*" ".DS_Store"

aws lambda create-function \
  --function-name textract-id-analyzer \
  --runtime nodejs22.x \
  --role $TEXTRACT_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://textract-function.zip \
  --timeout 60 \
  --memory-size 512 \
  --region $REGION

aws lambda update-function-configuration \
  --function-name textract-id-analyzer \
  --environment "Variables={BUCKET_NAME=$BUCKET_NAME,GEMINI_API_KEY=$GEMINI_API_KEY}" \
  --region $REGION

echo "Step 4: Packaging and deploying Selfie..."
cd ../selfie/
npm install
zip -r selfie-function.zip . -x "node_modules/.bin/*" "*.git*" ".DS_Store"

aws lambda create-function \
  --function-name selfie-verification \
  --runtime nodejs22.x \
  --role $SELFIE_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://selfie-function.zip \
  --timeout 30 \
  --memory-size 256 \
  --region $REGION

aws lambda update-function-configuration \
  --function-name selfie-verification \
  --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" \
  --region $REGION

echo "Step 5: Attaching IAM policies..."
# [Run commands from Step 5 above]

echo "=== Deployment Complete! ==="
echo "Bucket: $BUCKET_NAME"
echo "Textract Role: $TEXTRACT_ROLE_ARN"
echo "Selfie Role: $SELFIE_ROLE_ARN"
```

Make it executable and run:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `NoCredentialsError` | Run `aws configure` and verify credentials |
| `InvalidParameterValueException` | Check function configuration and IAM role ARN |
| `AccessDenied` | Verify IAM policies are attached to the role |
| `Function not found` | Ensure function name matches exactly (case-sensitive) |
| `Code object already exists` | Delete old function first or use different name |

---

## Next Steps

1. Integration with API Gateway (optional)
2. Set up CI/CD pipeline for automatic updates
3. Configure CloudWatch alarms for monitoring
4. Test with real ID documents and selfies
5. Set up AWS DynamoDB for result storage


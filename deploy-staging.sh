#!/bin/bash

set -e

echo "========================================="
echo "🚀 AWS Lambda Staging Deployment Script"
echo "========================================="

# Variables
REGION="us-east-1"
BUCKET_NAME="uniti-id-verification-staging"
GEMINI_API_KEY=$(aws lambda get-function-configuration --function-name uniti-textract-id-analyzer --region $REGION --query 'Environment.Variables.GEMINI_API_KEY' --output text)

echo ""
echo "Step 1: Creating Staging S3 bucket..."
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $REGION

echo "✓ S3 bucket created: $BUCKET_NAME"

# Enable versioning and encryption (optional)
aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

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

echo ""
echo "Step 2: Creating Staging IAM roles..."

# Create trust policy
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

# Create Textract staging role
aws iam create-role \
  --role-name uniti-staging-textract-id-analyzer-role \
  --assume-role-policy-document file://trust-policy.json \
  --region $REGION 2>/dev/null || echo "⚠ Role uniti-staging-textract-id-analyzer-role already exists"

TEXTRACT_ROLE_ARN=$(aws iam get-role --role-name uniti-staging-textract-id-analyzer-role --query 'Role.Arn' --output text)
echo "✓ Textract Staging Role ARN: $TEXTRACT_ROLE_ARN"

# Create Selfie staging role
aws iam create-role \
  --role-name uniti-staging-selfie-verification-role \
  --assume-role-policy-document file://trust-policy.json \
  --region $REGION 2>/dev/null || echo "⚠ Role uniti-staging-selfie-verification-role already exists"

SELFIE_ROLE_ARN=$(aws iam get-role --role-name uniti-staging-selfie-verification-role --query 'Role.Arn' --output text)
echo "✓ Selfie Staging Role ARN: $SELFIE_ROLE_ARN"

echo ""
echo "Step 3: Attaching IAM policies..."

# Textract S3 Policy
cat > textract-s3-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:*", "s3-object-lambda:*"],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name uniti-staging-textract-id-analyzer-role \
  --policy-name textract-s3-policy \
  --policy-document file://textract-s3-policy.json 2>/dev/null || echo "⚠ Policy already exists"

# Textract Textract Policy
cat > textract-textract-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["textract:*"],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name uniti-staging-textract-id-analyzer-role \
  --policy-name textract-textract-policy \
  --policy-document file://textract-textract-policy.json 2>/dev/null || echo "⚠ Policy already exists"

# Textract Logs Policy
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
            "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
            "Resource": ["arn:aws:logs:us-east-1:*:log-group:/aws/lambda/uniti-staging-textract-id-analyzer:*"]
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name uniti-staging-textract-id-analyzer-role \
  --policy-name textract-logs-policy \
  --policy-document file://textract-logs-policy.json 2>/dev/null || echo "⚠ Policy already exists"

# Selfie Rekognition Policy
cat > selfie-rekognition-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["rekognition:*"],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name uniti-staging-selfie-verification-role \
  --policy-name selfie-rekognition-policy \
  --policy-document file://selfie-rekognition-policy.json 2>/dev/null || echo "⚠ Policy already exists"

# Selfie S3 Policy
cat > selfie-s3-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:*", "s3-object-lambda:*"],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name uniti-staging-selfie-verification-role \
  --policy-name selfie-s3-policy \
  --policy-document file://selfie-s3-policy.json 2>/dev/null || echo "⚠ Policy already exists"

# Selfie Logs Policy
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
            "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
            "Resource": ["arn:aws:logs:us-east-1:*:log-group:/aws/lambda/uniti-staging-selfie-verification:*"]
        }
    ]
}
EOF

aws iam put-role-policy \
  --role-name uniti-staging-selfie-verification-role \
  --policy-name selfie-logs-policy \
  --policy-document file://selfie-logs-policy.json 2>/dev/null || echo "⚠ Policy already exists"

echo "✓ Policies attached"

echo ""
echo "Step 4: Packaging and deploying Staging Lambda functions..."

# Textract Function
cd textract/
zip -r textract-function.zip . -x "node_modules/.bin/*" "*.git*" ".DS_Store" > /dev/null

aws lambda create-function \
  --function-name uniti-staging-textract-id-analyzer \
  --runtime nodejs22.x \
  --role $TEXTRACT_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://textract-function.zip \
  --timeout 60 \
  --memory-size 512 \
  --region $REGION 2>/dev/null || echo "⚠ Function uniti-staging-textract-id-analyzer already exists, updating..."

aws lambda update-function-code \
  --function-name uniti-staging-textract-id-analyzer \
  --zip-file fileb://textract-function.zip \
  --region $REGION > /dev/null

aws lambda update-function-configuration \
  --function-name uniti-staging-textract-id-analyzer \
  --environment "Variables={BUCKET_NAME=$BUCKET_NAME,GEMINI_API_KEY=$GEMINI_API_KEY}" \
  --region $REGION > /dev/null

echo "✓ Textract staging function deployed"

# Selfie Function
cd ../selfie/
zip -r selfie-function.zip . -x "node_modules/.bin/*" "*.git*" ".DS_Store" > /dev/null

aws lambda create-function \
  --function-name uniti-staging-selfie-verification \
  --runtime nodejs22.x \
  --role $SELFIE_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://selfie-function.zip \
  --timeout 30 \
  --memory-size 256 \
  --region $REGION 2>/dev/null || echo "⚠ Function uniti-staging-selfie-verification already exists, updating..."

aws lambda update-function-code \
  --function-name uniti-staging-selfie-verification \
  --zip-file fileb://selfie-function.zip \
  --region $REGION > /dev/null

aws lambda update-function-configuration \
  --function-name uniti-staging-selfie-verification \
  --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" \
  --region $REGION > /dev/null

echo "✓ Selfie staging function deployed"

cd ..

echo ""
echo "Step 5: Creating API Gateway for Staging..."

# Create REST API
API_ID=$(aws apigateway create-rest-api \
  --name uniti-staging-api \
  --description "Staging ID Verification API" \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null) || API_ID=$(aws apigateway get-rest-apis --region $REGION --query "items[?name=='uniti-staging-api'].id" --output text | head -1)

echo "✓ API Gateway ID: $API_ID"

# Get root resource
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[0].id' \
  --output text)

# Create Textract resource
TEXTRACT_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part textract \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null) || TEXTRACT_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?pathPart=='textract'].id" --output text)

# Create Textract POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $TEXTRACT_RESOURCE \
  --http-method POST \
  --authorization-type NONE \
  --region $REGION 2>/dev/null || true

# Integrate Textract Lambda
YOUR_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $TEXTRACT_RESOURCE \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:$YOUR_ACCOUNT_ID:function:uniti-staging-textract-id-analyzer/invocations" \
  --region $REGION 2>/dev/null || true

echo "✓ Textract staging endpoint created"

# Create Selfie resource
SELFIE_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part selfie \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null) || SELFIE_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?pathPart=='selfie'].id" --output text)

# Create Selfie POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $SELFIE_RESOURCE \
  --http-method POST \
  --authorization-type NONE \
  --region $REGION 2>/dev/null || true

# Integrate Selfie Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $SELFIE_RESOURCE \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:$YOUR_ACCOUNT_ID:function:uniti-staging-selfie-verification/invocations" \
  --region $REGION 2>/dev/null || true

echo "✓ Selfie staging endpoint created"

# Grant permissions
aws lambda add-permission \
  --function-name uniti-staging-textract-id-analyzer \
  --statement-id apigateway-textract-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:$YOUR_ACCOUNT_ID:$API_ID/*/*" \
  --region us-east-1 2>/dev/null || echo "⚠ Permission already exists"

aws lambda add-permission \
  --function-name uniti-staging-selfie-verification \
  --statement-id apigateway-selfie-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:$YOUR_ACCOUNT_ID:$API_ID/*/*" \
  --region us-east-1 2>/dev/null || echo "⚠ Permission already exists"

echo "✓ API Gateway permissions granted"

echo ""
echo "Step 6: Creating API deployment..."

# Create deployment
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name staging \
  --region us-east-1 > /dev/null 2>&1

API_ENDPOINT="https://$API_ID.execute-api.us-east-1.amazonaws.com/staging"

echo ""
echo "========================================="
echo "✅ STAGING DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "📊 Resources Created:"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  Textract Role: uniti-staging-textract-id-analyzer-role"
echo "  Selfie Role: uniti-staging-selfie-verification-role"
echo "  Textract Function: uniti-staging-textract-id-analyzer"
echo "  Selfie Function: uniti-staging-selfie-verification"
echo "  API Gateway ID: $API_ID"
echo ""
echo "🔗 API Endpoints:"
echo "  Base URL: $API_ENDPOINT"
echo "  Textract: $API_ENDPOINT/textract"
echo "  Selfie: $API_ENDPOINT/selfie"
echo ""
echo "========================================="

# Clean up temporary files
rm -f trust-policy.json textract-s3-policy.json textract-textract-policy.json \
      textract-logs-policy.json selfie-rekognition-policy.json selfie-s3-policy.json \
      selfie-logs-policy.json

# Save configuration
cat > staging-config.txt << EOF
=== STAGING ENVIRONMENT CONFIG ===
API_ID=$API_ID
API_ENDPOINT=$API_ENDPOINT
BUCKET_NAME=$BUCKET_NAME
TEXTRACT_ROLE=$TEXTRACT_ROLE_ARN
SELFIE_ROLE=$SELFIE_ROLE_ARN
ACCOUNT_ID=$YOUR_ACCOUNT_ID
EOF

echo ""
echo "ℹ️  Configuration saved to: staging-config.txt"

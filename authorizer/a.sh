# 1. Get your API Gateway ID and resource IDs
API_ID="91ohru6lw5"
RESOURCE_ID_TEXTRACT="xxxxx"  # Get from: aws apigateway get-resources --rest-api-id $API_ID
RESOURCE_ID_SELFIE="xxxxx"

# 2. Update /textract POST to use AWS_IAM authorization
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID_TEXTRACT \
  --http-method POST \
  --authorization-type AWS_IAM \
  --region us-east-1

# 3. Update /selfie POST to use AWS_IAM authorization
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID_SELFIE \
  --http-method POST \
  --authorization-type AWS_IAM \
  --region us-east-1

# 4. Deploy the API
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region us-east-1












# Using AWS CLI with SigV4 signing
aws apigateway test-invoke-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID_TEXTRACT \
  --http-method POST \
  --body '{"frontImage":"...","backImage":"...","userId":"..."}' \
  --region us-east-1

# Or with curl using AWS SigV4:
curl -X POST https://91ohru6lw5.execute-api.us-east-1.amazonaws.com/prod/textract \
  --aws-sigv4 "aws:amz:us-east-1:execute-api" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"frontImage":"...","backImage":"...","userId":"..."}'
# ID Document Analysis Lambda Function

An AWS Lambda function that analyzes government-issued ID documents using AWS Textract and Google Gemini AI for enhanced accuracy and validation.

## Overview

This function processes front and back images of ID documents to extract key personal information while validating document authenticity. It combines AWS Textract's OCR capabilities with Google Gemini AI's advanced text understanding to provide accurate field extraction with confidence scoring.

## Features

### Document Processing
- **Dual-sided Analysis**: Processes both front and back of ID documents
- **Multi-format Support**: Handles various ID types (driver's licenses, passports, national IDs)
- **Enhanced Spanish ID Support**: Optimized for Spanish DNI format validation
- **Base64 Image Input**: Accepts images as base64-encoded strings

### AI-Powered Validation
- **Authenticity Check**: Uses Gemini AI to validate document legitimacy
- **Smart Field Extraction**: Leverages AI to parse complex document layouts
- **Confidence Scoring**: Provides reliability metrics for extracted data
- **Error Handling**: Graceful fallbacks when AI services are unavailable

### Data Extraction
Extracts the following fields when available:
- First Name
- Last Name
- Date of Birth
- ID Number
- Gender (normalized to "Male"/"Female")
- Country/Nationality
- Expiration Date
- Issue Date

### Security & Storage
- **S3 Integration**: Automatically stores processed images
- **User Isolation**: Organizes files by user ID
- **Secure URLs**: Provides HTTPS access to stored images
- **Auto-bucket Creation**: Creates S3 bucket if it doesn't exist

## Prerequisites

### AWS Services
- AWS Lambda execution role with permissions for:
  - Textract (AnalyzeID, DetectDocumentText)
  - S3 (GetObject, PutObject, CreateBucket, HeadBucket)
- S3 bucket for image storage

### External Services
- Google Cloud account with Gemini AI API access
- Gemini API key with appropriate quotas

## Environment Variables

```bash
# Google Gemini (default)
GEMINI_API_KEY=your-google-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash  # (optional, default: gemini-2.0-flash)

# OpenRouter Alternative
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=google/gemini-3.1-flash-lite-preview  # (optional)
OPENROUTER_TITLE=ID Verification  # (optional, for tracking)

# General
BUCKET_NAME=your-s3-bucket-name  # (optional, default: uniti-id-images)
NODE_ENV=production  # Set to 'development' for detailed error stacks
```

### Which Provider to Use?

- **Google Gemini**: Set `GEMINI_API_KEY` (will be used automatically)
- **OpenRouter**: Set `OPENROUTER_API_KEY` (takes priority over Google if both are set)

The function will automatically detect which API key is configured and use the appropriate provider.

## Installation

1. **Install Dependencies**:
```bash
npm install
```

2. **Package for Deployment**:
```bash
zip -r textract-function.zip .
```

3. **Deploy to AWS Lambda**:
```bash
aws lambda create-function \
  --function-name id-textract \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR-ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://textract-function.zip \
  --environment Variables='{GEMINI_API_KEY=your-key,BUCKET_NAME=your-bucket}'
```

## API Usage

### Request Format
```json
{
  "frontImage": "base64-encoded-front-image",
  "backImage": "base64-encoded-back-image",
  "userId": "unique-user-identifier"
}
```

### Success Response (200)
```json
{
  "success": true,
  "fields": {
    "firstName": "María",
    "lastName": "García López",
    "dateOfBirth": "1985-03-15",
    "idNumber": "12345678Z",
    "gender": "Female",
    "country": "Spain"
  },
  "userId": "user123",
  "images": {
    "front": "https://your-bucket.s3.amazonaws.com/user123/front.jpg",
    "back": "https://your-bucket.s3.amazonaws.com/user123/back.jpg"
  }
}
```

### Error Responses

**Missing Images (400)**:
```json
{
  "error": "Both front and back images are required"
}
```

**Invalid Document (400)**:
```json
{
  "error": "Images do not appear to be valid ID documents"
}
```

**Processing Error (500)**:
```json
{
  "error": "Error processing ID",
  "message": "Detailed error message"
}
```

## Configuration

### Confidence Scoring
The function calculates confidence based on:
- **ID Number**: 30 points (40 points for valid Spanish DNI format)
- **First Name**: 15 points
- **Last Name**: 15 points
- **Date of Birth**: 15 points
- **Nationality**: 10 points
- **Gender**: 5 points
- **Address**: 5 points
- **Place of Birth**: 5 points

Maximum confidence score: 100

### Spanish DNI Validation
Special validation for Spanish DNI format: `12345678A` (8 digits + 1 letter)

## Performance Considerations

### Execution Time
- Typical execution: 5-15 seconds
- Factors affecting performance:
  - Image size and quality
  - Document complexity
  - Gemini AI response time
  - S3 upload speed

### Memory Usage
- Recommended: 512MB - 1GB
- Peak usage during image processing and AI calls

### Cost Optimization
- **Textract**: ~$1.50 per 1000 pages
- **Gemini AI**: Variable based on model and usage
- **S3**: Standard storage and transfer rates
- **Lambda**: Execution time and memory allocation

## Error Handling

The function includes comprehensive error handling for:

1. **Input Validation**: Missing or invalid parameters
2. **Image Processing**: Corrupt or unsupported image formats
3. **AWS Service Errors**: Textract or S3 failures
4. **AI Service Errors**: Gemini API failures with graceful fallbacks
5. **Network Issues**: Timeout and retry logic

## Monitoring

### CloudWatch Metrics
Monitor these key metrics:
- **Duration**: Function execution time
- **Errors**: Error rate and types
- **Throttles**: Concurrent execution limits
- **Memory Usage**: Peak memory consumption

### Custom Logging
The function logs:
- Request parameters (sanitized)
- Textract response summaries
- Gemini AI interactions
- Confidence scores
- S3 upload confirmations
- Error details and stack traces

### Alerts
Set up CloudWatch alarms for:
- Error rate > 5%
- Duration > 30 seconds
- Memory usage > 80%
- Throttling events

## Security Best Practices

### Data Protection
- Images are temporarily processed in memory
- Permanent storage in user-isolated S3 paths
- No sensitive data logged in CloudWatch

### Access Control
- Use least-privilege IAM roles
- Restrict S3 bucket access
- Secure API key storage in AWS Secrets Manager

### Input Validation
- Base64 format validation
- Image size limits (recommended: < 10MB)
- User ID sanitization

## Troubleshooting

### Common Issues

**"Images do not appear to be valid ID documents"**
- Ensure images show clear, government-issued IDs
- Check image quality and lighting
- Verify both front and back images are provided

**Textract Analysis Fails**
- Verify AWS permissions for Textract service
- Check image format (JPEG, PNG supported)
- Ensure image size is within Textract limits

**Gemini AI Errors**
- Verify API key is valid and has quota
- Check network connectivity
- Review Gemini AI service status

**S3 Upload Failures**
- Verify S3 permissions
- Check bucket name configuration
- Ensure bucket region matches Lambda region

### Debug Mode
Set `NODE_ENV=development` to enable:
- Detailed error stack traces
- Additional logging output
- Extended timeout handling

## Deployment Configuration

### Lambda Timeout
**CRITICAL**: This function requires adequate timeout configuration:
- **Minimum Recommended**: 60 seconds
- **Optimal**: 120 seconds (2 minutes)
- **Maximum Safe**: 300 seconds (5 minutes)

The timeout must account for:
- AWS Textract API processing
- Google Gemini AI API calls
- S3 image uploads
- Network latency

Set the timeout in your CloudFormation template, SAM, or AWS Console:
```yaml
Textract:
  Type: AWS::Lambda::Function
  Properties:
    Timeout: 120  # Seconds
```

### Performance Optimizations Applied:
1. **Combined Gemini Calls**: Validation and parsing now happen in a single API call
2. **Removed Duplicate Textract Calls**: Only `analyzeID()` is used instead of also `detectDocumentText()`
3. **Eliminated S3 Bucket Checks**: Removed headBucket checks that add 1-2 seconds per invocation
4. **Parallel S3 Uploads**: Both images upload simultaneously

These changes reduce typical execution time from 45-60s to 20-30s.

## Dependencies

```json
{
  "@google/generative-ai": "^0.24.1",
  "aws-sdk": "^2.1450.0"
}
```

## Version History

- **1.0.0**: Initial release with Textract and Gemini AI integration
- Enhanced Spanish ID support
- Confidence scoring system
- Automatic S3 storage

## License

MIT License - see LICENSE file for details.

## Support

For technical support:
1. Check CloudWatch logs for detailed error information
2. Verify all environment variables are set correctly
3. Ensure AWS and Google Cloud permissions are properly configured
4. Review the troubleshooting section above
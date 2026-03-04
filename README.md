# ID Verification Lambda Functions

A collection of AWS Lambda functions for comprehensive identity verification using AI-powered document analysis and face recognition.

## Overview

This repository contains two specialized Lambda functions that work together to provide a complete identity verification solution:

1. **Textract Function** - Analyzes government-issued ID documents using AWS Textract and Google Gemini AI
2. **Selfie Function** - Performs face detection and liveness verification using AWS Rekognition

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  Textract Lambda │───▶│   AWS Textract  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌──────────────────┐    ┌─────────────────┐
         │              │   Gemini AI      │    │     AWS S3      │
         │              │   (Validation)   │    │   (Storage)     │
         │              └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Selfie Lambda  │───▶│  AWS Rekognition │───▶│     AWS S3      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Features

### Document Verification
- **Multi-language Support**: Enhanced support for Spanish IDs and international documents
- **AI-powered Validation**: Uses Google Gemini AI to validate document authenticity
- **Field Extraction**: Automatically extracts key information (name, DOB, ID number, etc.)
- **Confidence Scoring**: Provides confidence metrics for extracted data
- **Secure Storage**: Automatically stores document images in S3

### Face Verification
- **Face Detection**: Detects and analyzes human faces in selfie images
- **Liveness Detection**: Basic checks to prevent photo-of-photo attacks
- **Demographic Analysis**: Extracts age range, gender, and emotional state
- **Quality Assessment**: Provides confidence scores for face detection

## Quick Start

### Prerequisites
- AWS Account with appropriate permissions
- Google Cloud account with Gemini AI API access
- Node.js 18+ runtime environment

### Environment Variables
Both functions require the following environment variables:

```bash
# Required for both functions
BUCKET_NAME=your-s3-bucket-name

# Required for Textract function only
GEMINI_API_KEY=your-gemini-api-key
```

### Deployment
Each function can be deployed independently:

```bash
# Deploy Textract function
cd textract/
npm install
zip -r textract-function.zip .
aws lambda create-function --function-name id-textract --runtime nodejs22.x --zip-file fileb://textract-function.zip

# Deploy Selfie function
cd ../selfie/
npm install
zip -r selfie-function.zip .
aws lambda create-function --function-name selfie-verification --runtime nodejs22.x --zip-file fileb://selfie-function.zip
```

## API Reference

### Textract Function
**Endpoint**: `/textract`
**Method**: POST

**Request Body**:
```json
{
  "frontImage": "base64-encoded-image",
  "backImage": "base64-encoded-image", 
  "userId": "unique-user-identifier"
}
```

**Response**:
```json
{
  "success": true,
  "fields": {
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "idNumber": "12345678A",
    "gender": "Male",
    "country": "Spain"
  },
  "userId": "user123",
  "images": {
    "front": "https://bucket.s3.amazonaws.com/user123/front.jpg",
    "back": "https://bucket.s3.amazonaws.com/user123/back.jpg"
  }
}
```

### Selfie Function
**Endpoint**: `/selfie`
**Method**: POST

**Request Body**:
```json
{
  "image": "base64-encoded-image",
  "userId": "unique-user-identifier"
}
```

**Response**:
```json
{
  "isHuman": true,
  "confidence": 95.5,
  "faceAttributes": {
    "age": {
      "low": 25,
      "high": 35
    },
    "gender": "Male",
    "emotions": [
      {
        "type": "HAPPY",
        "confidence": 85.2
      }
    ]
  },
  "images": {
    "selfie": "https://bucket.s3.amazonaws.com/user123/selfie.jpg"
  }
}
```

## Security Considerations

- All images are stored securely in S3 with user-specific paths
- API keys and sensitive data should be stored in AWS Secrets Manager
- Implement proper IAM roles and policies for Lambda execution
- Consider enabling S3 encryption at rest
- Validate and sanitize all input data

## Cost Optimization

- **Textract**: Charges per page analyzed (~$1.50 per 1000 pages)
- **Rekognition**: Charges per image analyzed (~$1.00 per 1000 images)
- **Gemini AI**: Charges per API call (varies by model)
- **S3 Storage**: Standard storage rates apply

## Monitoring and Logging

Both functions include comprehensive logging for:
- Request/response tracking
- Error handling and debugging
- Performance metrics
- Security events

Monitor using AWS CloudWatch for:
- Function execution duration
- Error rates and types
- Memory and CPU usage
- API call volumes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see individual function directories for specific license files.

## Support

For issues and questions:
- Check the individual function README files for specific documentation
- Review AWS Lambda and service-specific documentation
- Open an issue in this repository for bugs or feature requests

Permissins needed by selfie
```
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

{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "logs:CreateLogGroup",
            "Resource": "arn:aws:logs:eu-central-1:899212167219:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:logs:eu-central-1:899212167219:log-group:/aws/lambda/selfie-analyzer:*"
            ]
        }
    ]
}
```

Permissions needed by textract-id
```
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

{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "logs:CreateLogGroup",
            "Resource": "arn:aws:logs:eu-central-1:899212167219:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:logs:eu-central-1:899212167219:log-group:/aws/lambda/textract-id-analyzer:*"
            ]
        }
    ]
}
```# lambda

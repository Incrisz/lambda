# Selfie Verification Lambda Function

An AWS Lambda function that performs face detection and verification using AWS Rekognition to validate selfie images for identity verification workflows.

## Overview

This function analyzes selfie images to detect human faces, assess image quality, and extract demographic information. It's designed to work as part of a comprehensive identity verification system, providing liveness detection and face analysis capabilities.

## Features

### Face Detection
- **Human Face Detection**: Identifies and validates human faces in images
- **Quality Assessment**: Provides confidence scores for face detection accuracy
- **Multiple Face Handling**: Focuses on the most prominent face when multiple faces are detected
- **No Face Detection**: Gracefully handles images without detectable faces

### Liveness Detection
- **Basic Anti-Spoofing**: Helps prevent photo-of-photo attacks
- **Confidence Thresholds**: Uses confidence scores to assess face authenticity
- **Quality Metrics**: Evaluates image quality for reliable face detection

### Demographic Analysis
Extracts the following face attributes:
- **Age Range**: Estimated age bracket (low and high values)
- **Gender**: Detected gender classification
- **Emotions**: Emotional state analysis with confidence scores
- **Face Quality**: Overall face detection confidence

### Secure Storage
- **S3 Integration**: Automatically stores selfie images
- **User Organization**: Files organized by user ID for easy management
- **HTTPS Access**: Provides secure URLs for stored images
- **Auto-bucket Management**: Creates S3 bucket if it doesn't exist

## Prerequisites

### AWS Services
- AWS Lambda execution role with permissions for:
  - Rekognition (DetectFaces)
  - S3 (GetObject, PutObject, CreateBucket, HeadBucket)
- S3 bucket for image storage

### Service Limits
- Rekognition is available in specific AWS regions
- Consider service quotas for high-volume usage

## Environment Variables

```bash
# Required
BUCKET_NAME=your-s3-bucket-name

# Optional
NODE_ENV=production  # Set to 'development' for detailed error information
```

## Installation

1. **Install Dependencies**:
```bash
npm install
```

2. **Package for Deployment**:
```bash
zip -r selfie-function.zip .
```

3. **Deploy to AWS Lambda**:
```bash
aws lambda create-function \
  --function-name selfie-verification \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR-ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://selfie-function.zip \
  --environment Variables='{BUCKET_NAME=your-bucket-name}'
```

## API Usage

### Request Format
```json
{
  "image": "base64-encoded-selfie-image",
  "userId": "unique-user-identifier"
}
```

### Success Response (200)
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
      },
      {
        "type": "CALM",
        "confidence": 12.8
      }
    ]
  },
  "images": {
    "selfie": "https://your-bucket.s3.amazonaws.com/user123/selfie.jpg"
  }
}
```

### No Face Detected (200)
```json
{
  "isHuman": false,
  "confidence": 0,
  "message": "No face detected in the image"
}
```

### Error Responses

**Missing Image (400)**:
```json
{
  "error": "Image is required"
}
```

**Processing Error (500)**:
```json
{
  "error": "Error processing face",
  "message": "Detailed error message"
}
```

## Configuration

### Face Detection Thresholds
- **Minimum Confidence**: 90% for human classification
- **Quality Assessment**: Based on Rekognition's confidence scores
- **Multiple Faces**: Automatically selects the most prominent face

### Emotion Detection
Supported emotion types:
- HAPPY
- SAD
- ANGRY
- CONFUSED
- DISGUSTED
- SURPRISED
- CALM
- UNKNOWN
- FEAR

### Age Range Detection
- Provides estimated age brackets (e.g., 25-35 years)
- Based on facial feature analysis
- Confidence varies with image quality

## Performance Considerations

### Execution Time
- Typical execution: 2-8 seconds
- Factors affecting performance:
  - Image size and quality
  - Face complexity and positioning
  - S3 upload speed
  - Rekognition service response time

### Memory Usage
- Recommended: 256MB - 512MB
- Peak usage during image processing and analysis

### Cost Optimization
- **Rekognition**: ~$1.00 per 1000 images analyzed
- **S3**: Standard storage and transfer rates
- **Lambda**: Execution time and memory allocation

## Error Handling

The function includes robust error handling for:

1. **Input Validation**: Missing or invalid image data
2. **Image Processing**: Corrupt or unsupported image formats
3. **AWS Service Errors**: Rekognition or S3 service failures
4. **Network Issues**: Timeout and connectivity problems
5. **Resource Limits**: Memory or execution time constraints

## Monitoring

### CloudWatch Metrics
Track these important metrics:
- **Invocations**: Total function calls
- **Duration**: Average execution time
- **Errors**: Error rate and error types
- **Throttles**: Concurrent execution limits
- **Memory Usage**: Peak memory consumption

### Custom Metrics
The function provides insights on:
- Face detection success rate
- Average confidence scores
- Demographic distribution
- Image quality metrics

### Logging
Comprehensive logging includes:
- Request parameters (image size, user ID)
- Rekognition response summaries
- Face detection results
- S3 upload confirmations
- Error details and troubleshooting info

### Alerts
Set up CloudWatch alarms for:
- Error rate > 3%
- Duration > 15 seconds
- Memory usage > 80%
- No face detection rate > 20%

## Security Best Practices

### Data Protection
- Images processed temporarily in memory
- Secure storage in user-isolated S3 paths
- No biometric data stored in logs
- HTTPS-only access to stored images

### Access Control
- Use least-privilege IAM roles
- Restrict S3 bucket access with proper policies
- Enable S3 bucket encryption at rest
- Consider VPC endpoints for enhanced security

### Privacy Considerations
- Implement data retention policies
- Consider GDPR/privacy compliance requirements
- Provide mechanisms for data deletion
- Audit access to stored images

## Integration Patterns

### With ID Verification
```javascript
// Typical workflow integration
const idResult = await processIDDocument(frontImage, backImage, userId);
const selfieResult = await processSelfie(selfieImage, userId);

// Compare extracted face data
const verificationResult = compareFaces(idResult.photo, selfieResult.faceAttributes);
```

### Batch Processing
```javascript
// Process multiple selfies
const results = await Promise.all(
  selfies.map(selfie => processSelfie(selfie.image, selfie.userId))
);
```

## Troubleshooting

### Common Issues

**"No face detected in the image"**
- Ensure the image contains a clear, visible human face
- Check image lighting and quality
- Verify face is not obscured by objects or shadows
- Try different angles or better lighting conditions

**Low Confidence Scores**
- Improve image quality and resolution
- Ensure proper lighting conditions
- Check for image blur or motion artifacts
- Verify face is clearly visible and unobstructed

**Rekognition Service Errors**
- Verify AWS permissions for Rekognition service
- Check service availability in your region
- Ensure image format is supported (JPEG, PNG)
- Verify image size is within service limits (< 15MB)

**S3 Upload Failures**
- Check S3 permissions and bucket configuration
- Verify bucket name is correct and accessible
- Ensure bucket region matches Lambda region
- Check for bucket policy restrictions

### Debug Information
Enable detailed logging by setting `NODE_ENV=development`:
- Extended error stack traces
- Rekognition response details
- S3 operation logs
- Performance timing information

## Dependencies

```json
{
  "aws-sdk": "^2.1450.0"
}
```

The function uses only the AWS SDK, making it lightweight and fast to deploy.

## Version History

- **1.0.0**: Initial release with face detection and demographic analysis
- Basic liveness detection capabilities
- S3 integration for secure image storage
- Comprehensive error handling and logging

## Best Practices

### Image Quality
- **Resolution**: Minimum 640x480 pixels recommended
- **Format**: JPEG or PNG formats supported
- **Size**: Keep under 5MB for optimal performance
- **Lighting**: Ensure good, even lighting on the face
- **Positioning**: Face should be clearly visible and centered

### Error Handling
- Always check the `isHuman` flag before processing results
- Handle cases where no face is detected gracefully
- Implement retry logic for temporary service failures
- Provide clear user feedback for image quality issues

### Performance
- Consider image compression before processing
- Implement caching for repeated analyses
- Use appropriate Lambda memory allocation
- Monitor and optimize based on usage patterns

## License

MIT License - see LICENSE file for details.

## Support

For technical support:
1. Check CloudWatch logs for detailed error information
2. Verify AWS permissions are correctly configured
3. Test with high-quality sample images
4. Review the troubleshooting section above
5. Ensure Rekognition service is available in your region
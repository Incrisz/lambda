// AWS Lambda function for face verification using Rekognition

const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();

exports.handler = async (event) => {
    try {
        // Parse request body from API Gateway
        const { image, userId } = JSON.parse(event.body);
    
        
        if (!image) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Image is required' })
            };
        }
        
        // Convert base64 to binary
        const imageBytes = Buffer.from(image, 'base64');
        
        // Call Rekognition to detect faces
        const detectFacesParams = {
            Image: {
                Bytes: imageBytes
            },
            Attributes: ['ALL']
        };
        
        const detectFacesResponse = await rekognition.detectFaces(detectFacesParams).promise();
        
        // Check if any faces were detected
        if (!detectFacesResponse.FaceDetails || detectFacesResponse.FaceDetails.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    isHuman: false,
                    confidence: 0,
                    message: 'No face detected in the image'
                })
            };
        }
        
        // Get the first face (most prominent)
        const faceDetails = detectFacesResponse.FaceDetails[0];
        
        // Check if it's a real person (not a photo of a photo)
        // This is a simplified check - in production you might want to use Rekognition's liveness detection
        const isHuman = faceDetails.Confidence > 90;
        
        // Extract useful attributes
        const ageRange = faceDetails.AgeRange;
        const gender = faceDetails.Gender?.Value;
        const emotions = faceDetails.Emotions?.map(emotion => ({
            type: emotion.Type,
            confidence: emotion.Confidence
        }));

        // Save images to S3
        const s3 = new AWS.S3();
        const bucketName = process.env.BUCKET_NAME;
        
        // Check if bucket exists, create if it doesn't
        try {
            await s3.headBucket({ Bucket: bucketName }).promise();
        } catch (error) {
            if (error.code === 'NotFound' || error.code === 'NoSuchBucket') {
                await s3.createBucket({ Bucket: bucketName }).promise();
            } else {
                throw error; // Re-throw if it's a different error
            }
        }
        
        // Save selfie
        const selfieKey = `${userId}/selfie.jpg`;
        
        await s3.putObject({
            Bucket: bucketName,
            Key: selfieKey,
            Body: imageBytes,
            ContentType: 'image/jpeg'
        }).promise();
        
        // Return the results
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                isHuman,
                confidence: faceDetails.Confidence,
                faceAttributes: {
                    age: {
                        low: ageRange?.Low,
                        high: ageRange?.High
                    },
                    gender,
                    emotions
                },
                images: {
                    selfie: `https://${bucketName}.s3.amazonaws.com/${selfieKey}`,
                }
            })
        };
    } catch (error) {
        console.error('Error processing face:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Error processing face',
                message: error.message
            })
        };
    }
};
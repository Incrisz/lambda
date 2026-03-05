// AWS Lambda function for ID analysis using Textract with enhanced Spanish ID support

const AWS = require('aws-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const textract = new AWS.Textract();

exports.handler = async (event) => {
    try {
        // Parse request body
        const { frontImage, backImage, userId } = JSON.parse(event.body);
        
        if (!frontImage || !backImage) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Both front and back images are required' })
            };
        }
        
        // Convert base64 to binary
        const frontImageBytes = Buffer.from(frontImage, 'base64');
        const backImageBytes = Buffer.from(backImage, 'base64');
        
        // Validate images are real IDs using Gemini
        const isValidID = await validateIDWithGemini(frontImage, backImage);
        if (!isValidID) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Images do not appear to be valid ID documents' })
            };
        }
        
        // Call Textract to analyze the ID
        const params = {
            DocumentPages: [
                { Bytes: frontImageBytes },
                { Bytes: backImageBytes }
            ]
        };
        
        const textractResponse = await textract.analyzeID(params).promise();
        
        // Also try general text detection for better Spanish ID parsing
        const frontTextParams = {
            Document: { Bytes: frontImageBytes }
        };
        const backTextParams = {
            Document: { Bytes: backImageBytes }
        };
        const [frontTextResponse, backTextResponse] = await Promise.all([
            textract.detectDocumentText(frontTextParams).promise(),
            textract.detectDocumentText(backTextParams).promise()
        ]);

        // Helper function to normalize field names
        const normalizeFieldName = (text) => {
            return text.toLowerCase()
                .replace(/[áàäâ]/g, 'a')
                .replace(/[éèëê]/g, 'e')
                .replace(/[íìïî]/g, 'i')
                .replace(/[óòöô]/g, 'o')
                .replace(/[úùüû]/g, 'u')
                .replace(/ñ/g, 'n')
                .replace(/ç/g, 'c')
                .trim();
        };


        // Log Textract response for debugging
        console.log('Textract response:', JSON.stringify(textractResponse));
        
        // Use Gemini AI to parse Textract response
        const extractedFields = await parseWithGemini(textractResponse);
        console.log('Extracted fields:', JSON.stringify(extractedFields));

        // Add confidence scoring and validation
        const validateAndScore = (fields) => {
            const scored = { ...fields };
            let confidence = 0;
            let fieldCount = 0;
            
            // Score based on critical fields presence
            if (scored.idNumber) {
                confidence += 30;
                fieldCount++;
                // Extra points for valid Spanish DNI format
                if (scored.idNumber.match(/^\d{8}[A-Z]$/)) {
                    confidence += 10;
                }
            }
            if (scored.firstName) {
                confidence += 15;
                fieldCount++;
            }
            if (scored.lastName) {
                confidence += 15;
                fieldCount++;
            }
            if (scored.dateOfBirth) {
                confidence += 15;
                fieldCount++;
            }
            if (scored.nationality) {
                confidence += 10;
                fieldCount++;
            }
            if (scored.gender) {
                confidence += 5;
                fieldCount++;
            }
            if (scored.address) {
                confidence += 5;
                fieldCount++;
            }
            if (scored.placeOfBirth) {
                confidence += 5;
                fieldCount++;
            }
            
            return {
                fields: scored,
                confidence: Math.min(confidence, 100),
                fieldCount,
            };
        };
        
        // Helper function to validate ID authenticity with Gemini AI
        async function validateIDWithGemini(frontImageBase64, backImageBase64) {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            
            const prompt = `
                Analyze these two images to determine if they are authentic government-issued ID documents (like driver's license, passport, national ID card, etc.) or fake/drawn images.
                
                Look for:
                - Professional printing quality and layout
                - Official government seals, logos, or security features
                - Consistent typography and formatting
                - Photo quality and placement
                - Overall document structure and design
                
                Return only "true" if these appear to be real ID documents, or "false" if they appear to be fake, drawn, or not legitimate ID documents.
            `;
            
            try {
                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: frontImageBase64,
                            mimeType: 'image/jpeg'
                        }
                    },
                    {
                        inlineData: {
                            data: backImageBase64,
                            mimeType: 'image/jpeg'
                        }
                    }
                ]);
                
                const response = result.response.text().toLowerCase().trim();
                console.log('ID validation response:', response);
                return response === 'true';
            } catch (error) {
                console.error('Gemini validation error:', error);
                // If validation fails, allow processing to continue
                return true;
            }
        }
        
        // Helper function to parse with Gemini AI
        async function parseWithGemini(textractResponse) {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            
            const prompt = `
                Analyze this Textract response from an ID document and extract the following fields:
                - firstName
                - lastName
                - dateOfBirth
                - expirationDate
                - issueDate
                - idNumber
                - gender
                - country

                Note: gender should always be Male or Female even if the card uses M or F or any other form, transform to Male or Female

                Textract Response: ${JSON.stringify(textractResponse)}

                Return only a JSON object with the extracted fields. If a field is not found, omit it from the response.
                `;
            
            try {
                const result = await model.generateContent(prompt);
                const response = result.response;
                const text = response.text();
                console.log('Gemini response text:', text);
                
                // Extract JSON from response
                const jsonMatch = text.match(/\{[^}]*\}/);
                if (jsonMatch) {
                    const finalResult = JSON.parse(jsonMatch[0]);
                    console.log('Parsed JSON from Gemini:', JSON.stringify(finalResult));
                    return finalResult;
                }
                console.log('No JSON found in Gemini response');
                return {};
            } catch (error) {
                console.error('Gemini parsing error:', error);
                return {};
            }
        }
        
        const result = validateAndScore(extractedFields);
        console.log('Extraction result:', result);
        
        // Save images to S3
        const s3 = new AWS.S3();
        const bucketName = process.env.BUCKET_NAME || 'uniti-id-images';
        
        // Check if bucket exists, create if it doesn't
        try {
            await s3.headBucket({ Bucket: bucketName }).promise();
        } catch (error) {
            if (error.code === 'NotFound' || error.code === 'NoSuchBucket') {
                await s3.createBucket({ Bucket: bucketName }).promise();
            } else {
                throw error;
            }
        }
        
        // Save front and back images
        const frontKey = `${userId}/front.jpg`;
        const backKey = `${userId}/back.jpg`;
        
        await Promise.all([
            s3.putObject({
                Bucket: bucketName,
                Key: frontKey,
                Body: frontImageBytes,
                ContentType: 'image/jpeg'
            }).promise(),
            s3.putObject({
                Bucket: bucketName,
                Key: backKey,
                Body: backImageBytes,
                ContentType: 'image/jpeg'
            }).promise()
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                fields: result.fields,
                userId: userId,
                images: {
                    front: `https://${process.env.BUCKET_NAME || 'uniti-id-images'}.s3.amazonaws.com/${userId}/front.jpg`,
                    back: `https://${process.env.BUCKET_NAME || 'uniti-id-images'}.s3.amazonaws.com/${userId}/back.jpg`
                }
            })
        };
    } catch (error) {
        console.error('Error processing ID:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Error processing ID',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
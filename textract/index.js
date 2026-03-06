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
        
        // Call Textract to analyze the ID (only once, not duplicate calls)
        const params = {
            DocumentPages: [
                { Bytes: frontImageBytes },
                { Bytes: backImageBytes }
            ]
        };
        
        const textractResponse = await textract.analyzeID(params).promise();

        // Log Textract response for debugging
        console.log('Textract response:', JSON.stringify(textractResponse));
        
        // Use Gemini AI to validate AND parse in a single call (reduced API latency)
        const extractedFields = await validateAndParseWithGemini(frontImage, backImage, textractResponse);
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
        
        // Helper function to validate AND parse with Gemini AI in a single call
        async function validateAndParseWithGemini(frontImageBase64, backImageBase64, textractResponse) {
            const prompt = `
                Analyze these ID document images and the Textract response below. 
                
                First, validate if these are authentic government-issued ID documents (return false if they appear fake/drawn/invalid).
                
                Then extract these fields:
                - firstName
                - lastName
                - dateOfBirth
                - expirationDate
                - issueDate
                - idNumber
                - gender (normalize to "Male" or "Female")
                - country/nationality

                Textract Response: ${JSON.stringify(textractResponse)}

                Return a JSON object with:
                {
                  "isValid": true/false,
                  "firstName": "...",
                  "lastName": "...",
                  etc
                }
                If a field is not found, omit it. Only return the JSON object, no other text.
            `;
            
            try {
                let text;
                
                // Use OpenRouter if API key is provided, otherwise use Google Gemini
                if (process.env.OPENROUTER_API_KEY) {
                    console.log('Using OpenRouter API');
                    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                            'X-Title': process.env.OPENROUTER_TITLE || 'ID Verification'
                        },
                        body: JSON.stringify({
                            model: process.env.OPENROUTER_MODEL || 'google/gemini-3.1-flash-lite-preview',
                            messages: [
                                {
                                    role: 'user',
                                    content: [
                                        { type: 'text', text: prompt },
                                        {
                                            type: 'image',
                                            image: frontImageBase64
                                        },
                                        {
                                            type: 'image',
                                            image: backImageBase64
                                        }
                                    ]
                                }
                            ]
                        })
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
                    }
                    
                    const data = await response.json();
                    text = data.choices[0].message.content;
                } else {
                    console.log('Using Google Gemini API');
                    const { GoogleGenerativeAI } = require('@google/generative-ai');
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
                    
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
                    
                    text = result.response.text();
                }
                
                console.log('AI response:', text);
                
                // Extract JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    
                    // Check if document is valid
                    if (parsed.isValid === false) {
                        throw new Error('Images do not appear to be valid ID documents');
                    }
                    
                    // Remove the isValid flag since we've checked it
                    delete parsed.isValid;
                    return parsed;
                }
                return {};
            } catch (error) {
                console.error('AI validation/parsing error:', error);
                // If validation fails, allow processing to continue with warning
                if (error.message.includes('valid ID documents')) {
                    throw error;
                }
                return {};
            }
        }
        
        const result = validateAndScore(extractedFields);
        console.log('Extraction result:', result);
        
        // Save images to S3
        const s3 = new AWS.S3();
        const bucketName = process.env.BUCKET_NAME || 'uniti-id-images';
        
        // Save front and back images (skip bucket existence check for faster execution)
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
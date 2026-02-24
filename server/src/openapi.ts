/**
 * OpenAPI 3.0 specification for Secure File Server API.
 * Served at /api-docs when server.docsEnabled is true.
 */

/** OpenAPI 3.0 document shape for Swagger UI. */
export interface OpenApiDocument {
    openapi: string;
    info: { title: string; description?: string; version: string; [k: string]: unknown };
    servers?: Array<{ url: string; description?: string }>;
    tags?: Array<{ name: string; description?: string }>;
    paths: Record<string, unknown>;
    components?: Record<string, unknown>;
}

/** Build the OpenAPI document with the given server base URL. */
export function getOpenApiSpec(baseUrl: string): OpenApiDocument {
    const doc: OpenApiDocument = {
        openapi: '3.0.3',
        info: {
            title: 'Secure File Server API',
            description:
                'Zero-knowledge file delivery with OTP-based key wrapping. ' +
                'The server stores encrypted files and wrapped keys; it never sees plaintext or OTPs. ' +
                'Recipients receive a download link and OTP separately; after verifying the OTP they can decrypt and download.',
            version: '1.0.0',
            contact: { name: 'Radixweb' },
            license: { name: 'MIT' },
        },
        servers: [{ url: baseUrl, description: 'API server' }],
        tags: [
            { name: 'Health', description: 'Server health and status' },
            { name: 'Upload', description: 'Encrypted file upload' },
            { name: 'Verify OTP', description: 'OTP verification for decryption key' },
            { name: 'Download', description: 'File download after verification' },
            { name: 'Metadata', description: 'File metadata (no auth)' },
            { name: 'Recipients', description: 'Recipient list and revocation' },
            { name: 'Testing', description: 'Development-only endpoints' },
        ],
        paths: {
            '/api/health': {
                get: {
                    tags: ['Health'],
                    summary: 'Health check',
                    description:
                        'Returns server health, DB and storage status, and basic stats. No authentication required.',
                    operationId: 'getHealth',
                    responses: {
                        '200': {
                            description: 'Health status',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/HealthResponse' },
                                },
                            },
                        },
                    },
                },
            },
            '/api/test-email': {
                post: {
                    tags: ['Testing'],
                    summary: 'Send test email',
                    description:
                        'Sends a test email to verify SMTP configuration. **Available only when NODE_ENV is not production.**',
                    operationId: 'testEmail',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/TestEmailRequest' },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Test email sent',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/TestEmailResponse' },
                                },
                            },
                        },
                        '400': { $ref: '#/components/responses/ValidationError' },
                        '403': {
                            description: 'Forbidden – endpoint disabled in production',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ApiError' },
                                },
                            },
                        },
                    },
                },
            },
            '/api/upload': {
                post: {
                    tags: ['Upload'],
                    summary: 'Upload encrypted file',
                    description:
                        'Upload encrypted file and wrapped key(s). Use multipart/form-data. ' +
                        'For single recipient use `recipientEmail`, `otp`, `otpHash`; for multiple recipients use `recipients` (JSON string of array).',
                    operationId: 'upload',
                    requestBody: {
                        required: true,
                        content: {
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    required: ['fileName', 'expiryMinutes', 'expiryType'],
                                    properties: {
                                        fileName: {
                                            type: 'string',
                                            minLength: 1,
                                            maxLength: 255,
                                            description: 'Original file name',
                                        },
                                        expiryMinutes: {
                                            type: 'integer',
                                            minimum: 5,
                                            maximum: 1440,
                                            description: '5–1440',
                                        },
                                        expiryType: {
                                            type: 'string',
                                            enum: ['one-time', 'time-based'],
                                        },
                                        recipientEmail: {
                                            type: 'string',
                                            format: 'email',
                                            description: 'Single recipient (legacy)',
                                        },
                                        otp: {
                                            type: 'string',
                                            pattern: '^[0-9]{6}$',
                                            description: '6-digit OTP (legacy)',
                                        },
                                        otpHash: {
                                            type: 'string',
                                            description: 'Base64 SHA-256 hash of OTP (legacy)',
                                        },
                                        recipients: {
                                            type: 'string',
                                            description:
                                                'JSON string of RecipientPayload[] for multiple recipients',
                                        },
                                        encryptedData: {
                                            type: 'string',
                                            format: 'binary',
                                            description: 'Encrypted file',
                                        },
                                        wrappedKey: {
                                            type: 'string',
                                            format: 'binary',
                                            description: 'Wrapped key (single or first)',
                                        },
                                        wrappedKeySalt: {
                                            type: 'string',
                                            format: 'binary',
                                            description: 'Salt for wrapped key',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': {
                            description: 'File uploaded; download URL and expiry returned',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/UploadResponse' },
                                },
                            },
                        },
                        '400': { $ref: '#/components/responses/ValidationError' },
                        '413': {
                            description: 'File too large',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ApiError' },
                                },
                            },
                        },
                    },
                },
            },
            '/api/verify-otp': {
                post: {
                    tags: ['Verify OTP'],
                    summary: 'Verify OTP and get decryption key',
                    description:
                        "Verifies the recipient's OTP and returns the wrapped key and salt for decryption. " +
                        'Rate-limited; invalid attempts are counted.',
                    operationId: 'verifyOtp',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/VerifyOTPRequest' },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'OTP valid; wrapped key and file info returned',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/VerifyOTPResponse' },
                                },
                            },
                        },
                        '400': { $ref: '#/components/responses/ValidationError' },
                        '404': {
                            description: 'File not found or expired',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ApiError' },
                                },
                            },
                        },
                        '429': {
                            description: 'Too many OTP attempts',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiError' },
                                            {
                                                type: 'object',
                                                properties: {
                                                    details: {
                                                        type: 'object',
                                                        properties: {
                                                            attemptsRemaining: { type: 'number' },
                                                        },
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/api/download/{fileId}': {
                get: {
                    tags: ['Download'],
                    summary: 'Download encrypted file',
                    description:
                        'Returns the encrypted file binary. Call only after successful OTP verification; ' +
                        'client decrypts using the key from verify-otp.',
                    operationId: 'download',
                    parameters: [
                        {
                            name: 'fileId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string', format: 'uuid' },
                            description: 'File UUID',
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Encrypted file binary',
                            content: {
                                'application/octet-stream': {
                                    schema: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                        '400': {
                            description: 'Invalid fileId or file expired',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ApiError' },
                                },
                            },
                        },
                        '404': {
                            description: 'File not found',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ApiError' },
                                },
                            },
                        },
                    },
                },
            },
            '/api/metadata/{fileId}': {
                get: {
                    tags: ['Metadata'],
                    summary: 'Get file metadata',
                    description:
                        'Returns file name, size, expiry type and time. No authentication required; ' +
                        'used by recipient page before entering OTP.',
                    operationId: 'getMetadata',
                    parameters: [
                        {
                            name: 'fileId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string', format: 'uuid' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'File metadata',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/MetadataResponse' },
                                },
                            },
                        },
                        '400': { $ref: '#/components/responses/ValidationError' },
                        '404': {
                            description: 'File not found or expired',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ApiError' },
                                },
                            },
                        },
                    },
                },
            },
            '/api/files/{fileId}/recipients': {
                get: {
                    tags: ['Recipients'],
                    summary: 'List recipients',
                    description:
                        'Returns list of recipients for a file (IDs, emails, OTP attempts, timestamps).',
                    operationId: 'listRecipients',
                    parameters: [
                        {
                            name: 'fileId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string', format: 'uuid' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Recipients list',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/RecipientsListResponse' },
                                },
                            },
                        },
                        '400': { $ref: '#/components/responses/ValidationError' },
                        '500': {
                            description: 'Server error',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ApiError' },
                                },
                            },
                        },
                    },
                },
            },
            '/api/files/{fileId}/recipients/{recipientId}': {
                delete: {
                    tags: ['Recipients'],
                    summary: 'Revoke recipient',
                    description: 'Revokes access for a recipient (deletes recipient record).',
                    operationId: 'revokeRecipient',
                    parameters: [
                        {
                            name: 'fileId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string', format: 'uuid' },
                        },
                        {
                            name: 'recipientId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string', format: 'uuid' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Recipient revoked',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            message: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                        '400': { $ref: '#/components/responses/ValidationError' },
                        '500': {
                            description: 'Revocation failed',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ApiError' },
                                },
                            },
                        },
                    },
                },
            },
        },
        components: {
            schemas: {
                ApiError: {
                    type: 'object',
                    required: ['error', 'message'],
                    properties: {
                        error: { type: 'string', description: 'Error code' },
                        message: { type: 'string', description: 'User-facing message' },
                        details: { type: 'object', description: 'Optional extra data' },
                    },
                },
                HealthResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['healthy', 'unhealthy'] },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number' },
                        version: { type: 'string' },
                        environment: { type: 'string' },
                        services: {
                            type: 'object',
                            properties: {
                                database: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['healthy', 'unhealthy'] },
                                        database: { type: 'string' },
                                        error: { type: 'string' },
                                    },
                                },
                                storage: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['healthy', 'unhealthy'] },
                                        storage: { type: 'string' },
                                        error: { type: 'string' },
                                    },
                                },
                            },
                        },
                        stats: { type: 'object' },
                        responseTime: { type: 'number' },
                    },
                },
                TestEmailRequest: {
                    type: 'object',
                    required: ['email'],
                    properties: { email: { type: 'string', format: 'email' } },
                },
                TestEmailResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        messageId: { type: 'string' },
                        to: { type: 'string' },
                    },
                },
                UploadResponse: {
                    type: 'object',
                    properties: {
                        fileId: { type: 'string', format: 'uuid' },
                        downloadUrl: { type: 'string' },
                        message: { type: 'string' },
                        uploadedAt: { type: 'string', format: 'date-time' },
                        expiresAt: { type: 'string', format: 'date-time' },
                    },
                },
                VerifyOTPRequest: {
                    type: 'object',
                    required: ['fileId', 'otp'],
                    properties: {
                        fileId: { type: 'string', format: 'uuid' },
                        otp: { type: 'string', pattern: '^[0-9]{6}$' },
                        recipientEmail: { type: 'string', format: 'email' },
                    },
                },
                VerifyOTPResponse: {
                    type: 'object',
                    properties: {
                        wrappedKey: { type: 'string', description: 'Base64 wrapped key' },
                        wrappedKeySalt: { type: 'string' },
                        fileName: { type: 'string' },
                        fileSize: { type: 'integer' },
                        verifiedAt: { type: 'string', format: 'date-time' },
                    },
                },
                MetadataResponse: {
                    type: 'object',
                    properties: {
                        fileName: { type: 'string' },
                        fileSize: { type: 'integer' },
                        expiryTime: { type: 'string' },
                        expiryType: { type: 'string' },
                        uploadedAt: { type: 'string' },
                    },
                },
                RecipientInfo: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string' },
                        otpAttempts: { type: 'integer' },
                        createdAt: { type: 'string' },
                        downloadedAt: { type: 'string', nullable: true },
                        otpVerifiedAt: { type: 'string', nullable: true },
                    },
                },
                RecipientsListResponse: {
                    type: 'object',
                    properties: {
                        recipients: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/RecipientInfo' },
                        },
                    },
                },
            },
            responses: {
                ValidationError: {
                    description: 'Validation error',
                    content: {
                        'application/json': {
                            schema: {
                                allOf: [
                                    { $ref: '#/components/schemas/ApiError' },
                                    {
                                        type: 'object',
                                        properties: {
                                            details: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        path: { type: 'string' },
                                                        msg: { type: 'string' },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        },
    };
    return doc;
}

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const UserRequestDto = require('./dtos/user/UserRequestDto');

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Loan Management API",
      version: "1.0.0",
      description: "API documentation",
    },
    servers: [
      {
        url: `${process.env.SWAGGER_SERVER_URL || 'http://localhost:6505'}`,
      },
    ],
    components: {
      schemas: {
        UserCreate: UserRequestDto.getSwaggerSchema(true),
        UserUpdate: UserRequestDto.getSwaggerSchema(false),
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Validation error'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          }
        },
        InvitationStatus: {
          type: 'string',
          enum: ['pending', 'accepted', 'expired', 'revoked'],
          example: 'pending'
        },
        Invitation: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 22 },
            email: { type: 'string', format: 'email', example: 'invitee@example.com' },
            first_name: { type: 'string', nullable: true, example: 'Jane' },
            middle_name: { type: 'string', nullable: true, example: null },
            last_name: { type: 'string', nullable: true, example: 'Doe' },
            phone: { type: 'string', nullable: true, example: '254700123456' },
            role: { type: 'integer', example: 2 },
            role_name: { type: 'string', nullable: true, example: 'Manager' },
            status: { $ref: '#/components/schemas/InvitationStatus' },
            expires_at: { type: 'string', format: 'date-time', example: '2026-08-24T12:00:00.000Z' },
            accepted_at: { type: 'string', format: 'date-time', nullable: true, example: null },
            revoked_at: { type: 'string', format: 'date-time', nullable: true, example: null },
            invited_by: { type: 'integer', nullable: true, example: 1 },
            created_user_id: { type: 'integer', nullable: true, example: null },
            created_at: { type: 'string', format: 'date-time', example: '2026-08-21T12:00:00.000Z' }
          }
        },
        InvitationCreateRequest: {
          type: 'object',
          required: ['email', 'role'],
          properties: {
            email: { type: 'string', format: 'email', example: 'invitee@example.com' },
            role: { type: 'integer', example: 2 },
            first_name: { type: 'string', nullable: true, example: 'Jane' },
            middle_name: { type: 'string', nullable: true, example: 'A' },
            last_name: { type: 'string', nullable: true, example: 'Doe' },
            phone: { type: 'string', nullable: true, example: '254700123456' }
          }
        },
        InvitationAcceptRequest: {
          type: 'object',
          required: ['token', 'first_name', 'last_name', 'password'],
          properties: {
            token: { type: 'string', example: 'f2c8d1e1f2c8d1e1f2c8d1e1f2c8d1e1' },
            first_name: { type: 'string', example: 'Jane' },
            middle_name: { type: 'string', nullable: true, example: 'A' },
            last_name: { type: 'string', example: 'Doe' },
            phone: { type: 'string', nullable: true, example: '254700123456' },
            id_number: { type: 'string', nullable: true, example: 'ID-900011' },
            password: { type: 'string', minLength: 8, example: 'StrongPass1' }
          }
        },
        InvitationListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Invitation' }
            }
          }
        },
        InvitationCreateResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { $ref: '#/components/schemas/Invitation' },
            inviteUrl: { type: 'string', example: 'https://portal.example.com/accept-invite?token=<token>' },
            warnings: {
              type: 'array',
              items: { type: 'string' },
              example: []
            }
          }
        },
        InvitationAcceptResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Registration complete. You can now log in.' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 101 },
                email: { type: 'string', format: 'email', example: 'invitee@example.com' },
                role: { type: 'integer', example: 2 }
              }
            }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  
  // IMPORTANT: point this to your route files
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };

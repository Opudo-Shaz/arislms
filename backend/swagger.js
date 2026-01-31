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
        url: `http://localhost:${process.env.SERVER_PORT || 3002}`,
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
  
  // 👇 IMPORTANT: point this to your route files
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };

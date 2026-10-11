import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Store Management System API',
      version: '1.0.0',
      description: 'Comprehensive REST API for Store Management System',
      contact: {
        name: 'Support',
        email: 'support@storemgmt.local',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development Server',
      },
      {
        url: 'https://api.storemgmt.local/api',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./server/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

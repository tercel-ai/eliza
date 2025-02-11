import swaggerAutogen from 'swagger-autogen';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


const port = process.env.SERVER_PORT ?? 3000;
const srvUrl = process.env.SERVER_URL ?? 'http://localhost:' + port;
const url = new URL(srvUrl);
const doc = {
    info: {
        title: 'Eliza Direct API',
        description: 'Eliza Direct Management API Documentation'
    },
    host: url.host,
    basePath: '/manage',
    schemes: ['http', 'https'],
    securityDefinitions: {
        Authorization: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization'
        },
    },
    security: [
        {
            Authorization: [],
        }
    ]
};

const outputFile = './swagger-manage-api.json';
const routes = [
    './src/manage-api.ts',
];

async function generateSwagger() {
    try {
        await swaggerAutogen()(outputFile, routes, doc);
        console.log('Swagger documentation generated successfully');
    } catch (error) {
        console.error('Error generating swagger documentation:', error);
    }
}

generateSwagger();
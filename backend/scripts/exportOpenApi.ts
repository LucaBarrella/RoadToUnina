import fs from 'fs';
import path from 'path';
import { openApiSpec } from '../src/config/openApiSpec';

const outputPath = path.resolve(__dirname, '../../openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2), 'utf-8');
console.log(`✅ OpenAPI specification exported successfully to: ${outputPath}`);

const fs = require('fs');
const path = require('path');

async function run() {
    const { OWLParser } = require('../out/owlParser');
    const samplePath = path.join(__dirname, '..', 'sample.ttl');
    const content = fs.readFileSync(samplePath, 'utf8');

    const parser = new OWLParser();
    const data = await parser.parse(content);

    console.log('--- Parsed data summary ---');
    console.log('Nodes:', data.nodes.length, 'Edges:', data.edges.length);
    console.log('Metadata:', data.metadata);
}

run().catch(error => {
    console.error('Failed to run sample parser:', error);
    process.exit(1);
});

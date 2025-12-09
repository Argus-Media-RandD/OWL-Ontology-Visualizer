const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const samplePath = path.join(__dirname, '..', 'sample.ttl');

function loadParser() {
    try {
        return require('../out/owlParser').OWLParser;
    } catch (error) {
        throw new Error('Unable to load compiled parser. Make sure to run "npm run compile" before executing tests.');
    }
}

test('OWLParser parses sample.ttl without errors', async () => {
    const OWLParser = loadParser();
    const content = fs.readFileSync(samplePath, 'utf8');
    const parser = new OWLParser();

    const data = await parser.parse(content);

    assert.equal(data.metadata.ontologyURI, 'http://example.org/animals');
    assert.equal(data.nodes.length, 25);
    assert.equal(data.edges.length, 25);
    assert.ok(data.nodes.some(node => node.type === 'class'));
    assert.ok(data.nodes.some(node => node.type === 'property'));
    assert.ok(data.nodes.some(node => node.type === 'individual'));
    assert.ok(
        data.edges.some(edge => edge.type === 'type' && edge.source === 'Buddy' && edge.target === 'Dog'),
        'Expected Buddy to have an instanceOf edge to Dog'
    );
    assert.ok(
        data.nodes.some(node => node.type === 'skosConceptScheme' && node.id === 'Usage'),
        'Expected Usage concept scheme node'
    );
    assert.ok(
        data.nodes.some(node => node.type === 'skosConcept' && node.id === 'pet'),
        'Expected pet concept node'
    );
    assert.ok(
        data.edges.some(edge => edge.type === 'skosInScheme' && edge.source === 'pet' && edge.target === 'Usage'),
        'Expected pet to link to Usage via inScheme'
    );
    assert.ok(
        data.edges.some(edge => edge.type === 'range' && edge.source === 'usedAs' && edge.target === 'Usage'),
        'Expected usedAs range to point to Usage concept scheme'
    );
});

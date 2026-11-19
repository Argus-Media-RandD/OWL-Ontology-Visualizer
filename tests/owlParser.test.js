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
    assert.equal(data.nodes.length, 34);
    assert.equal(data.edges.length, 44);
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

    const buddyAge = data.edges.find(
        edge => edge.type === 'dataAssertion' && edge.source === 'Buddy' && edge.label === 'age'
    );
    assert.ok(buddyAge, 'Expected Buddy to have an age assertion');
    assert.ok(
        data.nodes.some(node => node.id === buddyAge.target && node.type === 'literal' && node.label === '5\n(integer)'),
        'Expected Buddy age assertion to reference the typed literal 5'
    );

    const buddyHabitat = data.edges.filter(
        edge => edge.type === 'propertyAssertion' && (
            (edge.source === 'Buddy' && edge.target === 'MyHouse') ||
            (edge.source === 'MyHouse' && edge.target === 'Buddy')
        )
    );
    assert.equal(buddyHabitat.length, 1, 'Expected inverse habitat assertions to share one edge');
    assert.equal(buddyHabitat[0].bidirectional, true);
    assert.deepEqual(new Set(buddyHabitat[0].label.split(' / ')), new Set(['lives in', 'has fauna']));
});

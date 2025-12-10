import { Parser, Store, Quad, NamedNode, Term, Literal } from 'n3';

export interface OntologyNode {
    id: string;
    label: string;
    type: 'class' | 'property' | 'individual' | 'ontology' | 'skosConcept' | 'skosConceptScheme' | 'literal';
    uri?: string;
}

export interface OntologyEdge {
    id: string;
    source: string;
    target: string;
    label: string;
    type: 'subClassOf' | 'subPropertyOf' | 'type' | 'domain' | 'range' | 'skosInScheme' | 'propertyAssertion' | 'dataAssertion' | 'other';
}

export interface OntologyData {
    nodes: OntologyNode[];
    edges: OntologyEdge[];
    metadata: {
        ontologyURI?: string;
        title?: string;
        description?: string;
    };
}

export class OWLParser {
    private store: Store;
    private prefixes: Map<string, string>;

    constructor() {
        this.store = new Store();
        this.prefixes = new Map();
        
        // Common OWL/RDF prefixes
        this.prefixes.set('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
        this.prefixes.set('rdfs', 'http://www.w3.org/2000/01/rdf-schema#');
        this.prefixes.set('owl', 'http://www.w3.org/2002/07/owl#');
        this.prefixes.set('xsd', 'http://www.w3.org/2001/XMLSchema#');
    }

    async parse(owlContent: string): Promise<OntologyData> {
        try {
            console.log('OWL Parser: Starting to parse content of length:', owlContent.length);
            console.log('OWL Parser: First 200 characters:', owlContent.substring(0, 200));
            
            // For now, we'll focus on Turtle format since N3 handles it well
            // If the content looks like RDF/XML, we'll give a helpful error
            if (owlContent.trim().startsWith('<?xml') || owlContent.includes('<rdf:RDF')) {
                throw new Error('RDF/XML format detected. Please convert your OWL file to Turtle format (.ttl) for better compatibility. You can use online converters or tools like Protégé to export as Turtle.');
            }
            
            // Parse using N3 (supports Turtle, N-Triples, N-Quads)
            const parser = new Parser();
            console.log('OWL Parser: Created N3 parser, attempting to parse...');
            const quads = parser.parse(owlContent);
            console.log('OWL Parser: Parsed', quads.length, 'quads');
            
            // Clear store and add new quads
            this.store = new Store();
            this.store.addQuads(quads);
            console.log('OWL Parser: Added quads to store, total quads in store:', this.store.size);
            
            const result = this.extractOntologyData();
            console.log('OWL Parser: Extraction complete. Found', result.nodes.length, 'nodes and', result.edges.length, 'edges');
            
            return result;
        } catch (error) {
            console.error('Error parsing OWL:', error);
            throw new Error(`Failed to parse OWL file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private extractOntologyData(): OntologyData {
        console.log('OWL Parser: Starting extraction from store with', this.store.size, 'quads');
        
        const nodes = new Map<string, OntologyNode>();
        const edges: OntologyEdge[] = [];
        const metadata: OntologyData['metadata'] = {};
        const propertyDetails = new Map<string, { id: string; kind: 'object' | 'data' | 'annotation' | 'unknown' }>();

        // Debug: Log first few quads to see what we have
        const allQuads = this.store.getQuads(null, null, null, null);
        console.log('OWL Parser: Sample quads:');
        allQuads.slice(0, 5).forEach((quad, i) => {
            console.log(`  ${i}: ${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`);
        });

        // Extract ontology metadata
        const ontologyQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Ontology', null);
        console.log('OWL Parser: Found', ontologyQuads.length, 'ontology declarations');
        
        if (ontologyQuads.length > 0) {
            const ontologyURI = ontologyQuads[0].subject.value;
            metadata.ontologyURI = ontologyURI;
            
            // Try to get title and description
            const titleQuads = this.store.getQuads(ontologyQuads[0].subject, 'http://purl.org/dc/elements/1.1/title', null, null);
            if (titleQuads.length > 0) {
                metadata.title = titleQuads[0].object.value;
            }
            
            const descQuads = this.store.getQuads(ontologyQuads[0].subject, 'http://purl.org/dc/elements/1.1/description', null, null);
            if (descQuads.length > 0) {
                metadata.description = descQuads[0].object.value;
            }
        }

        // Extract classes - try multiple approaches
        let classQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class', null);
        console.log('OWL Parser: Found', classQuads.length, 'owl:Class declarations');
        
        // Also look for rdfs:Class
        const rdfsClassQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2000/01/rdf-schema#Class', null);
        console.log('OWL Parser: Found', rdfsClassQuads.length, 'rdfs:Class declarations');
        
        // Combine both types of class declarations
        classQuads = [...classQuads, ...rdfsClassQuads];
        
        // Also infer classes from subClassOf relationships
        const subClassQuads = this.store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#subClassOf', null, null);
        console.log('OWL Parser: Found', subClassQuads.length, 'subClassOf relationships');
        
        // Add subjects and objects of subClassOf as classes
        subClassQuads.forEach(quad => {
            if (quad.subject.termType === 'NamedNode') {
                const uri = quad.subject.value;
                const id = this.getLocalName(uri);
                if (!nodes.has(id)) {
                    nodes.set(id, {
                        id,
                        label: this.getLabel(quad.subject) || id,
                        type: 'class',
                        uri
                    });
                }
            }
            
            if (quad.object.termType === 'NamedNode') {
                const uri = quad.object.value;
                const id = this.getLocalName(uri);
                if (!nodes.has(id)) {
                    nodes.set(id, {
                        id,
                        label: this.getLabel(quad.object) || id,
                        type: 'class',
                        uri
                    });
                }
            }
        });
        
        classQuads.forEach(quad => {
            // Skip blank nodes for classes as they're typically not meaningful for visualization
            if (quad.subject.termType !== 'NamedNode') {
                return;
            }
            
            const uri = quad.subject.value;
            const id = this.getLocalName(uri);
            if (!nodes.has(id)) {
                nodes.set(id, {
                    id,
                    label: this.getLabel(quad.subject) || id,
                    type: 'class',
                    uri
                });
            }
        });

        console.log('OWL Parser: After class extraction, found', Array.from(nodes.values()).filter(n => n.type === 'class').length, 'classes');

        // Extract properties
        const propertyTypes = [
            'http://www.w3.org/2002/07/owl#ObjectProperty',
            'http://www.w3.org/2002/07/owl#DatatypeProperty',
            'http://www.w3.org/2002/07/owl#AnnotationProperty',
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property'
        ];

        propertyTypes.forEach(propertyType => {
            const propQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', propertyType, null);
            console.log('OWL Parser: Found', propQuads.length, 'properties of type', propertyType);
            
            propQuads.forEach(quad => {
                // Skip blank nodes for properties
                if (quad.subject.termType !== 'NamedNode') {
                    return;
                }
                
                const uri = quad.subject.value;
                const id = this.getLocalName(uri);
                if (!nodes.has(id)) {
                    nodes.set(id, {
                        id,
                        label: this.getLabel(quad.subject) || id,
                        type: 'property',
                        uri
                    });
                }

                const kind = this.classifyPropertyKind(propertyType);
                const existingDetail = propertyDetails.get(uri);
                if (!existingDetail || existingDetail.kind === 'unknown') {
                    propertyDetails.set(uri, { id, kind });
                }
            });
        });

        // Also infer properties from domain/range declarations
        const domainQuads = this.store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#domain', null, null);
        const rangeQuads = this.store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#range', null, null);
        console.log('OWL Parser: Found', domainQuads.length, 'domain declarations and', rangeQuads.length, 'range declarations');
        
        [...domainQuads, ...rangeQuads].forEach(quad => {
            if (quad.subject.termType === 'NamedNode') {
                const uri = quad.subject.value;
                const id = this.getLocalName(uri);
                if (!nodes.has(id)) {
                    nodes.set(id, {
                        id,
                        label: this.getLabel(quad.subject) || id,
                        type: 'property',
                        uri
                    });
                }

                if (!propertyDetails.has(uri)) {
                    propertyDetails.set(uri, { id, kind: 'unknown' });
                }
            }
        });

        console.log('OWL Parser: After property extraction, found', Array.from(nodes.values()).filter(n => n.type === 'property').length, 'properties');

        // Extract individuals
        const individualQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#NamedIndividual', null);
        console.log('OWL Parser: Found', individualQuads.length, 'named individuals');

        individualQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode') {
                return;
            }

            const uri = quad.subject.value;
            const id = this.getLocalName(uri);
            if (!nodes.has(id)) {
                nodes.set(id, {
                    id,
                    label: this.getLabel(quad.subject) || id,
                    type: 'individual',
                    uri
                });
            }
        });

        console.log('OWL Parser: After individual extraction, found', Array.from(nodes.values()).filter(n => n.type === 'individual').length, 'individuals');

        let edgeCounter = 0;

        // SubClass relationships
        subClassQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }

            const sourceId = this.getLocalName(quad.subject.value);
            const targetId = this.getLocalName(quad.object.value);

            // Ensure both nodes exist
            this.ensureNode(nodes, sourceId, quad.subject.value, 'class');
            this.ensureNode(nodes, targetId, quad.object.value, 'class');

            edges.push({
                id: `edge_${edgeCounter++}`,
                source: sourceId,
                target: targetId,
                label: 'subClassOf',
                type: 'subClassOf'
            });
        });

        // SubProperty relationships
        const subPropertyQuads = this.store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf', null, null);
        subPropertyQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }

            const sourceId = this.getLocalName(quad.subject.value);
            const targetId = this.getLocalName(quad.object.value);

            this.ensureNode(nodes, sourceId, quad.subject.value, 'property');
            this.ensureNode(nodes, targetId, quad.object.value, 'property');

            edges.push({
                id: `edge_${edgeCounter++}`,
                source: sourceId,
                target: targetId,
                label: 'subPropertyOf',
                type: 'subPropertyOf'
            });
        });

        // Domain relationships
        domainQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }

            const propertyId = this.getLocalName(quad.subject.value);
            const domainClassId = this.getLocalName(quad.object.value);

            this.ensureNode(nodes, propertyId, quad.subject.value, 'property');
            this.ensureNode(nodes, domainClassId, quad.object.value, 'class');

            edges.push({
                id: `edge_${edgeCounter++}`,
                source: domainClassId,
                target: propertyId,
                label: 'domain',
                type: 'domain'
            });
        });

        // Range relationships (with SKOS-aware resolution)
        const rangeEdgeKeys = new Set<string>();
        rangeQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode') {
                return;
            }

            const sourceId = this.getLocalName(quad.subject.value);
            const targets = this.resolveRangeTargets(quad.object);

            if (targets.length === 0 && quad.object.termType === 'NamedNode') {
                targets.push({ node: quad.object as NamedNode, type: 'class' });
            }

            targets.forEach(({ node: targetNode, type }) => {
                const targetId = this.getLocalName(targetNode.value);
                const edgeKey = `${sourceId}->${targetId}`;
                if (rangeEdgeKeys.has(edgeKey)) {
                    return;
                }
                rangeEdgeKeys.add(edgeKey);

                this.ensureNode(nodes, sourceId, quad.subject.value, 'property');
                this.ensureNode(nodes, targetId, targetNode.value, type);

                edges.push({
                    id: `edge_${edgeCounter++}`,
                    source: sourceId,
                    target: targetId,
                    label: 'range',
                    type: 'range'
                });
            });
        });

        edgeCounter = this.extractSkosData(nodes, edges, edgeCounter);

        // Add connectors from classes to individual instances via rdf:type relationships
        const classUris = new Set<string>();
        nodes.forEach(node => {
            if (node.type === 'class' && node.uri) {
                classUris.add(node.uri);
            }
        });

        console.log('OWL Parser: Prepared', classUris.size, 'class URIs for instance linking');

        const builtinTypeNamespaces = [
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'http://www.w3.org/2000/01/rdf-schema#',
            'http://www.w3.org/2002/07/owl#'
        ];

        const typeQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', null, null);
        console.log('OWL Parser: Scanning', typeQuads.length, 'rdf:type statements for instances');

        const typeEdgeKeys = new Set<string>();
        let instanceEdgeCount = 0;

        typeQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }

            const individualUri = quad.subject.value;
            const classUri = quad.object.value;

            const isKnownClass = classUris.has(classUri) || !builtinTypeNamespaces.some(ns => classUri.startsWith(ns));
            if (!isKnownClass) {
                return;
            }

            const individualId = this.getLocalName(individualUri);
            const classId = this.getLocalName(classUri);

            const existingNode = nodes.get(individualId);
            if (existingNode && existingNode.type !== 'individual') {
                return;
            }

            if (!nodes.has(individualId)) {
                nodes.set(individualId, {
                    id: individualId,
                    label: this.getLabel(quad.subject) || individualId,
                    type: 'individual',
                    uri: individualUri
                });
            } else {
                const individualNode = nodes.get(individualId)!;
                if (!individualNode.uri) {
                    individualNode.uri = individualUri;
                }
                if (!individualNode.label || individualNode.label === individualId) {
                    const nodeLabel = this.getLabel(quad.subject);
                    if (nodeLabel) {
                        individualNode.label = nodeLabel;
                    }
                }
            }

            if (!nodes.has(classId)) {
                nodes.set(classId, {
                    id: classId,
                    label: this.getLabel(quad.object) || classId,
                    type: 'class',
                    uri: classUri
                });
            }

            classUris.add(classUri);

            const edgeKey = `${classId}->${individualId}`;
            if (typeEdgeKeys.has(edgeKey)) {
                return;
            }
            typeEdgeKeys.add(edgeKey);

            edges.push({
                id: `edge_${edgeCounter++}`,
                source: individualId,
                target: classId,
                label: 'instanceOf',
                type: 'type'
            });

            instanceEdgeCount++;
        });

        console.log('OWL Parser: Added', instanceEdgeCount, 'individual-to-class instance relationships');

        const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
        const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
        const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment';

        const individualIds = new Set<string>();
        nodes.forEach(node => {
            if (node.type === 'individual') {
                individualIds.add(node.id);
            }
        });

        const literalNodeCache = new Map<string, string>();
        const assertionEdgeKeys = new Set<string>();
        let objectAssertionCount = 0;
        let dataAssertionCount = 0;

        if (individualIds.size > 0) {
            const allQuadsForAssertions = this.store.getQuads(null, null, null, null);

            allQuadsForAssertions.forEach(quad => {
                if (quad.subject.termType !== 'NamedNode' || quad.predicate.termType !== 'NamedNode') {
                    return;
                }

                const subjectId = this.getLocalName(quad.subject.value);
                if (!individualIds.has(subjectId)) {
                    return;
                }

                const predicateUri = quad.predicate.value;
                if (predicateUri === RDF_TYPE || predicateUri === RDFS_LABEL || predicateUri === RDFS_COMMENT) {
                    return;
                }

                const propertyId = this.getLocalName(predicateUri);
                const propertyNode = nodes.get(propertyId);
                const propertyInfo = propertyDetails.get(predicateUri);

                if ((!propertyNode || propertyNode.type !== 'property') && !propertyInfo) {
                    return;
                }

                const edgeLabel = propertyNode?.label || this.getLabel(quad.predicate) || propertyId;
                const edgeKeyBase = `${subjectId}|${predicateUri}|${quad.object.value}`;

                if (quad.object.termType === 'NamedNode') {
                    if (assertionEdgeKeys.has(edgeKeyBase)) {
                        return;
                    }
                    assertionEdgeKeys.add(edgeKeyBase);

                    const targetId = this.getLocalName(quad.object.value);
                    if (!nodes.has(targetId)) {
                        const inferredType = this.inferNodeTypeForResource(quad.object as NamedNode);
                        nodes.set(targetId, {
                            id: targetId,
                            label: this.getLabel(quad.object) || targetId,
                            type: inferredType,
                            uri: quad.object.value
                        });
                    } else {
                        const targetNode = nodes.get(targetId)!;
                        if (!targetNode.uri) {
                            targetNode.uri = quad.object.value;
                        }
                    }

                    edges.push({
                        id: `edge_${edgeCounter++}`,
                        source: subjectId,
                        target: targetId,
                        label: edgeLabel,
                        type: 'propertyAssertion'
                    });
                    objectAssertionCount++;
                } else if (quad.object.termType === 'Literal') {
                    if (assertionEdgeKeys.has(edgeKeyBase)) {
                        return;
                    }
                    assertionEdgeKeys.add(edgeKeyBase);

                    const literal = quad.object as Literal;
                    const literalKey = `${literal.value}@@${literal.datatype ? literal.datatype.value : ''}@@${literal.language || ''}`;
                    let literalId = literalNodeCache.get(literalKey);
                    if (!literalId) {
                        literalId = `literal_${literalNodeCache.size + 1}`;
                        literalNodeCache.set(literalKey, literalId);
                        nodes.set(literalId, {
                            id: literalId,
                            label: this.formatLiteral(literal),
                            type: 'literal'
                        });
                    }

                    edges.push({
                        id: `edge_${edgeCounter++}`,
                        source: subjectId,
                        target: literalId,
                        label: edgeLabel,
                        type: 'dataAssertion'
                    });
                    dataAssertionCount++;
                }
            });
        }

        console.log('OWL Parser: Added', objectAssertionCount, 'object property assertions and', dataAssertionCount, 'data property assertions for instances');

        console.log('OWL Parser: Final result - nodes:', nodes.size, 'edges:', edges.length);
        console.log('OWL Parser: Node breakdown:', {
            classes: Array.from(nodes.values()).filter(n => n.type === 'class').length,
            properties: Array.from(nodes.values()).filter(n => n.type === 'property').length,
            individuals: Array.from(nodes.values()).filter(n => n.type === 'individual').length,
            skosConcepts: Array.from(nodes.values()).filter(n => n.type === 'skosConcept').length,
            skosConceptSchemes: Array.from(nodes.values()).filter(n => n.type === 'skosConceptScheme').length,
            literals: Array.from(nodes.values()).filter(n => n.type === 'literal').length
        });

        return {
            nodes: Array.from(nodes.values()),
            edges,
            metadata
        };
    }

    private ensureNode(nodes: Map<string, OntologyNode>, id: string, uri: string, type: OntologyNode['type']) {
        if (!nodes.has(id)) {
            nodes.set(id, {
                id,
                label: this.getLocalName(uri),
                type,
                uri
            });
        }
    }

    private resolveRangeTargets(term: Term): Array<{ node: NamedNode; type: OntologyNode['type'] }> {
        const results: Array<{ node: NamedNode; type: OntologyNode['type'] }> = [];

        if (term.termType === 'NamedNode') {
            results.push({ node: term, type: 'class' });
            return results;
        }

        if (term.termType === 'BlankNode') {
            const schemes = this.extractConceptSchemesFromRange(term, new Set());
            schemes.forEach(namedNode => {
                results.push({ node: namedNode, type: 'skosConceptScheme' });
            });
        }

        return results;
    }

    private extractConceptSchemesFromRange(term: Term, visited: Set<string>): NamedNode[] {
        const results: NamedNode[] = [];

        if (term.termType !== 'BlankNode') {
            return results;
        }

        if (visited.has(term.value)) {
            return results;
        }
        visited.add(term.value);

        const OWL_INTERSECTION = 'http://www.w3.org/2002/07/owl#intersectionOf';
        const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
        const OWL_HAS_VALUE = 'http://www.w3.org/2002/07/owl#hasValue';
        const SKOS_IN_SCHEME = 'http://www.w3.org/2004/02/skos/core#inScheme';

        const onPropertyQuads = this.store.getQuads(term, OWL_ON_PROPERTY, null, null);
        const isInSchemeRestriction = onPropertyQuads.some(quad => quad.object.termType === 'NamedNode' && quad.object.value === SKOS_IN_SCHEME);
        if (isInSchemeRestriction) {
            const hasValueQuads = this.store.getQuads(term, OWL_HAS_VALUE, null, null);
            hasValueQuads.forEach(quad => {
                if (quad.object.termType === 'NamedNode') {
                    results.push(quad.object);
                }
            });
        }

        const intersectionQuads = this.store.getQuads(term, OWL_INTERSECTION, null, null);
        intersectionQuads.forEach(quad => {
            const listElements = this.expandRdfList(quad.object);
            listElements.forEach(element => {
                if (element.termType === 'BlankNode') {
                    results.push(...this.extractConceptSchemesFromRange(element, visited));
                }
            });
        });

        return results;
    }

    private expandRdfList(listNode: Term): Term[] {
        const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
        const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
        const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';

        const elements: Term[] = [];
        const visited = new Set<string>();
        let current: Term | null = listNode;

        while (current && (current.termType === 'BlankNode' || current.termType === 'NamedNode')) {
            if (current.termType === 'NamedNode' && current.value === RDF_NIL) {
                break;
            }

            if (visited.has(current.value)) {
                break;
            }
            visited.add(current.value);

            const firstQuad: Quad | null = this.store.getQuads(current, RDF_FIRST, null, null)[0] ?? null;
            if (!firstQuad) {
                break;
            }
            elements.push(firstQuad.object);

            const restQuad: Quad | null = this.store.getQuads(current, RDF_REST, null, null)[0] ?? null;
            if (!restQuad) {
                break;
            }

            if (restQuad.object.termType === 'NamedNode' && restQuad.object.value === RDF_NIL) {
                break;
            }

            current = restQuad.object;
        }

        return elements;
    }

    private extractSkosData(nodes: Map<string, OntologyNode>, edges: OntologyEdge[], edgeCounter: number): number {
        const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
        const SKOS_CONCEPT = 'http://www.w3.org/2004/02/skos/core#Concept';
        const SKOS_CONCEPT_SCHEME = 'http://www.w3.org/2004/02/skos/core#ConceptScheme';
        const SKOS_IN_SCHEME = 'http://www.w3.org/2004/02/skos/core#inScheme';

        const conceptSchemeQuads = this.store.getQuads(null, RDF_TYPE, SKOS_CONCEPT_SCHEME, null);
        conceptSchemeQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode') {
                return;
            }

            const uri = quad.subject.value;
            const id = this.getLocalName(uri);
            if (!nodes.has(id)) {
                nodes.set(id, {
                    id,
                    label: this.getLabel(quad.subject) || id,
                    type: 'skosConceptScheme',
                    uri
                });
            }
        });

        const conceptQuads = this.store.getQuads(null, RDF_TYPE, SKOS_CONCEPT, null);
        conceptQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode') {
                return;
            }

            const uri = quad.subject.value;
            const id = this.getLocalName(uri);
            if (!nodes.has(id)) {
                nodes.set(id, {
                    id,
                    label: this.getLabel(quad.subject) || id,
                    type: 'skosConcept',
                    uri
                });
            }
        });

        const inSchemeQuads = this.store.getQuads(null, SKOS_IN_SCHEME, null, null);
        const inSchemeEdgeKeys = new Set<string>();
        inSchemeQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }

            const conceptId = this.getLocalName(quad.subject.value);
            const schemeId = this.getLocalName(quad.object.value);
            const edgeKey = `${conceptId}->${schemeId}`;
            if (inSchemeEdgeKeys.has(edgeKey)) {
                return;
            }
            inSchemeEdgeKeys.add(edgeKey);

            this.ensureNode(nodes, conceptId, quad.subject.value, 'skosConcept');
            this.ensureNode(nodes, schemeId, quad.object.value, 'skosConceptScheme');

            edges.push({
                id: `edge_${edgeCounter++}`,
                source: conceptId,
                target: schemeId,
                label: 'inScheme',
                type: 'skosInScheme'
            });
        });

        return edgeCounter;
    }

    private classifyPropertyKind(propertyType: string): 'object' | 'data' | 'annotation' | 'unknown' {
        if (propertyType === 'http://www.w3.org/2002/07/owl#ObjectProperty') {
            return 'object';
        }
        if (propertyType === 'http://www.w3.org/2002/07/owl#DatatypeProperty') {
            return 'data';
        }
        if (propertyType === 'http://www.w3.org/2002/07/owl#AnnotationProperty') {
            return 'annotation';
        }
        return 'unknown';
    }

    private inferNodeTypeForResource(resource: NamedNode): OntologyNode['type'] {
        const typeQuads = this.store.getQuads(resource, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', null, null);
        for (const quad of typeQuads) {
            const typeUri = quad.object.value;
            if (typeUri === 'http://www.w3.org/2002/07/owl#Class' || typeUri === 'http://www.w3.org/2000/01/rdf-schema#Class') {
                return 'class';
            }
            if (typeUri === 'http://www.w3.org/2002/07/owl#ObjectProperty' || typeUri === 'http://www.w3.org/2002/07/owl#DatatypeProperty' || typeUri === 'http://www.w3.org/2002/07/owl#AnnotationProperty' || typeUri === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property') {
                return 'property';
            }
            if (typeUri === 'http://www.w3.org/2004/02/skos/core#Concept') {
                return 'skosConcept';
            }
            if (typeUri === 'http://www.w3.org/2004/02/skos/core#ConceptScheme') {
                return 'skosConceptScheme';
            }
            if (typeUri === 'http://www.w3.org/2002/07/owl#Ontology') {
                return 'ontology';
            }
            if (typeUri === 'http://www.w3.org/2002/07/owl#NamedIndividual') {
                return 'individual';
            }
        }
        return 'individual';
    }

    private formatLiteral(literal: Literal): string {
        let qualifier: string | null = null;

        if (literal.language) {
            qualifier = `@${literal.language}`;
        } else if (literal.datatype && literal.datatype.value) {
            const datatypeUri = literal.datatype.value;
            const datatypeLocal = this.getLocalName(datatypeUri);
            if (datatypeUri.startsWith('http://www.w3.org/2001/XMLSchema#')) {
                qualifier = datatypeLocal || 'string';
            } else if (datatypeLocal) {
                qualifier = datatypeLocal;
            } else {
                qualifier = datatypeUri;
            }
        } else {
            qualifier = 'string';
        }

        if (!qualifier) {
            return literal.value;
        }

        return `${literal.value}\n(${qualifier})`;
    }

    private getLocalName(uri: string): string {
        // Handle blank nodes
        if (uri.startsWith('_:')) {
            return uri; // Return the blank node identifier as-is
        }
        
        const hashIndex = uri.lastIndexOf('#');
        const slashIndex = uri.lastIndexOf('/');
        const lastIndex = Math.max(hashIndex, slashIndex);
        
        if (lastIndex >= 0 && lastIndex < uri.length - 1) {
            return uri.substring(lastIndex + 1);
        }
        
        return uri;
    }

    private getLabel(subject: Term): string | null {
        // Only try to get labels for NamedNodes, not BlankNodes
        if (subject.termType !== 'NamedNode') {
            return null;
        }
        
        const labelQuads = this.store.getQuads(subject as NamedNode, 'http://www.w3.org/2000/01/rdf-schema#label', null, null);
        if (labelQuads.length > 0) {
            return labelQuads[0].object.value;
        }
        return null;
    }
}
// Cytoscape.js styling configuration for OWL ontology visualization
// This file contains all node and edge styling definitions
// Place this file in: src/styles.js

const OWL_VISUALIZATION_STYLES = [
    // Base node styling
    {
        selector: 'node',
        style: {
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-weight': 'bold',
            'text-outline-width': 2,
            'text-outline-color': '#000000',
            'width': function(ele) {
                return Math.max(30, ele.data('label').length * 6);
            },
            'height': '30px',
            'border-width': 2,
            'border-color': '#FFFFFF',
            'text-wrap': 'wrap',
            'text-max-width': '120px'
        }
    },
    
    // OWL Class nodes (green rectangles)
    {
        selector: 'node[type = "class"]',
        style: {
            'background-color': '#22AA22',
            'color': 'white',
            'shape': 'rectangle'
        }
    },
    
    // OWL Property nodes (blue diamonds)
    {
        selector: 'node[type = "property"]',
        style: {
            'background-color': '#2288DD',
            'color': 'white',
            'shape': 'diamond'
        }
    },
    
    // OWL Individual nodes (orange ellipses)
    {
        selector: 'node[type = "individual"]',
        style: {
            'background-color': '#FF8800',
            'color': 'white',
            'shape': 'ellipse'
        }
    },

    // SKOS Concept nodes (purple hexagons)
    {
        selector: 'node[type = "skosConcept"]',
        style: {
            'background-color': '#6C5CE7',
            'color': 'white',
            'shape': 'hexagon'
        }
    },

    // SKOS Concept Scheme nodes (teal rectangles)
    {
        selector: 'node[type = "skosConceptScheme"]',
        style: {
            'background-color': '#00B894',
            'color': 'white',
            'shape': 'round-rectangle'
        }
    },
    
    // Ontology declaration nodes (purple rectangles)
    {
        selector: 'node[type = "ontology"]',
        style: {
            'background-color': '#AA44AA',
            'color': 'white',
            'shape': 'rectangle'
        }
    },
    
    // Default/unknown type nodes (gray rectangles)
    {
        selector: 'node[type != "class"][type != "property"][type != "individual"][type != "ontology"][type != "skosConcept"][type != "skosConceptScheme"]',
        style: {
            'background-color': '#666666',
            'color': 'white',
            'shape': 'rectangle'
        }
    },
    
    // Base edge styling
    {
        selector: 'edge',
        style: {
            'width': 2,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '12px',
            'font-weight': 'bold',
            'color': 'white',
            'text-background-color': '#000000',
            'text-background-opacity': 0.8,
            'text-background-padding': '4px'
        }
    },
    
    // SubClassOf relationships (green)
    {
        selector: 'edge[type = "subClassOf"]',
        style: {
            'line-color': '#22AA22',
            'target-arrow-color': '#22AA22'
        }
    },
    
    // SubPropertyOf relationships (blue)
    {
        selector: 'edge[type = "subPropertyOf"]',
        style: {
            'line-color': '#2288DD',
            'target-arrow-color': '#2288DD'
        }
    },
    
    // Domain relationships (red)
    {
        selector: 'edge[type = "domain"]',
        style: {
            'line-color': '#DD2222',
            'target-arrow-color': '#DD2222'
        }
    },
    
    // Range relationships (orange)
    {
        selector: 'edge[type = "range"]',
        style: {
            'line-color': '#FF8800',
            'target-arrow-color': '#FF8800'
        }
    },

    // Instance relationships (gold)
    {
        selector: 'edge[type = "type"]',
        style: {
            'line-color': '#E8B600',
            'target-arrow-color': '#E8B600',
            'line-style': 'dashed',
            'width': 3,
            'arrow-scale': 1.4
        }
    },

    // SKOS inScheme relationships (teal)
    {
        selector: 'edge[type = "skosInScheme"]',
        style: {
            'line-color': '#00B894',
            'target-arrow-color': '#00B894',
            'line-style': 'solid'
        }
    },
    
    // Default/unknown relationship types (gray)
    {
        selector: 'edge[type != "subClassOf"][type != "subPropertyOf"][type != "domain"][type != "range"][type != "type"][type != "skosInScheme"]',
        style: {
            'line-color': '#888888',
            'target-arrow-color': '#888888'
        }
    },
    
    // Selected node styling
    {
        selector: 'node:selected',
        style: {
            'border-width': 4,
            'border-color': '#0099FF'
        }
    },
    
    // Hover effects for nodes
    {
        selector: 'node:active',
        style: {
            'overlay-opacity': 0.2,
            'overlay-color': '#FFFFFF'
        }
    },
    
    // Edge hover effects
    {
        selector: 'edge:active',
        style: {
            'overlay-opacity': 0.2,
            'overlay-color': '#FFFFFF'
        }
    }
];
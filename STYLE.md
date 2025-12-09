# OWL Visualizer Styling Guide

The OWL Ontology Visualizer uses separated styling configuration for easy customization. All visual styles are defined in the `OWL_VISUALIZATION_STYLES` array within the webview.

## Node Types and Their Default Styles

### 🟢 Classes (`type = "class"`)

- **Color**: `#22AA22` (bright green)
- **Shape**: Rectangle
- **Usage**: Represents OWL classes and RDFS classes

### 🔷 Properties (`type = "property"`)

- **Color**: `#2288DD` (bright blue)
- **Shape**: Diamond
- **Usage**: Object properties, datatype properties, annotation properties

### 🟠 Individuals (`type = "individual"`)

- **Color**: `#FF8800` (bright orange)
- **Shape**: Ellipse
- **Usage**: Named individuals in the ontology

### 🟣 Ontology (`type = "ontology"`)

- **Color**: `#AA44AA` (purple)
- **Shape**: Rectangle
- **Usage**: Ontology declaration nodes

## Edge Types and Their Default Styles

### 🟢 SubClass Relationships (`type = "subClassOf"`)

- **Color**: `#22AA22` (green, matching class color)
- **Usage**: Class hierarchy relationships

### 🔷 SubProperty Relationships (`type = "subPropertyOf"`)

- **Color**: `#2288DD` (blue, matching property color)
- **Usage**: Property hierarchy relationships

### 🔴 Domain Relationships (`type = "domain"`)

- **Color**: `#DD2222` (red)
- **Usage**: Property domain declarations

### 🟠 Range Relationships (`type = "range"`)

- **Color**: `#FF8800` (orange)
- **Usage**: Property range declarations

## Customizing Styles

### Changing Node Colors

To change the color of a specific node type, find the corresponding selector and update the `background-color`:

```javascript
{
    selector: 'node[type = "class"]',
    style: {
        'background-color': '#YOUR_COLOR_HERE',
        'color': 'white',
        'shape': 'rectangle'
    }
}
```

### Changing Node Shapes

Available shapes include: `rectangle`, `roundrectangle`, `ellipse`, `triangle`, `diamond`, `pentagon`, `hexagon`, `octagon`, `star`

```javascript
{
    selector: 'node[type = "class"]',
    style: {
        'background-color': '#22AA22',
        'color': 'white',
        'shape': 'hexagon'  // Changed from rectangle
    }
}
```

### Changing Edge Styles

Modify edge appearance by updating the edge selectors:

```javascript
{
    selector: 'edge[type = "subClassOf"]',
    style: {
        'line-color': '#YOUR_COLOR_HERE',
        'target-arrow-color': '#YOUR_COLOR_HERE',
        'width': 3  // Make edges thicker
    }
}
```

### Adding Custom Node Types

To add support for new node types, add a new selector:

```javascript
{
    selector: 'node[type = "your_custom_type"]',
    style: {
        'background-color': '#FF00FF',
        'color': 'black',
        'shape': 'star'
    }
}
```

## Advanced Styling Options

### Dynamic Node Sizing

Nodes automatically size based on label length, but you can customize this:

```javascript
'width': function(ele) {
    const label = ele.data('label');
    return Math.max(50, label.length * 8); // Minimum 50px, 8px per character
},
'height': function(ele) {
    return ele.data('type') === 'class' ? 40 : 30; // Larger height for classes
}
```

### Text Styling

Customize text appearance:

```javascript
'font-size': '14px',
'font-weight': 'normal',
'text-outline-width': 1,
'text-outline-color': '#000000',
'color': '#FFFFFF'
```

### Border and Effects

Add borders and visual effects:

```javascript
'border-width': 3,
'border-color': '#FFFFFF',
'border-style': 'dashed',
'opacity': 0.9
```

## Color Scheme Recommendations

### Professional Theme

- Classes: `#2E7D32` (dark green)
- Properties: `#1565C0` (dark blue)
- Individuals: `#F57C00` (dark orange)
- Edges: Matching but slightly darker

### High Contrast Theme

- Classes: `#00FF00` (bright green)
- Properties: `#00CCFF` (cyan)
- Individuals: `#FFAA00` (bright orange)
- Background: `#000000` (black)

### Accessibility Theme

- Use colors that work for colorblind users
- Ensure sufficient contrast ratios
- Consider using different shapes to distinguish types

## Implementation Notes

- Styles are applied using Cytoscape.js selectors
- Colors can be in hex (`#FF0000`), RGB (`rgb(255,0,0)`), or named (`red`) format
- Changes require recompiling the extension
- The styling system uses CSS-like syntax but with Cytoscape.js property names

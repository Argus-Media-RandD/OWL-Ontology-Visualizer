# OWL Ontology Visualizer

A Visual Studio Code extension that provides interactive visualization of OWL (Web Ontology Language) ontologies using Cytoscape.js with real-time auto-updates and VS Code theme integration.

## ✨ Features

- **🎨 Theme-Aware Visualization**: Automatically adapts to VS Code's current theme (light/dark/high contrast)
- **🔄 Real-Time Auto-Updates**: Automatically refreshes visualization when you save changes to your ontology files
- **📊 Interactive Graph Visualization**: View your OWL ontologies as interactive node-link diagrams
- **🎛️ Multiple Layout Options**: Choose from hierarchical, circular, grid, force-directed, and breadth-first layouts
- **🎯 Visual Node Differentiation**: Clear distinction between classes (green rectangles), properties (blue diamonds), and individuals (orange circles)
- **🔗 Relationship Visualization**: Clear representation of subClassOf, subPropertyOf, domain, and range relationships
- **👆 Interactive Exploration**: Click on nodes to view detailed information with URI and metadata
- **📈 Real-Time Statistics**: Live display of ontology metrics (classes, properties, individuals, relationships)
- **🖱️ Smooth Navigation**: Zoom, pan, and layout controls with view state preservation during updates
- **📚 SKOS Taxonomy Support**: Visualizes SKOS ConceptSchemes, Concepts, and their property relationships

## 📁 Supported File Types

- `.ttl` files (Turtle format) - **Recommended**
- `.owl` files (RDF/XML format) - Convert to Turtle for best compatibility
- `.rdf` files (RDF/XML format) - Convert to Turtle for best compatibility

## 🚀 Installation

### Development (Extension Host)

1. Clone or download this repository
2. Open the project folder in VS Code
3. Run `npm install` to install dependencies
4. Press `F5` to launch the extension in a new Extension Development Host window

### Local VSIX Install

1. In the project directory run `npm install`
2. Execute `npm run deploy` (requires the `code` CLI) to compile, package, and install the VSIX in a single step

## 📖 Usage

### Opening an Ontology

1. Open an OWL/TTL file in VS Code
2. Right-click in the editor or on the file in Explorer
3. Select **"Visualize OWL Ontology"** from the context menu
4. The visualization opens in a new panel with auto-update enabled

### Controls & Navigation

- **Layout Selector**: Change between different graph layout algorithms
- **Fit to View**: Automatically zoom and center the entire graph
- **Reset Zoom**: Return to default zoom level and center
- **Node Selection**: Click any node to view its details (type, URI, properties)
- **Mouse Navigation**: Scroll to zoom, drag to pan around the graph
- **Export SVG**: Prompt for a save location and write the current visualization as an SVG file

### Auto-Update Features

- **File Watching**: The visualization automatically detects file changes
- **Live Refresh**: Updates the graph instantly when you save edits
- **View Preservation**: Maintains your zoom level, pan position, and selected layout
- **Status Indicator**: Shows update status with visual feedback (green dot pulses orange during updates)

## 🎨 Visual Elements

### Node Types

- **🟢 Classes**: Green rectangles representing OWL classes
- **🔷 Properties**: Blue diamonds for object/data/annotation properties  
- **🟠 Individuals**: Orange ellipses for named individuals
- **🟣 SKOS Concepts**: Purple hexagons for `skos:Concept` resources
- **🟩 SKOS ConceptSchemes**: Teal rounded rectangles for `skos:ConceptScheme` resources

### Edge Types

- **🟢 subClassOf**: Green arrows showing class hierarchies
- **🔷 subPropertyOf**: Blue arrows for property hierarchies
- **🔴 domain**: Red arrows from properties to their domain classes
- **🟠 range**: Orange arrows from properties to their range classes
- **🟡 instanceOf**: Gold arrows from individuals to their parent classes
- **🟣 inScheme**: Purple arrows from SKOS concepts to their concept schemes

### Theme Integration

- **Automatic Colors**: Uses VS Code's current theme colors for all UI elements
- **Font Matching**: Inherits VS Code's font family, size, and weight settings
- **Border & Focus**: Selection borders and focus indicators match your theme
- **Background**: Seamlessly blends with your editor's background color

## 🛠️ Development

### Project Structure

```text
├── src/
│   ├── extension.ts          # Main extension entry point & file watching
│   ├── owlParser.ts          # OWL/Turtle parsing with N3 library
│   ├── visualizationPanel.ts # Webview panel & Cytoscape integration
│   └── styles.js             # Cytoscape styling configuration
├── package.json              # Extension manifest & dependencies
├── tsconfig.json            # TypeScript configuration
└── language-configuration.json # OWL language support
```

### Building

```bash
npm install          # Install dependencies
npm run compile      # Build TypeScript
npm run watch        # Watch for changes during development
npm run deploy       # Compile, package, and install the VSIX locally
```

### Testing

```bash
npm test           # Compile and run parser tests against sample ontologies
npm run parser:sample # Compile and print parser output for sample.ttl
```

### Customizing Node Styles

Edit `src/styles.js` to customize the appearance of different node types:

```javascript
// Example: Change class nodes to be blue hexagons
{
    selector: 'node[type = "class"]',
    style: {
        'background-color': '#0066CC',
        'color': 'white',
        'shape': 'hexagon'
    }
}
```

For detailed styling options, see the [Styling Guide](STYLING.md).

### Packaging

Use the `deploy` script described above; it handles packaging and installation in one command.

## 🔧 Technical Details

### Dependencies

- **Cytoscape.js**: Graph visualization and interaction
- **N3**: Efficient RDF/Turtle parsing and manipulation
- **VS Code API**: Extension host and webview communication

### Architecture

- **Extension Host**: Handles file watching, parsing, and VS Code integration
- **Webview Panel**: Runs Cytoscape.js visualization in isolated context
- **Message Passing**: Real-time data updates without HTML regeneration
- **State Preservation**: Maintains view state across auto-updates

### Performance

- **Efficient Updates**: Only graph data updates during auto-refresh, not entire UI
- **Memory Management**: Proper cleanup of file watchers and webview resources
- **Large Ontologies**: Handles 1000+ nodes with smooth interaction

## ⚙️ Requirements

- **VS Code**: Version 1.74.0 or higher
- **Node.js**: Version 16.x or higher for development

## 🐛 Known Issues

- **RDF/XML Support**: Limited support for RDF/XML format - convert to Turtle (.ttl) for best results
- **Large Files**: Very large ontologies (5000+ nodes) may experience performance impacts
- **Complex OWL**: Some advanced OWL constructs may not be fully visualized

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests if applicable
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **Cytoscape.js** - Powerful graph visualization library
- **N3** - Efficient RDF parsing and manipulation
- **VS Code Team** - Excellent extension API and development experience

## 📝 Changelog

### 0.0.1 - Initial Release

- ✅ Interactive OWL/Turtle visualization with Cytoscape.js
- ✅ Multiple layout algorithms (hierarchical, circular, grid, force-directed)
- ✅ Real-time auto-updates with file watching
- ✅ Complete VS Code theme integration
- ✅ View state preservation during updates
- ✅ Interactive node exploration with metadata display
- ✅ Support for classes, properties, individuals, and relationships
- ✅ Visual status indicators and statistics panel

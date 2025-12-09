import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { OntologyData } from './owlParser';

export class VisualizationPanel {
    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    public show(ontologyData: OntologyData, fileName: string, forceReveal: boolean = true, isAutoUpdate: boolean = false, shouldSplitRight: boolean = false) {
        console.log('VisualizationPanel.show called with:', ontologyData);
        
        // Determine column placement
        let columnToShowIn: vscode.ViewColumn;
        
        if (shouldSplitRight) {
            // For new panels, split to the right of the active editor
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                columnToShowIn = activeEditor.viewColumn === vscode.ViewColumn.One 
                    ? vscode.ViewColumn.Two 
                    : vscode.ViewColumn.Three;
            } else {
                columnToShowIn = vscode.ViewColumn.Two;
            }
        } else {
            // Use existing logic for updates
            columnToShowIn = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.viewColumn || vscode.ViewColumn.One
                : vscode.ViewColumn.One;
        }

        if (this.panel && isAutoUpdate) {
            // For auto-updates, ONLY update the data via message passing
            this.updateVisualizationData(ontologyData);
            return; // Exit early, don't do anything else
        }

        if (this.panel) {
            // For manual updates when panel exists, regenerate the HTML
            this.panel.webview.html = this.getWebviewContent(ontologyData, fileName, isAutoUpdate);
            
            // Only reveal if explicitly requested (e.g., first time opening)
            if (forceReveal) {
                this.panel.reveal(columnToShowIn);
            }
        } else {
            // Create new panel
            this.panel = vscode.window.createWebviewPanel(
                'owlVisualization',
                `OWL Visualization - ${fileName}`,
                columnToShowIn,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [this.extensionUri]
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null);

            this.panel.webview.onDidReceiveMessage(async (message) => {
                if (message?.command === 'exportSvg') {
                    await this.handleSvgExport(message);
                }
            });

            this.panel.webview.html = this.getWebviewContent(ontologyData, fileName, isAutoUpdate);
        }
    }

    private async handleSvgExport(message: { svgContent: string; fileName?: string; }) {
        if (!this.panel) {
            return;
        }

        const defaultFileName = message.fileName && message.fileName.endsWith('.svg')
            ? message.fileName
            : `owl-visualization-${new Date().toISOString().replace(/[:.]/g, '-')}.svg`;
        const defaultUri = await this.getDefaultDownloadUri(defaultFileName);

        try {
            const targetUri = await vscode.window.showSaveDialog({
                defaultUri,
                filters: {
                    'Scalable Vector Graphics': ['svg']
                }
            });

            if (!targetUri) {
                this.panel.webview.postMessage({
                    command: 'exportResult',
                    status: 'cancelled'
                });
                return;
            }

            const data = Buffer.from(message.svgContent, 'utf8');
            await vscode.workspace.fs.writeFile(targetUri, data);

            this.panel.webview.postMessage({
                command: 'exportResult',
                status: 'success',
                path: targetUri.fsPath
            });
        } catch (error) {
            console.error('Failed to export SVG:', error);
            this.panel.webview.postMessage({
                command: 'exportResult',
                status: 'error',
                message: error instanceof Error ? error.message : String(error)
            });

            vscode.window.showErrorMessage(`Failed to export SVG: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getDefaultDownloadUri(fileName: string): Promise<vscode.Uri> {
        const downloadsPath = path.join(os.homedir(), 'Downloads');
        const directory = await this.getExistingDirectory(downloadsPath);
        return vscode.Uri.file(path.join(directory, fileName));
    }

    private async getExistingDirectory(preferredPath: string): Promise<string> {
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(preferredPath));
            if (stat && stat.type === vscode.FileType.Directory) {
                return preferredPath;
            }
        } catch (error) {
            // Directory doesn't exist or can't be accessed; fall through to default
        }

        return os.homedir();
    }

    private updateVisualizationData(ontologyData: OntologyData) {
        // Send a message to the webview to update the data
        if (this.panel) {
            console.log('Sending updateData message to webview with', ontologyData.nodes.length, 'nodes');
            this.panel.webview.postMessage({
                command: 'updateData',
                data: ontologyData
            });
        } else {
            console.error('Cannot update visualization data: panel is undefined');
        }
    }

    public isVisible(): boolean {
        return this.panel !== undefined;
    }

    public dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    private getWebviewContent(ontologyData: OntologyData, fileName: string, isAutoUpdate: boolean = false): string {
        // Get VS Code theme colors
        const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
        const isHighContrast = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;
        
        // Create theme-aware color configuration
        const themeColors = {
            isDark: isDarkTheme,
            isHighContrast: isHighContrast,
            // Default colors that work well in both themes
            classColor: isDarkTheme ? '#22CC22' : '#1B8E1B',
            propertyColor: isDarkTheme ? '#3399FF' : '#0066CC',
            individualColor: isDarkTheme ? '#FF9933' : '#CC6600',
            ontologyColor: isDarkTheme ? '#CC66CC' : '#9933AA',
            defaultColor: isDarkTheme ? '#888888' : '#666666',
            // Edge colors
            subClassColor: isDarkTheme ? '#22CC22' : '#1B8E1B',
            subPropertyColor: isDarkTheme ? '#3399FF' : '#0066CC',
            domainColor: isDarkTheme ? '#FF4444' : '#CC3333',
            rangeColor: isDarkTheme ? '#FF9933' : '#CC6600',
            defaultEdgeColor: isDarkTheme ? '#AAAAAA' : '#666666',
            // Text colors
            nodeTextColor: isDarkTheme ? '#FFFFFF' : '#000000',
            edgeTextColor: isDarkTheme ? '#FFFFFF' : '#000000',
            textOutlineColor: isDarkTheme ? '#000000' : '#FFFFFF',
            // Background colors
            backgroundColor: isDarkTheme ? '#1E1E1E' : '#FFFFFF',
            panelBackground: isDarkTheme ? '#252526' : '#F3F3F3'
        };
        
        // Create a URI for the styles file
        const stylesUri = this.panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'out', 'styles.js')  // Changed from 'src' to 'out'
        );
                        
        // Escape the data to prevent template literal issues
        const dataStr = JSON.stringify(ontologyData).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OWL Ontology Visualization</title>
    <script src="https://unpkg.com/cytoscape@3.26.0/dist/cytoscape.min.js"></script>
    <script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
    <script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>
    <script src="https://unpkg.com/klayjs@0.4.1/klay.js"></script>
    <script src="https://unpkg.com/cytoscape-klay@3.1.4/cytoscape-klay.js"></script>
    <script src="https://unpkg.com/cytoscape-svg@0.4.0/cytoscape-svg.js"></script>
    <script src="${stylesUri}"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            margin: 0;
            padding: 0;
            background-color: ${themeColors.backgroundColor};
            color: ${isDarkTheme ? '#CCCCCC' : '#333333'};
        }
        
        #container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        #header {
            padding: 10px 20px;
            background-color: ${themeColors.panelBackground};
            border-bottom: 1px solid ${isDarkTheme ? '#3C3C3C' : '#E1E1E1'};
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        #title {
            font-size: 16px;
            font-weight: 600;
        }
        
        #controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        #layoutSelect {
            background-color: #3C3C3C;
            color: #CCCCCC;
            border: 1px solid #3C3C3C;
            border-radius: 3px;
            padding: 4px 8px;
        }
        
        button {
            background-color: #0E639C;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
        }
        
        button:hover {
            background-color: #1177BB;
        }
        
        #cy {
            flex: 1;
            background-color: #1E1E1E;
        }
        
        #info {
            position: absolute;
            top: 60px;
            right: 20px;
            background-color: #252526;
            border: 1px solid #3C3C3C;
            border-radius: 5px;
            padding: 15px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: none;
        }
        
        #stats {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background-color: #252526;
            border: 1px solid #3C3C3C;
            border-radius: 5px;
            padding: 10px;
            font-size: 12px;
        }
        
        #file-status {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background-color: #252526;
            border: 1px solid #3C3C3C;
            border-radius: 5px;
            padding: 8px 12px;
            font-size: 11px;
            color: #CCCCCC;
        }
        
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
            background-color: #22AA22;
            transition: all 0.3s ease;
        }
        
        .status-indicator.updating {
            background-color: #FF8800;
            animation: pulse 1s ease-in-out;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        .node-info h3 {
            margin: 0 0 8px 0;
            color: #CCCCCC;
        }
        
        .node-info p {
            margin: 4px 0;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="header">
            <div id="title">OWL Ontology: ${fileName}</div>
            <div id="controls">
                <select id="layoutSelect">
                    <option value="dagre">Hierarchical (Dagre)</option>
                    <option value="klay">Hierarchical (Klay)</option>
                    <option value="circle">Circle</option>
                    <option value="grid">Grid</option>
                    <option value="cose">Force-directed (CoSE)</option>
                    <option value="breadthfirst">Breadth-first</option>
                </select>
                <button onclick="fitGraph()">Fit to View</button>
                <button onclick="resetZoom()">Reset Zoom</button>
                <button onclick="redrawDiagram()">Redraw</button>
                <button onclick="exportSvg()">Export SVG</button>
            </div>
        </div>
        
        <div id="cy"></div>
        
        <div id="info">
            <div id="nodeInfo" class="node-info"></div>
        </div>
        
        <div id="stats">
            <div>Classes: <span id="classCount">0</span></div>
            <div>Properties: <span id="propertyCount">0</span></div>
            <div>Individuals: <span id="individualCount">0</span></div>
            <div>SKOS Concepts: <span id="skosConceptCount">0</span></div>
            <div>Concept Schemes: <span id="skosConceptSchemeCount">0</span></div>
            <div>Relations: <span id="edgeCount">0</span></div>
        </div>
        
        <div id="file-status">
            <span class="status-indicator" id="statusDot"></span>
            <span id="statusText">Auto-updating</span>
        </div>
    </div>

    <script>
        (function() {
            const vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
            try {
                const ontologyData = JSON.parse('${dataStr}');
                
                console.log('Webview received ontology data:', ontologyData);
                console.log('Number of nodes:', ontologyData.nodes.length);
                console.log('Number of edges:', ontologyData.edges.length);
                
                if (typeof cytoscape === 'undefined') {
                    console.error('Cytoscape library not loaded');
                    document.getElementById('cy').innerHTML = '<div style="padding: 20px; color: red;">Error: Cytoscape library failed to load</div>';
                    return;
                }
                
                console.log('Creating Cytoscape instance...');

                let dagreAvailable = false;
                let klayAvailable = false;

                if (typeof cytoscapeSvg !== 'undefined') {
                    try {
                        cytoscape.use(cytoscapeSvg);
                    } catch (error) {
                        console.warn('Failed to register cytoscape-svg extension:', error);
                    }
                } else {
                    console.warn('cytoscape-svg extension not detected; SVG export will be disabled');
                }

                if (typeof cytoscapeDagre !== 'undefined') {
                    try {
                        cytoscape.use(cytoscapeDagre);
                        dagreAvailable = true;
                    } catch (error) {
                        console.warn('Failed to register cytoscape-dagre extension via use call:', error);
                    }
                } else {
                    console.warn('cytoscape-dagre global not detected; dagre registration skipped');
                }

                if (typeof cytoscapeKlay !== 'undefined') {
                    try {
                        cytoscape.use(cytoscapeKlay);
                        klayAvailable = true;
                    } catch (error) {
                        console.warn('Failed to register cytoscape-klay extension via use call:', error);
                    }
                } else {
                    console.warn('cytoscape-klay global not detected; klay registration skipped');
                }

                if (typeof cytoscape.extension === 'function') {
                    dagreAvailable = dagreAvailable || Boolean(cytoscape.extension('layout', 'dagre'));
                    klayAvailable = klayAvailable || Boolean(cytoscape.extension('layout', 'klay'));
                }

                if (!dagreAvailable) {
                    console.warn('cytoscape-dagre layout extension not detected; dagre layout may be unavailable');
                }
                if (!klayAvailable) {
                    console.warn('cytoscape-klay layout extension not detected; klay layout will fallback to dagre');
                }

                function buildLayoutOptions(layoutName, nodeCount) {
                    switch (layoutName) {
                        case 'dagre':
                            return {
                                name: 'dagre',
                                directed: true,
                                padding: 30,
                                spacingFactor: 1.2,
                                rankDir: 'TB'
                            };
                        case 'klay':
                            if (!klayAvailable) {
                                console.warn('Klay layout requested but unavailable; falling back to dagre');
                                return buildLayoutOptions('dagre', nodeCount);
                            }
                            return {
                                name: 'klay',
                                nodeDimensionsIncludeLabels: true,
                                padding: 40,
                                animate: false,
                                klay: {
                                    direction: 'DOWN',
                                    spacing: 80,
                                    borderSpacing: 25,
                                    inLayerSpacingFactor: 1.2,
                                    edgeRouting: 'ORTHOGONAL'
                                }
                            };
                        case 'circle':
                            return {
                                name: 'circle',
                                padding: 30,
                                radius: 200
                            };
                        case 'grid':
                            return {
                                name: 'grid',
                                padding: 30,
                                rows: Math.ceil(Math.sqrt(nodeCount))
                            };
                        case 'cose':
                            return {
                                name: 'cose',
                                padding: 30,
                                nodeRepulsion: 400000,
                                idealEdgeLength: 100,
                                edgeElasticity: 100
                            };
                        case 'breadthfirst':
                            return {
                                name: 'breadthfirst',
                                padding: 30,
                                directed: true,
                                spacingFactor: 1.5
                            };
                        default:
                            return {
                                name: layoutName,
                                padding: 30
                            };
                    }
                }

                const cy = cytoscape({
                    container: document.getElementById('cy'),
                    
                    elements: [
                        ...ontologyData.nodes.map(node => ({
                            data: {
                                id: node.id,
                                label: node.label,
                                type: node.type,
                                uri: node.uri
                            }
                        })),
                        ...ontologyData.edges.map(edge => ({
                            data: {
                                id: edge.id,
                                source: edge.source,
                                target: edge.target,
                                label: edge.label,
                                type: edge.type
                            }
                        }))
                    ],
                    
                    // Use the external styling configuration
                    style: OWL_VISUALIZATION_STYLES,
                    
                    layout: buildLayoutOptions('dagre', ontologyData.nodes.length)
                });
                
                console.log('Cytoscape instance created successfully');
                console.log('Number of nodes in graph:', cy.nodes().length);
                console.log('Number of edges in graph:', cy.edges().length);
                
                window.cy = cy;
                window.currentLayout = 'dagre';
                
                cy.on('tap', 'node', function(evt) {
                    const node = evt.target;
                    const nodeData = node.data();
                    
                    const infoPanel = document.getElementById('info');
                    const nodeInfo = document.getElementById('nodeInfo');
                    
                    let html = '<h3>' + nodeData.label + '</h3>';
                    html += '<p><strong>Type:</strong> ' + nodeData.type + '</p>';
                    html += '<p><strong>ID:</strong> ' + nodeData.id + '</p>';
                    if (nodeData.uri) {
                        html += '<p><strong>URI:</strong> <small>' + nodeData.uri + '</small></p>';
                    }
                    
                    nodeInfo.innerHTML = html;
                    infoPanel.style.display = 'block';
                });
                
                cy.on('tap', function(evt) {
                    if (evt.target === cy) {
                        document.getElementById('info').style.display = 'none';
                    }
                });
                
                const layoutSelect = document.getElementById('layoutSelect');
                if (layoutSelect) {
                    const klayOption = layoutSelect.querySelector('option[value="klay"]');
                    if (klayOption) {
                        klayOption.disabled = !klayAvailable;
                        klayOption.textContent = klayAvailable ? 'Hierarchical (Klay)' : 'Hierarchical (Klay unavailable)';
                    }
                }

                if (layoutSelect) {
                    layoutSelect.addEventListener('change', function() {
                        const requestedLayout = this.value;
                        const layoutOptions = buildLayoutOptions(requestedLayout, cy.nodes().length);
                        window.currentLayout = layoutOptions.name;
                        if (layoutSelect.value !== layoutOptions.name) {
                            layoutSelect.value = layoutOptions.name;
                        }
                        cy.layout(layoutOptions).run();
                    });
                    
                    layoutSelect.value = window.currentLayout || 'dagre';
                }
                
                window.fitGraph = function() {
                    cy.fit();
                };
                
                window.resetZoom = function() {
                    cy.zoom(1);
                    cy.center();
                };
                
                window.redrawDiagram = function() {
                    console.log('Forcing diagram redraw...');
                    
                    // Get current layout
                    const currentLayout = window.currentLayout || 'dagre';
                    const layoutOptions = buildLayoutOptions(currentLayout, cy.nodes().length);
                    window.currentLayout = layoutOptions.name;
                    if (layoutSelect && layoutSelect.value !== window.currentLayout) {
                        layoutSelect.value = window.currentLayout;
                    }

                    const layout = cy.layout(layoutOptions);
                    layout.run();
                    
                    // Fit to view after layout completes
                    layout.on('layoutstop', function() {
                        setTimeout(() => {
                            cy.fit();
                        }, 100);
                    });
                    
                    console.log('Diagram redraw triggered with layout:', window.currentLayout);
                };

                window.exportSvg = function() {
                    if (!window.cy) {
                        console.error('Cannot export SVG: cytoscape instance not initialized');
                        return;
                    }

                    if (typeof window.cy.svg !== 'function') {
                        console.error('cytoscape-svg extension is unavailable; export cancelled');
                        const statusText = document.getElementById('statusText');
                        if (statusText) {
                            statusText.textContent = 'SVG export unavailable';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        }
                        return;
                    }

                    try {
                        const svgContent = window.cy.svg({
                            full: true,
                            scale: 1,
                            bg: getComputedStyle(document.body).backgroundColor
                        });

                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const statusText = document.getElementById('statusText');
                        if (statusText) {
                            statusText.textContent = 'Preparing SVG...';
                        }

                        if (vscodeApi) {
                            vscodeApi.postMessage({
                                command: 'exportSvg',
                                svgContent,
                                fileName: 'owl-visualization-' + timestamp + '.svg'
                            });
                        } else {
                            console.warn('VS Code API unavailable in webview; cannot trigger export');
                            if (statusText) {
                                statusText.textContent = 'SVG export unavailable';
                                setTimeout(() => {
                                    statusText.textContent = 'Auto-updating';
                                }, 2000);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to export SVG:', error);
                        const statusText = document.getElementById('statusText');
                        if (statusText) {
                            statusText.textContent = 'SVG export failed';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        }
                    }
                };
                
                function updateStats() {
                    const stats = ontologyData.nodes.reduce((acc, node) => {
                        acc[node.type] = (acc[node.type] || 0) + 1;
                        return acc;
                    }, {});
                    
                    document.getElementById('classCount').textContent = stats.class || 0;
                    document.getElementById('propertyCount').textContent = stats.property || 0;
                    document.getElementById('individualCount').textContent = stats.individual || 0;
                    document.getElementById('skosConceptCount').textContent = stats.skosConcept || 0;
                    document.getElementById('skosConceptSchemeCount').textContent = stats.skosConceptScheme || 0;
                    document.getElementById('edgeCount').textContent = ontologyData.edges.length;
                }
                
                updateStats();
                
                window.showUpdateIndicator = function() {
                    const statusDot = document.getElementById('statusDot');
                    const statusText = document.getElementById('statusText');
                    if (statusDot && statusText) {
                        statusDot.classList.add('updating');
                        statusText.textContent = 'Updating...';
                        
                        setTimeout(() => {
                            statusDot.classList.remove('updating');
                            statusText.textContent = 'Auto-updating';
                        }, 1500);
                    }
                };
                
                window.updateVisualizationData = function(newOntologyData) {
                    console.log('Updating visualization with new data:', newOntologyData);
                    
                    const currentZoom = cy.zoom();
                    const currentPan = cy.pan();
                    
                    window.showUpdateIndicator();
                    
                    const nodePositions = {};
                    cy.nodes().forEach(node => {
                        const pos = node.position();
                        nodePositions[node.id()] = { x: pos.x, y: pos.y };
                    });
                    
                    cy.elements().remove();
                    
                    const newElements = [
                        ...newOntologyData.nodes.map(node => ({
                            data: {
                                id: node.id,
                                label: node.label,
                                type: node.type,
                                uri: node.uri
                            }
                        })),
                        ...newOntologyData.edges.map(edge => ({
                            data: {
                                id: edge.id,
                                source: edge.source,
                                target: edge.target,
                                label: edge.label,
                                type: edge.type
                            }
                        }))
                    ];
                    
                    cy.add(newElements);
                    
                    let positionsRestored = 0;
                    cy.nodes().forEach(node => {
                        const savedPos = nodePositions[node.id()];
                        if (savedPos) {
                            node.position(savedPos);
                            positionsRestored++;
                        }
                    });
                    
                    console.log('Restored positions for', positionsRestored, 'nodes');
                    
                    const totalNodes = cy.nodes().length;
                    if (positionsRestored < totalNodes * 0.8) {
                        console.log('Running layout for new nodes...');
                        const layoutOptions = buildLayoutOptions(window.currentLayout || 'dagre', totalNodes);
                        layoutOptions.animate = false;
                        window.currentLayout = layoutOptions.name;
                        if (layoutSelect && layoutSelect.value !== window.currentLayout) {
                            layoutSelect.value = window.currentLayout;
                        }
                        const layout = cy.layout(layoutOptions);
                        layout.run();
                        
                        layout.on('layoutstop', function() {
                            setTimeout(() => {
                                cy.zoom(currentZoom);
                                cy.pan(currentPan);
                            }, 50);
                        });
                    } else {
                        cy.zoom(currentZoom);
                        cy.pan(currentPan);
                    }
                    
                    const stats = newOntologyData.nodes.reduce((acc, node) => {
                        acc[node.type] = (acc[node.type] || 0) + 1;
                        return acc;
                    }, {});
                    
                    document.getElementById('classCount').textContent = stats.class || 0;
                    document.getElementById('propertyCount').textContent = stats.property || 0;
                    document.getElementById('individualCount').textContent = stats.individual || 0;
                    document.getElementById('skosConceptCount').textContent = stats.skosConcept || 0;
                    document.getElementById('skosConceptSchemeCount').textContent = stats.skosConceptScheme || 0;
                    document.getElementById('edgeCount').textContent = newOntologyData.edges.length;
                    
                    console.log('Visualization updated successfully');
                };
                
                window.addEventListener('message', event => {
                    console.log('Webview received message:', event.data);
                    const message = event.data;
                    if (message.command === 'updateData') {
                        console.log('Processing updateData command with', message.data.nodes.length, 'nodes');
                        window.updateVisualizationData(message.data);
                    } else if (message.command === 'exportResult') {
                        const statusText = document.getElementById('statusText');
                        if (!statusText) {
                            return;
                        }

                        if (message.status === 'success') {
                            statusText.textContent = 'SVG saved';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        } else if (message.status === 'cancelled') {
                            statusText.textContent = 'SVG export cancelled';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        } else {
                            statusText.textContent = 'SVG export failed';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        }
                    }
                });
                
                setTimeout(() => {
                    try {
                        cy.fit();
                        console.log('Graph fitted successfully');
                    } catch (error) {
                        console.error('Error fitting graph:', error);
                    }
                }, 100);
                
                ${isAutoUpdate ? 'window.showUpdateIndicator();' : ''}
                
            } catch (error) {
                console.error('Error in webview script:', error);
                document.getElementById('cy').innerHTML = '<div style="padding: 20px; color: red;">Error: ' + error.message + '</div>';
            }
        })();
    </script>
</body>
</html>`;
    }
}
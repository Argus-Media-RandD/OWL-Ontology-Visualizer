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
                } else if (message?.command === 'exportMermaid') {
                    await this.handleMermaidExport(message);
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
                    status: 'cancelled',
                    format: 'svg'
                });
                return;
            }

            const data = Buffer.from(message.svgContent, 'utf8');
            await vscode.workspace.fs.writeFile(targetUri, data);

            this.panel.webview.postMessage({
                command: 'exportResult',
                status: 'success',
                format: 'svg',
                path: targetUri.fsPath
            });
        } catch (error) {
            console.error('Failed to export SVG:', error);
            this.panel.webview.postMessage({
                command: 'exportResult',
                status: 'error',
                format: 'svg',
                message: error instanceof Error ? error.message : String(error)
            });

            vscode.window.showErrorMessage(`Failed to export SVG: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleMermaidExport(message: { mermaidContent: string; fileName?: string; }) {
        if (!this.panel) {
            return;
        }

        const defaultFileName = message.fileName && (message.fileName.endsWith('.mmd') || message.fileName.endsWith('.mermaid'))
            ? message.fileName
            : `owl-visualization-${new Date().toISOString().replace(/[:.]/g, '-')}.mmd`;
        const defaultUri = await this.getDefaultDownloadUri(defaultFileName);

        try {
            const targetUri = await vscode.window.showSaveDialog({
                defaultUri,
                filters: {
                    'Mermaid Definition': ['mmd', 'mermaid'],
                    'All Files': ['*']
                }
            });

            if (!targetUri) {
                this.panel.webview.postMessage({
                    command: 'exportResult',
                    status: 'cancelled',
                    format: 'mermaid'
                });
                return;
            }

            const data = Buffer.from(message.mermaidContent ?? '', 'utf8');
            await vscode.workspace.fs.writeFile(targetUri, data);

            this.panel.webview.postMessage({
                command: 'exportResult',
                status: 'success',
                format: 'mermaid',
                path: targetUri.fsPath
            });
        } catch (error) {
            console.error('Failed to export Mermaid definition:', error);
            this.panel.webview.postMessage({
                command: 'exportResult',
                status: 'error',
                format: 'mermaid',
                message: error instanceof Error ? error.message : String(error)
            });

            vscode.window.showErrorMessage(`Failed to export Mermaid definition: ${error instanceof Error ? error.message : String(error)}`);
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
        if (this.panel) {
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
        const dataStr = Buffer.from(JSON.stringify(ontologyData), 'utf8').toString('base64');
        
        const htmlContent = `<!DOCTYPE html>
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
        
        #layoutSelect, #exportFormat {
            background-color: #3C3C3C;
            color: #CCCCCC;
            border: 1px solid #3C3C3C;
            border-radius: 3px;
            padding: 4px 8px;
        }

        .export-controls {
            display: flex;
            gap: 6px;
            align-items: center;
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
                <button id="viewToggle">Switch to Instance View</button>
                <button onclick="fitGraph()">Fit to View</button>
                <button onclick="resetZoom()">Reset Zoom</button>
                <button onclick="redrawDiagram()">Redraw</button>
                <div class="export-controls">
                    <select id="exportFormat">
                        <option value="svg">Export as SVG</option>
                        <option value="mermaid">Export as Mermaid</option>
                    </select>
                    <button id="exportButton">Export</button>
                </div>
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
            
            // Enhanced error display function
            function showError(message, error) {
                console.error(message, error);
                const cyContainer = document.getElementById('cy');
                if (cyContainer) {
                    cyContainer.innerHTML = '<div style="padding: 20px; color: #ff6b6b; background: #2d2d2d; border: 2px solid #ff6b6b; border-radius: 5px; margin: 20px; font-family: monospace;"><h3 style="margin-top: 0;">Error</h3><p><strong>' + message + '</strong></p><pre style="background: #1e1e1e; padding: 10px; border-radius: 3px; overflow: auto;">' + (error ? String(error.stack || error) : 'No additional details') + '</pre></div>';
                }
            }
            
            try {
                const dataStringBase64 = '${dataStr}';

                function decodeBase64ToJsonString(base64Data) {
                    if (!base64Data) {
                        throw new Error('No data payload provided');
                    }

                    try {
                        const binary = atob(base64Data);
                        const len = binary.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        if (typeof TextDecoder !== 'undefined') {
                            return new TextDecoder('utf-8').decode(bytes);
                        }

                        // Fallback if TextDecoder is unavailable
                        let result = '';
                        const chunkSize = 0x8000;
                        for (let i = 0; i < len; i += chunkSize) {
                            result += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
                        }
                        return decodeURIComponent(escape(result));
                    } catch (error) {
                        console.error('Failed to decode base64 payload', error);
                        showError('Failed to decode ontology data payload', error);
                        throw error;
                    }
                }

                const dataString = decodeBase64ToJsonString(dataStringBase64);

                const ontologyData = JSON.parse(dataString);
                console.log('Ontology payload decoded (nodes: ' + ontologyData.nodes.length + ', edges: ' + ontologyData.edges.length + ')');
                
                if (typeof cytoscape === 'undefined') {
                    showError('Cytoscape library not loaded', new Error('cytoscape global is undefined'));
                    return;
                }
                
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

                const layoutSelect = document.getElementById('layoutSelect');
                if (layoutSelect) {
                    const klayOption = layoutSelect.querySelector('option[value="klay"]');
                    if (klayOption) {
                        klayOption.disabled = !klayAvailable;
                        klayOption.textContent = klayAvailable ? 'Hierarchical (Klay)' : 'Hierarchical (Klay unavailable)';
                    }
                }

                const viewToggleButton = document.getElementById('viewToggle');
                const exportButton = document.getElementById('exportButton');
                const exportFormatSelect = document.getElementById('exportFormat');

                let baseData = ontologyData;
                let currentViewMode = 'ontology';
                let activeViewData = null;
                window.currentLayout = 'dagre';

                function buildViewData(data, mode) {
                    const nodesById = new Map(data.nodes.map(node => [node.id, node]));
                    const includedNodes = new Map();
                    const allowedEdgeTypesOntology = new Set(['subClassOf', 'subPropertyOf', 'type', 'domain', 'range', 'skosInScheme', 'other']);
                    const allowedEdgeTypesInstance = new Set(['type', 'propertyAssertion', 'dataAssertion', 'skosInScheme']);
                    const allowedNodeTypesInstance = new Set(['individual', 'class', 'literal', 'skosConcept', 'skosConceptScheme']);
                    const allowedEdgeTypes = mode === 'ontology' ? allowedEdgeTypesOntology : allowedEdgeTypesInstance;
                    const allowedNodeTypes = mode === 'ontology' ? null : allowedNodeTypesInstance;

                    data.nodes.forEach(node => {
                        if (!allowedNodeTypes && node.type === 'literal') {
                            return;
                        }
                        if (allowedNodeTypes && !allowedNodeTypes.has(node.type)) {
                            return;
                        }
                        if (mode === 'instance' && node.type === 'class') {
                            return;
                        }
                        includedNodes.set(node.id, node);
                    });

                    const ensureNodeIncluded = (id) => {
                        if (includedNodes.has(id)) {
                            return;
                        }
                        const candidate = nodesById.get(id);
                        if (!candidate) {
                            return;
                        }
                        if (!allowedNodeTypes && candidate.type === 'literal') {
                            return;
                        }
                        if (allowedNodeTypes && !allowedNodeTypes.has(candidate.type)) {
                            return;
                        }
                        includedNodes.set(id, candidate);
                    };

                    const filteredEdges = data.edges.filter(edge => {
                        if (!allowedEdgeTypes.has(edge.type)) {
                            return false;
                        }
                        ensureNodeIncluded(edge.source);
                        ensureNodeIncluded(edge.target);
                        return includedNodes.has(edge.source) && includedNodes.has(edge.target);
                    });

                    const nodes = Array.from(includedNodes.values()).map(node => ({ ...node }));
                    const nodeIdSet = new Set(nodes.map(node => node.id));
                    let edges = filteredEdges
                        .filter(edge => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))
                        .map(edge => ({ ...edge }));

                    if (mode === 'instance') {
                        const nodeLookup = new Map(nodes.map(node => [node.id, node]));
                        const classDecorators = new Map();
                        const classUsage = new Set();
                        const retainedEdges = [];

                        edges.forEach(edge => {
                            if (edge.type === 'type') {
                                const individualNode = nodeLookup.get(edge.source);
                                const classNodeOriginal = nodesById.get(edge.target);
                                if (individualNode && individualNode.type === 'individual' && classNodeOriginal && classNodeOriginal.type === 'class') {
                                    const decoratorLabel = classNodeOriginal.label || classNodeOriginal.id;
                                    if (!classDecorators.has(edge.source)) {
                                        classDecorators.set(edge.source, new Set());
                                    }
                                    classDecorators.get(edge.source).add(decoratorLabel);
                                }
                                return;
                            }

                            retainedEdges.push(edge);

                            const sourceNode = nodeLookup.get(edge.source);
                            const targetNode = nodeLookup.get(edge.target);
                            if (sourceNode && sourceNode.type === 'class') {
                                classUsage.add(sourceNode.id);
                            }
                            if (targetNode && targetNode.type === 'class') {
                                classUsage.add(targetNode.id);
                            }
                        });

                        edges = retainedEdges;

                        const decoratedNodes = [];
                        nodes.forEach(node => {
                            if (node.type === 'class' && !classUsage.has(node.id)) {
                                return;
                            }

                            if (node.type === 'individual') {
                                const decorators = classDecorators.get(node.id);
                                if (decorators && decorators.size > 0) {
                                    const sortedDecorators = Array.from(decorators).sort((a, b) => a.localeCompare(b));
                                    const decoratorText = sortedDecorators.join(', ');
                                    const baseLabel = node.label || node.id;
                                    decoratedNodes.push({
                                        ...node,
                                        label: '<<' + decoratorText + '>>' + String.fromCharCode(10) + baseLabel
                                    });
                                    return;
                                }
                            }

                            decoratedNodes.push(node);
                        });

                        return { nodes: decoratedNodes, edges };
                    }

                    return { nodes, edges };
                }

                function createElements(viewData) {
                    return [
                        ...viewData.nodes.map(node => ({
                            data: {
                                id: node.id,
                                label: node.label,
                                type: node.type,
                                uri: node.uri
                            }
                        })),
                        ...viewData.edges.map(edge => ({
                            data: {
                                id: edge.id,
                                source: edge.source,
                                target: edge.target,
                                label: edge.label,
                                type: edge.type,
                                bidirectional: edge.bidirectional ? 'true' : undefined
                            }
                        }))
                    ];
                }

                function updateStats(dataForStats) {
                    const stats = dataForStats.nodes.reduce((acc, node) => {
                        acc[node.type] = (acc[node.type] || 0) + 1;
                        return acc;
                    }, {});

                    document.getElementById('classCount').textContent = stats.class || 0;
                    document.getElementById('propertyCount').textContent = stats.property || 0;
                    document.getElementById('individualCount').textContent = stats.individual || 0;
                    document.getElementById('skosConceptCount').textContent = stats.skosConcept || 0;
                    document.getElementById('skosConceptSchemeCount').textContent = stats.skosConceptScheme || 0;
                    document.getElementById('edgeCount').textContent = dataForStats.edges.length;
                }

                function updateViewToggleButton() {
                    if (!viewToggleButton) {
                        return;
                    }
                    viewToggleButton.textContent = currentViewMode === 'ontology' ? 'Switch to Instance View' : 'Switch to Ontology View';
                }

                activeViewData = buildViewData(baseData, currentViewMode);

                const elements = createElements(activeViewData);
                if (typeof OWL_VISUALIZATION_STYLES === 'undefined') {
                    showError('OWL_VISUALIZATION_STYLES not loaded', new Error('styles.js may not be loaded'));
                    return;
                }
                const layoutOptions = buildLayoutOptions(window.currentLayout, activeViewData.nodes.length);
                const cy = cytoscape({
                    container: document.getElementById('cy'),
                    elements: elements,
                    style: OWL_VISUALIZATION_STYLES,
                    layout: layoutOptions
                });
                console.log('Cytoscape initialized (nodes: ' + cy.nodes().length + ', edges: ' + cy.edges().length + ', layout: ' + layoutOptions.name + ')');
                
                window.cy = cy;
                updateStats(activeViewData);
                updateViewToggleButton();
                
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
                
                if (layoutSelect) {
                    layoutSelect.addEventListener('change', function() {
                        const requestedLayout = this.value;
                        const layoutOptions = buildLayoutOptions(requestedLayout, cy.nodes().length);
                        window.currentLayout = layoutOptions.name;
                        if (layoutSelect.value !== layoutOptions.name) {
                            layoutSelect.value = layoutOptions.name;
                        }
                        const layout = cy.layout(layoutOptions);
                        layout.run();
                        layout.once('layoutstop', () => {
                            setTimeout(() => {
                                cy.fit();
                            }, 50);
                        });
                    });
                    
                    layoutSelect.value = window.currentLayout || 'dagre';
                }

                if (exportButton && exportFormatSelect) {
                    exportButton.addEventListener('click', () => {
                        const format = exportFormatSelect.value;
                        if (format === 'mermaid') {
                            window.exportMermaid();
                        } else {
                            window.exportSvg();
                        }
                    });
                }

                if (viewToggleButton) {
                    viewToggleButton.addEventListener('click', () => {
                        const nextMode = currentViewMode === 'ontology' ? 'instance' : 'ontology';
                        applyView(nextMode, { preserveViewport: false });
                    });
                }
                
                window.fitGraph = function() {
                    cy.fit();
                };
                
                window.resetZoom = function() {
                    cy.zoom(1);
                    cy.center();
                };
                
                window.redrawDiagram = function() {
                    // Get current layout
                    const currentLayout = window.currentLayout || 'dagre';
                    const layoutOptions = buildLayoutOptions(currentLayout, cy.nodes().length);
                    window.currentLayout = layoutOptions.name;
                    if (layoutSelect && layoutSelect.value !== window.currentLayout) {
                        layoutSelect.value = window.currentLayout;
                    }

                    const layout = cy.layout(layoutOptions);
                    layout.run();
                    layout.once('layoutstop', () => {
                        setTimeout(() => {
                            cy.fit();
                        }, 100);
                    });
                    console.log('Diagram redraw triggered with layout: ' + window.currentLayout);
                };

                function sanitizeMermaidText(text, options = {}) {
                    const allowLineBreaks = Boolean(options && options.allowLineBreaks);
                    let value = String(text ?? '').trim();
                    if (allowLineBreaks) {
                        value = value.replace(/\\r?\\n+/g, '<br/>');
                    } else {
                        value = value.replace(/\\r?\\n+/g, ' ');
                    }
                    const backtickChar = String.fromCharCode(96);
                    value = value.split(backtickChar).join("'");
                    value = value.replace(/'/g, '&#39;');
                    value = value.replace(/"/g, '&quot;');
                    value = value.replace(/\\\|/g, '/');
                    return value;
                }

                function sanitizeMermaidIdentifier(text, fallback) {
                    const primary = String(text ?? '').trim();
                    const secondary = String(fallback ?? '').trim() || 'node';
                    const base = primary || secondary;
                    let identifier = typeof base.normalize === 'function' ? base.normalize('NFKD') : base;
                    identifier = identifier.replace(/[^A-Za-z0-9_\\s-]/g, '_');
                    identifier = identifier.replace(/[\\s-]+/g, '_');
                    identifier = identifier.replace(/_+/g, '_');
                    identifier = identifier.replace(/^_+/, '').replace(/_+$/, '');
                    if (!identifier) {
                        let fallbackIdentifier = secondary.replace(/[^A-Za-z0-9_\\s-]/g, '_');
                        fallbackIdentifier = fallbackIdentifier.replace(/[\\s-]+/g, '_');
                        fallbackIdentifier = fallbackIdentifier.replace(/_+/g, '_');
                        fallbackIdentifier = fallbackIdentifier.replace(/^_+/, '').replace(/_+$/, '');
                        identifier = fallbackIdentifier || 'node';
                    }
                    if (/^[0-9]/.test(identifier)) {
                        identifier = '_' + identifier;
                    }
                    return identifier;
                }

                function buildMermaidDefinition(viewData) {
                    if (!viewData) {
                        return 'graph TD';
                    }

                    const usedMermaidIds = new Set();

                    const reserveMermaidId = (preferred, fallback) => {
                        const baseId = sanitizeMermaidIdentifier(preferred, fallback);
                        let candidate = baseId;
                        let index = 2;
                        while (usedMermaidIds.has(candidate)) {
                            candidate = baseId + '_' + index;
                            index++;
                        }
                        usedMermaidIds.add(candidate);
                        return candidate;
                    };

                    const lines = [
                        '%% Auto-generated by OWL Ontology Visualizer',
                        'graph TD'
                    ];

                    const nodeAliasMap = new Map();

                    viewData.nodes.forEach((node, index) => {
                        const preferredLabel = node.label || node.id;
                        const alias = reserveMermaidId(preferredLabel, node.id || ('node_' + index));
                        nodeAliasMap.set(node.id, alias);

                        const labelParts = [];
                        if (node.label) {
                            labelParts.push(sanitizeMermaidText(node.label, { allowLineBreaks: true }));
                        } else {
                            labelParts.push(sanitizeMermaidText(node.id, { allowLineBreaks: true }));
                        }

                        if (node.type) {
                            labelParts.push(sanitizeMermaidText(node.type));
                        }

                        const combinedLabel = labelParts.join('<br/>') || sanitizeMermaidText(node.id);
                        lines.push('    ' + alias + '["' + combinedLabel + '"]');
                    });

                    const seenEdges = new Set();

                    viewData.edges.forEach(edge => {
                        const sourceAlias = nodeAliasMap.get(edge.source);
                        const targetAlias = nodeAliasMap.get(edge.target);
                        if (!sourceAlias || !targetAlias) {
                            return;
                        }

                        const label = sanitizeMermaidText(edge.label || '');
                        const connector = label ? '-->|' + label + '|' : '-->';
                        const edgeLine = sourceAlias + connector + targetAlias;

                        if (!seenEdges.has(edgeLine)) {
                            lines.push('    ' + edgeLine);
                            seenEdges.add(edgeLine);
                        }

                        if (edge.bidirectional === 'true' || edge.bidirectional === true) {
                            const reverseLine = targetAlias + connector + sourceAlias;
                            if (!seenEdges.has(reverseLine)) {
                                lines.push('    ' + reverseLine);
                                seenEdges.add(reverseLine);
                            }
                        }
                    });

                    return lines.join('\\n');
                }

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

                window.exportMermaid = function() {
                    const statusText = document.getElementById('statusText');
                    if (statusText) {
                        statusText.textContent = 'Preparing Mermaid...';
                    }

                    try {
                        const exportData = activeViewData || buildViewData(baseData, currentViewMode) || baseData;
                        const mermaidContent = buildMermaidDefinition(exportData);
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

                        if (vscodeApi) {
                            vscodeApi.postMessage({
                                command: 'exportMermaid',
                                mermaidContent,
                                fileName: 'owl-visualization-' + timestamp + '.mmd'
                            });
                        } else {
                            console.warn('VS Code API unavailable in webview; cannot trigger export');
                            if (statusText) {
                                statusText.textContent = 'Mermaid export unavailable';
                                setTimeout(() => {
                                    statusText.textContent = 'Auto-updating';
                                }, 2000);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to export Mermaid definition:', error);
                        if (statusText) {
                            statusText.textContent = 'Mermaid export failed';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        }
                    }
                };

                function rebuildGraph(options = {}) {
                    const { preserveViewport = false } = options;
                    const previousZoom = cy.zoom();
                    const previousPan = cy.pan();

                    activeViewData = buildViewData(baseData, currentViewMode);
                    cy.elements().remove();
                    cy.add(createElements(activeViewData));

                    updateStats(activeViewData);

                    const layoutOptions = buildLayoutOptions(window.currentLayout || 'dagre', cy.nodes().length);
                    window.currentLayout = layoutOptions.name;
                    layoutOptions.animate = false;
                    const layout = cy.layout(layoutOptions);
                    layout.once('layoutstop', () => {
                        if (preserveViewport) {
                            cy.zoom(previousZoom);
                            cy.pan(previousPan);
                        } else {
                            cy.fit();
                        }
                    });
                    layout.run();

                    if (layoutSelect && layoutSelect.value !== window.currentLayout) {
                        layoutSelect.value = window.currentLayout;
                    }
                }

                function applyView(mode, options = {}) {
                    if (currentViewMode === mode && options.preserveViewport) {
                        rebuildGraph(options);
                        return;
                    }
                    currentViewMode = mode;
                    updateViewToggleButton();
                    rebuildGraph(options);
                }
                
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
                    const nodeCount = Array.isArray(newOntologyData?.nodes) ? newOntologyData.nodes.length : 0;
                    const edgeCount = Array.isArray(newOntologyData?.edges) ? newOntologyData.edges.length : 0;
                    console.log('Applying ontology update (nodes: ' + nodeCount + ', edges: ' + edgeCount + ')');
                    window.showUpdateIndicator();
                    baseData = newOntologyData;
                    rebuildGraph({ preserveViewport: true });
                    updateViewToggleButton();
                };
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'updateData') {
                        window.updateVisualizationData(message.data);
                    } else if (message.command === 'exportResult') {
                        const statusText = document.getElementById('statusText');
                        if (!statusText) {
                            return;
                        }

                        const formatLabel = message.format === 'mermaid'
                            ? 'Mermaid'
                            : 'SVG';

                        if (message.status === 'success') {
                            statusText.textContent = formatLabel + ' saved';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        } else if (message.status === 'cancelled') {
                            statusText.textContent = formatLabel + ' export cancelled';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        } else {
                            statusText.textContent = formatLabel + ' export failed';
                            setTimeout(() => {
                                statusText.textContent = 'Auto-updating';
                            }, 2000);
                        }
                    }
                });
                
                setTimeout(() => {
                    try {
                        cy.fit();
                    } catch (error) {
                        console.error('Error fitting graph:', error);
                    }
                }, 100);
                
                ${isAutoUpdate ? 'window.showUpdateIndicator();' : ''}
                
            } catch (error) {
                console.error('=== FATAL ERROR in webview script ===');
                console.error('Error type:', error.constructor.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                showError('Fatal error in webview script: ' + error.message, error);
            }
        })();
    </script>
</body>
</html>`;

        return htmlContent;
    }
}
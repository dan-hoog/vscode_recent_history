import * as vscode from 'vscode';

/** 
 * Each FileHistory has:
 *   - fileUri: the URI of the file
 *   - positions: an array of RecentPosition objects
 *   - lastAccessed: used to sort the file in recency
 */
interface RecentPosition {
    line: number;             // The "earliest" line for this area
    snippet: string;          // Preview snippet around 'line'
    isEdited: boolean;
    timestamp: number;        // For sorting recency of positions in this file
}

interface FileHistory {
    fileUri: vscode.Uri;
    positions: RecentPosition[];
    lastAccessed: number;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Recent History extension is now active!');

    const config = vscode.workspace.getConfiguration('recentHistory');
    const maxFiles = config.get<number>('maxFiles', 10);
    const maxEntriesPerFile = config.get<number>('maxEntriesPerFile', 5);
    const snippetLineCount = config.get<number>('snippetLineCount', 3);
    const preserveBetweenSessions = config.get<boolean>('preserveBetweenSessions', false);

    let disposable = vscode.commands.registerCommand('recentHistory.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World!');
    });
    context.subscriptions.push(disposable);

    // Additional config
    const maxSelectionLines = config.get<number>('maxSelectionLines', 50);
    const areaRange = config.get<number>('areaRange', 5);

    // Load from globalState if preserving between sessions
    let globalHistory: FileHistory[] = [];
    if (preserveBetweenSessions) {
        const saved = context.globalState.get<FileHistory[]>('recentHistoryData');
        if (saved) {
            globalHistory = saved.map(item => ({
                ...item,
                fileUri: vscode.Uri.parse(item.fileUri.toString())
            }));
        }
    }

    // Create our TreeDataProvider
    const historyProvider = new RecentHistoryProvider(globalHistory, context, {
        maxFiles,
        maxEntriesPerFile,
        snippetLineCount,
        preserveBetweenSessions,
        maxSelectionLines,
        areaRange
    });

    // Register the tree view
    vscode.window.createTreeView('recentHistory', {
        treeDataProvider: historyProvider
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('recentHistory.revealLine', (fileUri: vscode.Uri, line: number) => {
            openFileAtLine(fileUri, line);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentHistory.clearAll', () => {
            historyProvider.clearAll();
            vscode.window.showInformationMessage('Cleared all recent history.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentHistory.clearFile', (item: HistoryItem) => {
            if (!item || !item.fileHistory) {
                return; // safely handle unexpected calls
            }
            historyProvider.removeFile(item.fileHistory.fileUri);
            vscode.window.showInformationMessage(
                `Cleared history for ${item.fileHistory.fileUri.fsPath}`
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentHistory.openSettings', async () => {
            // Opens the Settings UI with 'recentHistory' as the search query
            await vscode.commands.executeCommand('workbench.action.openSettings', {
                query: 'recentHistory',
                openToSide: false,
                target: vscode.ConfigurationTarget.Workspace
            });
        })
    );

    // Listen for configuration changes (dynamic updates)
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('recentHistory')) {
                const cfg = vscode.workspace.getConfiguration('recentHistory');
                historyProvider.maxFiles = cfg.get<number>('maxFiles', 10);
                historyProvider.maxEntriesPerFile = cfg.get<number>('maxEntriesPerFile', 5);
                historyProvider.snippetLineCount = cfg.get<number>('snippetLineCount', 3);
                historyProvider.preserve = cfg.get<boolean>('preserveBetweenSessions', false);
                historyProvider.maxSelectionLines = cfg.get<number>('maxSelectionLines', 50);
                historyProvider.areaRange = cfg.get<number>('areaRange', 5);
            }
        })
    );

    // Capture selection events
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(event => {
            const editor = event.textEditor;
            if (!editor?.document) {
                return;
            }
            if (event.selections.length === 0) {
                return;
            }
            // We'll just track the primary selection
            const selection = event.selections[0];
            if (selection.isEmpty) {
                return; // cursor move with no selection => skip
            }
            const lineDiff = Math.abs(selection.end.line - selection.start.line);
            if (lineDiff > historyProvider.maxSelectionLines) {
                return; // skip large selections
            }

            const earliestLine = Math.min(selection.start.line, selection.end.line);
            historyProvider.recordSelectionOrEdit(
                editor.document.uri,
                earliestLine,
                false // not an edit, just a selection
            );
        })
    );

    // Capture text edits
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.contentChanges.length === 0) {
                return;
            }
            const docUri = event.document.uri;
            // For simplicity, just look at the first change's range
            const change = event.contentChanges[0];
            const linesChanged = Math.abs(change.range.end.line - change.range.start.line);
            if (linesChanged > historyProvider.maxSelectionLines) {
                return; // skip big edits
            }
            const earliestLine = Math.min(change.range.start.line, change.range.end.line);

            historyProvider.recordSelectionOrEdit(
                docUri,
                earliestLine,
                true // is an edit
            );
        })
    );

    // If preserving between sessions, save on certain triggers
    if (preserveBetweenSessions) {
        const saveFn = () => {
            context.globalState.update('recentHistoryData', historyProvider.getHistory());
        };
        // Save on doc save/close or internal data change
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(saveFn),
            vscode.workspace.onDidCloseTextDocument(saveFn),
            historyProvider.onDidChangeData(saveFn)
        );
    }
}

export function deactivate() {
    // no-op
}

/**
 * Open the given file and reveal the specified line.
 */
function openFileAtLine(fileUri: vscode.Uri, line: number) {
    vscode.workspace.openTextDocument(fileUri).then(doc => {
        vscode.window.showTextDocument(doc, { preview: false }).then(editor => {
            const position = new vscode.Position(line, 0);
            const range = new vscode.Range(position, position);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(position, position);
        });
    });
}

/**
 * A small helper function that returns the lowest-level directory plus file name.
 * Example: /home/user/project/src/foo.ts => "src/foo.ts"
 */
function getShortFileName(fullPath: string): string {
    const parts = fullPath.split(/[\\/]/);
    if (parts.length < 2) {
        return fullPath; // Fallback if we can't split
    } else {
        const parent = parts[parts.length - 2];
        const file = parts[parts.length - 1];
        return parent + '/' + file;
    }
}

/**
 * The TreeDataProvider for our "Recent History."
 */
class RecentHistoryProvider implements vscode.TreeDataProvider<HistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryItem | undefined | void> =
        new vscode.EventEmitter<HistoryItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryItem | undefined | void> = this._onDidChangeTreeData.event;

    private _onDidChangeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public onDidChangeData = this._onDidChangeData.event;

    constructor(
        private history: FileHistory[],
        private context: vscode.ExtensionContext,
        private opts: {
            maxFiles: number;
            maxEntriesPerFile: number;
            snippetLineCount: number;
            preserveBetweenSessions: boolean;
            maxSelectionLines: number;
            areaRange: number;
        }
    ) { }

    // Getters/setters for dynamic config
    get maxFiles() { return this.opts.maxFiles; }
    set maxFiles(v: number) { this.opts.maxFiles = v; }

    get maxEntriesPerFile() { return this.opts.maxEntriesPerFile; }
    set maxEntriesPerFile(v: number) { this.opts.maxEntriesPerFile = v; }

    get snippetLineCount() { return this.opts.snippetLineCount; }
    set snippetLineCount(v: number) { this.opts.snippetLineCount = v; }

    get preserve() { return this.opts.preserveBetweenSessions; }
    set preserve(v: boolean) { this.opts.preserveBetweenSessions = v; }

    get maxSelectionLines() { return this.opts.maxSelectionLines; }
    set maxSelectionLines(v: number) { this.opts.maxSelectionLines = v; }

    get areaRange() { return this.opts.areaRange; }
    set areaRange(v: number) { this.opts.areaRange = v; }

    // ─────────────────────────────────────────────────────────────
    // TreeDataProvider methods
    // ─────────────────────────────────────────────────────────────
    getTreeItem(element: HistoryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: HistoryItem): Promise<HistoryItem[]> {
        if (!element) {
            // Top-level => file items
            const sortedFiles = this.history
                .slice()
                .sort((a, b) => b.lastAccessed - a.lastAccessed);

            return sortedFiles.map(file => {
                const label = getShortFileName(file.fileUri.fsPath);
                return new HistoryItem(
                    file,
                    undefined,
                    label,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'fileItem'
                );
            });
        } else {
            // Second level => positions in a file
            if (element.fileHistory) {
                const file = element.fileHistory;
                const sortedPositions = file.positions
                    .slice()
                    .sort((a, b) => b.timestamp - a.timestamp);

                return sortedPositions.map(pos => {
                    // Create a single-line version of the snippet (replacing newlines with spaces).
                    const singleLineSnippet = pos.snippet.replace(/\r?\n/g, ' ');
                    // Show line number + snippet in the label
                    const label = `Line ${pos.line + 1}: ${singleLineSnippet}`;

                    const item = new HistoryItem(
                        file,
                        pos,
                        label,
                        vscode.TreeItemCollapsibleState.None,
                        'positionItem',
                        // icon (red vs. green)
                        pos.isEdited
                            ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.red'))
                            : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground')),
                        {
                            command: 'recentHistory.revealLine',
                            title: 'Reveal Line',
                            arguments: [file.fileUri, pos.line]
                        }
                    );

                    // Keep the full multiline snippet in tooltip:
                    item.tooltip = pos.snippet;

                    return item;
                });
            }
            return [];
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    private notifyDataChanged() {
        this._onDidChangeData.fire();
    }

    public getHistory(): FileHistory[] {
        return this.history;
    }

    /**
     * Clear everything.
     */
    public clearAll(): void {
        this.history = [];
        this.refresh();
        this.notifyDataChanged();
    }

    /**
     * Remove one file from the history.
     */
    public removeFile(uri: vscode.Uri) {
        this.history = this.history.filter(h => h.fileUri.toString() !== uri.toString());
        this.refresh();
        this.notifyDataChanged();
    }

    /**
     * Called when either a selection or an edit occurs at a specific line in a file.
     * We'll:
     *  1) Find or create the file in history
     *  2) Attempt to find an existing position "in the same area" (within `areaRange` lines)
     *  3) Move the file to top of recency
     *  4) Refresh the view
     */
    public recordSelectionOrEdit(uri: vscode.Uri, baseLine: number, isEdit: boolean) {
        const fileHist = this.getOrCreateFileHistory(uri);
        const now = Date.now();

        // find if there's an existing position within areaRange lines
        const areaPos = fileHist.positions.find(p => Math.abs(p.line - baseLine) <= this.opts.areaRange);
        if (areaPos) {
            // Reuse the same position
            areaPos.line = Math.min(areaPos.line, baseLine);
            // Rebuild snippet for earliest line
            areaPos.snippet = this.buildSnippet(uri, areaPos.line, this.snippetLineCount);
            // Mark edited if we have a new edit
            areaPos.isEdited = areaPos.isEdited || isEdit;
            areaPos.timestamp = now;
        } else {
            // create new position
            const newPos: RecentPosition = {
                line: baseLine,
                snippet: this.buildSnippet(uri, baseLine, this.snippetLineCount),
                isEdited: isEdit,
                timestamp: now
            };
            fileHist.positions.push(newPos);

            // Enforce max entries
            if (fileHist.positions.length > this.maxEntriesPerFile) {
                // remove the oldest by timestamp
                fileHist.positions.sort((a, b) => a.timestamp - b.timestamp);
                fileHist.positions.shift();
            }
        }

        // update file recency
        fileHist.lastAccessed = now;

        // Move file to front
        this.history = this.history.filter(h => h.fileUri.toString() !== uri.toString());
        this.history.unshift(fileHist);

        // Enforce max files
        if (this.history.length > this.maxFiles) {
            this.history.pop();
        }

        this.refresh();
        this.notifyDataChanged();
    }

    /**
     * Get or create a FileHistory entry for the specified URI.
     */
    private getOrCreateFileHistory(uri: vscode.Uri): FileHistory {
        let fileHist = this.history.find(h => h.fileUri.toString() === uri.toString());
        if (!fileHist) {
            fileHist = {
                fileUri: uri,
                positions: [],
                lastAccessed: Date.now()
            };
            this.history.unshift(fileHist);
            // Enforce max files
            if (this.history.length > this.maxFiles) {
                this.history.pop();
            }
        }
        return fileHist;
    }

    /**
     * Build a small snippet around the given line, for display in the tree.
     */
    private buildSnippet(uri: vscode.Uri, line: number, lineCount: number): string {
        const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
        if (!doc) {
            return `... (file not open) ...`;
        }
        if (doc.lineCount === 0) {
            return '';
        }

        const half = Math.floor(lineCount / 2);
        let startLine = line - half;
        let endLine = startLine + (lineCount - 1);

        if (startLine < 0) {
            startLine = 0;
            endLine = lineCount - 1;
        }
        if (endLine >= doc.lineCount) {
            endLine = doc.lineCount - 1;
            startLine = Math.max(0, endLine - (lineCount - 1));
        }

        const snippetLines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            snippetLines.push(doc.lineAt(i).text);
        }
        return snippetLines.join('\n');
    }
}

/**
 * Simple TreeItem wrapper.
 */
class HistoryItem extends vscode.TreeItem {
    constructor(
        public fileHistory?: FileHistory,
        public position?: RecentPosition,
        label?: string,
        collapsibleState?: vscode.TreeItemCollapsibleState,
        public readonly contextValue?: string,
        iconPath?: vscode.ThemeIcon,
        command?: vscode.Command
    ) {
        super(label || '', collapsibleState);
        if (iconPath) {
            this.iconPath = iconPath;
        }
        if (command) {
            this.command = command;
        }
    }
}

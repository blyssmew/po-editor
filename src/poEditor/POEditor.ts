import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { compileMO } from './MOFile';

import {
    createEmptyPOFile,
    parsePO,
    serializePO,
    validatePOFile,
    type POFile
} from './POFile';


interface WebviewMessage {
    type: string;
    model?: POFile;
}


export class POEditor implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'po-editor.editor';

    private readonly webviewPath: vscode.Uri;


    constructor(context: vscode.ExtensionContext) {

        this.webviewPath = vscode.Uri.joinPath(
            context.extensionUri,
            'src',
            'poEditor',
            'webview'
        );
    }


    // ========================================
    // NEW PO EDITOR
    // ========================================

    public openNew(): void {

        const panel = vscode.window.createWebviewPanel(
            'poEditor.new',
            'New PO Editor',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,

                localResourceRoots: [
                    this.webviewPath
                ]
            }
        );

        this.configurePanel(
            panel,
            undefined,
            createEmptyPOFile()
        );
    }


    // ========================================
    // OPEN EXISTING PO
    // ========================================

    public async openExisting(): Promise<void> {

        const result =
            await vscode.window.showOpenDialog({

                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,

                filters: {
                    'PO files': ['po']
                }
            });

        if (!result || result.length === 0) {
            return;
        }

        await this.openFile(result[0]);
    }


    // ========================================
    // CUSTOM EDITOR
    // ========================================

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {

        this.configurePanel(
            webviewPanel,
            document,
            parsePO(document.getText())
        );
    }


    // ========================================
    // CONFIGURE WEBVIEW
    // ========================================

    private configurePanel(
        panel: vscode.WebviewPanel,
        document: vscode.TextDocument | undefined,
        initialModel: POFile
    ): void {

        panel.webview.options = {
            enableScripts: true,

            localResourceRoots: [
                this.webviewPath
            ]
        };


        panel.webview.html =
            this.getWebviewContent(
                panel.webview
            );


        // ----------------------------------------
        // Messages from Webview
        // ----------------------------------------

        const messageSubscription =
            panel.webview.onDidReceiveMessage(
                async (message: WebviewMessage) => {

                    await this.handleMessage(
                        panel,
                        document,
                        initialModel,
                        message
                    );
                }
            );


        // ----------------------------------------
        // Changes made to the VS Code document
        // ----------------------------------------

        const changeSubscription =
            document
                ? vscode.workspace.onDidChangeTextDocument(
                    event => {

                        if (
                            event.document.uri.toString()
                            !== document.uri.toString()
                        ) {
                            return;
                        }


                        panel.webview.postMessage({
                            type: 'state',

                            mode: 'file',

                            model: parsePO(
                                document.getText()
                            )
                        });
                    }
                )
                : undefined;


        // ----------------------------------------
        // Cleanup
        // ----------------------------------------

        panel.onDidDispose(() => {

            messageSubscription.dispose();

            changeSubscription?.dispose();
        });
    }


    // ========================================
    // HANDLE WEBVIEW MESSAGES
    // ========================================

    private async handleMessage(
        panel: vscode.WebviewPanel,
        document: vscode.TextDocument | undefined,
        initialModel: POFile,
        message: WebviewMessage
    ): Promise<void> {

        switch (message.type) {

            // ------------------------------------
            // WEBVIEW READY
            // ------------------------------------

            case 'ready':

                panel.webview.postMessage({
                    type: 'state',

                    mode:
                        document
                            ? 'file'
                            : 'new',

                    model:
                        document
                            ? parsePO(
                                document.getText()
                            )
                            : initialModel
                });

                return;


            // ------------------------------------
            // SYNCHRONIZE WEBVIEW -> DOCUMENT
            // ------------------------------------

            case 'sync':

                if (!document || !message.model) {
                    return;
                }

                await this.updateDocument(
                    document,
                    message.model,
                    panel,
                    false
                );

                return;


            // ------------------------------------
            // SAVE
            // ------------------------------------

            case 'save':

                if (!document || !message.model) {
                    return;
                }

                if (
                    await this.updateDocument(
                        document,
                        message.model,
                        panel,
                        true
                    )
                ) {

                    const saved =
                        await document.save();


                    if (saved) {

                        panel.webview.postMessage({
                            type: 'status',
                            message: 'Saved'
                        });
                    }
                }

                return;


            // ------------------------------------
            // BUILD MO
            // ------------------------------------

            case 'build-mo':

                if (!message.model) {
                    return;
                }


                // New unsaved PO
                if (!document) {

                    await this.createPOFile(
                        panel,
                        message.model,
                        true
                    );

                    return;
                }


                // Existing PO
                if (
                    !await this.updateDocument(
                        document,
                        message.model,
                        panel,
                        true
                    )
                ) {
                    return;
                }


                if (!await document.save()) {
                    return;
                }


                await this.createMOFile(
                    document.uri,
                    message.model,
                    panel
                );

                return;


            // ------------------------------------
            // CREATE PO
            // ------------------------------------

            case 'create-po':

                if (!message.model) {
                    return;
                }

                await this.createPOFile(
                    panel,
                    message.model,
                    false
                );

                return;


            // ------------------------------------
            // OPEN PO
            // ------------------------------------

            case 'open-po':

                await this.openExisting();

                return;


            // ------------------------------------
            // NEW PO
            // ------------------------------------

            case 'new-po':

                panel.dispose();

                this.openNew();

                return;
        }
    }


    // ========================================
    // UPDATE DOCUMENT
    // ========================================

    private async updateDocument(
        document: vscode.TextDocument,
        model: POFile,
        panel: vscode.WebviewPanel,
        validate: boolean
    ): Promise<boolean> {

        // ------------------------------------
        // Validation
        // ------------------------------------

        if (validate) {

            const validationError =
                validatePOFile(model);


            if (validationError) {

                this.showError(
                    panel,
                    validationError
                );

                return false;
            }
        }


        // ------------------------------------
        // Serialize
        // ------------------------------------

        const newContent =
            serializePO(model);


        // Nothing changed
        if (
            newContent ===
            document.getText()
        ) {
            return true;
        }


        // ------------------------------------
        // Replace entire document
        // ------------------------------------

        const fullRange =
            new vscode.Range(
                document.positionAt(0),

                document.positionAt(
                    document.getText().length
                )
            );


        const edit =
            new vscode.WorkspaceEdit();


        edit.replace(
            document.uri,
            fullRange,
            newContent
        );


        // ------------------------------------
        // Apply
        // ------------------------------------

        const success =
            await vscode.workspace.applyEdit(
                edit
            );


        if (!success) {

            this.showError(
                panel,
                'Could not update the PO document.'
            );

            return false;
        }


        return true;
    }


    // ========================================
    // CREATE PO FILE
    // ========================================

    private async createPOFile(
        panel: vscode.WebviewPanel,
        model: POFile,
        alsoBuildMO: boolean
    ): Promise<void> {

        // ------------------------------------
        // Validation
        // ------------------------------------

        const validationError =
            validatePOFile(model);


        if (validationError) {

            this.showError(
                panel,
                validationError
            );

            return;
        }


        // ------------------------------------
        // Save dialog
        // ------------------------------------

        let uri =
            await vscode.window.showSaveDialog({

                saveLabel:
                    alsoBuildMO
                        ? 'Create PO and MO'
                        : 'Create PO file',

                filters: {
                    'PO files': ['po']
                }
            });


        if (!uri) {
            return;
        }


        // Ensure .po extension
        if (
            !uri.fsPath
                .toLowerCase()
                .endsWith('.po')
        ) {

            uri =
                vscode.Uri.file(
                    `${uri.fsPath}.po`
                );
        }


        try {

            // --------------------------------
            // Write PO
            // --------------------------------

            await vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(
                    serializePO(model),
                    'utf8'
                )
            );


            // --------------------------------
            // Build MO if requested
            // --------------------------------

            if (alsoBuildMO) {

                const created =
                    await this.createMOFile(
                        uri,
                        model,
                        panel
                    );


                if (!created) {
                    return;
                }
            }


            // --------------------------------
            // Open created PO
            // --------------------------------

            await vscode.commands.executeCommand(
                'vscode.openWith',
                uri,
                POEditor.viewType
            );


            panel.dispose();

        } catch (error) {

            this.showError(
                panel,
                `Could not create the PO file: ${String(error)}`
            );
        }
    }


    // ========================================
    // OPEN FILE
    // ========================================

    private async openFile(
        uri: vscode.Uri
    ): Promise<void> {

        await vscode.commands.executeCommand(
            'vscode.openWith',
            uri,
            POEditor.viewType
        );
    }


    // ========================================
    // CREATE MO FILE
    // ========================================

    private async createMOFile(
        poUri: vscode.Uri,
        model: POFile,
        panel: vscode.WebviewPanel
    ): Promise<boolean> {

        const moPath =
            poUri.fsPath.replace(
                /\.po$/i,
                '.mo'
            );


        const moUri =
            vscode.Uri.file(
                moPath
            );


        // ------------------------------------
        // Check existing MO
        // ------------------------------------

        try {

            await vscode.workspace.fs.stat(
                moUri
            );


            const answer =
                await vscode.window.showWarningMessage(
                    `${path.basename(moPath)} already exists. Overwrite it?`,
                    'Overwrite',
                    'Cancel'
                );


            if (answer !== 'Overwrite') {
                return false;
            }

        } catch {
            // MO does not exist.
        }


        // ------------------------------------
        // Compile
        // ------------------------------------

        try {

            const moData =
                compileMO(model);


            await vscode.workspace.fs.writeFile(
                moUri,
                moData
            );


            panel.webview.postMessage({
                type: 'status',

                message:
                    `MO created: ${path.basename(moPath)}`
            });


            vscode.window.showInformationMessage(
                `PO Editor: ${path.basename(moPath)} created.`
            );


            return true;

        } catch (error) {

            this.showError(
                panel,
                `Could not create the MO file: ${String(error)}`
            );

            return false;
        }
    }


    // ========================================
    // WEBVIEW HTML
    // ========================================

    private getWebviewContent(
        webview: vscode.Webview
    ): string {

        const htmlPath =
            path.join(
                this.webviewPath.fsPath,
                'POEditor.html'
            );


        let html =
            fs.readFileSync(
                htmlPath,
                'utf8'
            );


        const cssUri =
            webview.asWebviewUri(
                vscode.Uri.joinPath(
                    this.webviewPath,
                    'POEditor.css'
                )
            );


        const jsUri =
            webview.asWebviewUri(
                vscode.Uri.joinPath(
                    this.webviewPath,
                    'POEditor.js'
                )
            );


        html =
            html
                .replaceAll(
                    '{{CSP_SOURCE}}',
                    webview.cspSource
                )
                .replaceAll(
                    '{{CSS_URI}}',
                    cssUri.toString()
                )
                .replaceAll(
                    '{{JS_URI}}',
                    jsUri.toString()
                );


        return html;
    }


    // ========================================
    // ERROR
    // ========================================

    private showError(
        panel: vscode.WebviewPanel,
        message: string
    ): void {

        vscode.window.showErrorMessage(
            `PO Editor: ${message}`
        );


        panel.webview.postMessage({
            type: 'error',
            message
        });
    }
}

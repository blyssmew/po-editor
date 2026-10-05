import * as vscode from 'vscode';
import { POEditor } from './poEditor/POEditor';

export function activate(context: vscode.ExtensionContext) {

	console.log('=== PO EDITOR ACTIVATED ===');

	const editor = new POEditor(context);

	const newCommand = vscode.commands.registerCommand(
		'po-editor.new',
		() => {
			editor.openNew();
		}
	);

	const openCommand = vscode.commands.registerCommand(
		'po-editor.openPo',
		() => {
			editor.openExisting();
		}
	);

	const customEditor = vscode.window.registerCustomEditorProvider(
		POEditor.viewType,
		editor,
		{
			webviewOptions: {
				retainContextWhenHidden: true
			},
			supportsMultipleEditorsPerDocument: false
		}
	);

	context.subscriptions.push(
		newCommand,
		openCommand,
		customEditor
	);
}

export function deactivate() { }

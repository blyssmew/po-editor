// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('PO Editor is active!');

	// const disposable = vscode.commands.registerCommand(
	// 	'po-editor.helloWorld',
	// 	async () => {

	// 		let pathFichier: string | undefined = vscode.window.activeTextEditor?.document.fileName.toString() ?? "AUCUN FICHIER";

	// 		// let monstring = await vscode.window.showInputBox({
	// 		// 	// prompt: 'Write something'
	// 		// 	prompt: pathFichier
	// 		// });

	// 		if (pathFichier?.endsWith(".po")) {
	// 			pathFichier = "FICHIER PO";
	// 		}

	// 		console.log('You wrote:', pathFichier);

	// 		vscode.window.showInformationMessage(
	// 			`You wrote: ${pathFichier ?? 'nothing'}`
	// 		);
	// 	}
	// );

	const disposable2 = vscode.commands.registerTextEditorCommand(
		'po-editor.helloWorld',
		async () => {

			let pathFichier: string | undefined = vscode.window.activeTextEditor?.document.fileName.toString() ?? "BO FICHIER";

			// let monstring = await vscode.window.showInputBox({
			// 	// prompt: 'Write something'
			// 	prompt: pathFichier
			// });

			if (pathFichier?.endsWith(".po")) {
				pathFichier = "FICHIER PO";
			}

			console.log('You wrote:', pathFichier);

			vscode.window.showInformationMessage(
				`You wrote: ${pathFichier ?? 'nothing'}`
			);
		}
	);
	context.subscriptions.push(disposable2);
	// context.subscriptions.push(disposable);
}


// This method is called when your extension is deactivated
export function deactivate() { }

/* eslint-disable @typescript-eslint/semi */
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode'
import { Configuration, OpenAIApi } from 'openai'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

async function readFileContents(uri: vscode.Uri): Promise<string> {
  const document = await vscode.workspace.openTextDocument(uri)
  return document.getText()
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "chad" is now active!')

  let disposable = vscode.commands.registerCommand('chadgpt.askChatGPT', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      return
    }

		const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Custom Buttons';
    quickPick.placeholder = 'Type your query or select a button';
    quickPick.ignoreFocusOut = true;

    quickPick.items = [
      { label: 'Button 1', description: 'This is button 1' },
      { label: 'Button 2', description: 'This is button 2' },
    ];

    quickPick.onDidChangeValue((value) => {
      if (value.trim() !== '') {
        quickPick.items = [
          ...quickPick.items,
          { label: 'Confirm', description: 'Confirm your input' },
        ];
      } else {
        quickPick.items = quickPick.items.filter((item) => item.label !== 'Confirm');
      }
    });

    quickPick.onDidAccept(() => {
      const selectedItem = quickPick.selectedItems[0] as any;
      if (selectedItem.id === 'button1') {
        vscode.window.showInformationMessage('Button 1 clicked');
      } else if (selectedItem.id === 'button2') {
        vscode.window.showInformationMessage('Button 2 clicked');
      } else if (selectedItem.id === 'confirm') {
        vscode.window.showInformationMessage(`Entered query: ${quickPick.value}`);
      }
      quickPick.hide();
    });

    quickPick.show();

    const userInput = await vscode.window.showInputBox({
      placeHolder: 'Type your question here'
    })

    if (!userInput) {
      return
    }
    // Get contents of the active file
    const activeFileContent = editor.document.getText()

    // Show the "open dialog" for selecting files
    // const options: vscode.OpenDialogOptions = {
    // 	canSelectMany: true,
    // 	openLabel: 'Select',
    // 	canSelectFiles: true,
    // 	canSelectFolders: false,
    // };

    // const fileUris = await vscode.window.showOpenDialog(options);

    // let combinedFilesContent = ''
    // if (fileUris) {
    // 	const filesContentPromises = fileUris.map(readFileContents);
    // 	const filesContent = await Promise.all(filesContentPromises);
    // 	combinedFilesContent = filesContent.join('\n');
    // }

    // const prompt = `${userInput}\n\n${activeFileContent}\n\n${combinedFilesContent}`;
    const prompt = `${userInput}\n\n${activeFileContent}}`
    // const prompt = `${activeFileContent}`

    try {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          cancellable: false,
          title: 'ChatGPT generating response...'
        },
        async progress => {

          progress.report({ increment: 0 })

          const response: any = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            // prompt,
            max_tokens: 2048,
            n: 1,
            // stop: null,
            temperature: 0.5,
            messages: [{ role: 'user', content: prompt }]
          })

          console.log(response)

          if (!response) {
            return
          }

          const currentPosition = editor.selection.active

          editor.edit(editBuilder => {
            editBuilder.insert(currentPosition, response.data.choices[0].message.content.trim())
          })

          progress.report({ increment: 100 })
        }
      )

      // vscode.window.showInformationMessage(response.data.choices[0].message.content.trim())
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error: ${error.message}`)
    }
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {}

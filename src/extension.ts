/* eslint-disable @typescript-eslint/semi */
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { Configuration, OpenAIApi } from 'openai';

let openai: any;

async function setApiKey(apiKey: string): Promise<void> {
  if (!isValidApiKey(apiKey)) {
    vscode.window.showErrorMessage(`Error: OpenAI API Key Format Invalid. Not Saved`);
    return;
  } else {
    const config = vscode.workspace.getConfiguration('chadgpt');
    await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('API Key has been set.');
    const configuration = new Configuration({
      apiKey
    })
    openai = new OpenAIApi(configuration)
  }
}

async function getApiKey(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('chadgpt');
  return config.get('apiKey');
}

async function fetchResponse(prompt: string): Promise<string> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('API Key not set.');
  }

  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    max_tokens: 2048,
    n: 1,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }],
  });

  if (!response) {
    throw new Error('No response received.');
  }

  return response.data.choices[0].message.content.trim();
}

function isValidApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) {return false;}
  const apiKeyPattern = /^sk-[A-Za-z0-9-]{48}$/;
  return apiKeyPattern.test(apiKey);
}

export function activate(context: vscode.ExtensionContext) {

	const outputChannel = vscode.window.createOutputChannel('ChadGPT');

  context.subscriptions.push(
    vscode.commands.registerCommand('chadgpt.askChatGPT', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const userInput = await vscode.window.showInputBox({
        placeHolder: 'Type your question here',
      });

      if (!userInput) {
        return;
      }

      const activeFileContent = editor.document.getText();
      const prompt = `${userInput}\n\n${activeFileContent}`;

      try {
				
				const response = await fetchResponse(prompt);
				outputChannel.appendLine(response);
				outputChannel.show();

      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chadgpt.setApiKey', async () => {
      const apiKeyInput = await vscode.window.showInputBox({
        placeHolder: 'Enter your OpenAI API Key',
      });

      if (!apiKeyInput) {
        return;
      }

      await setApiKey(apiKeyInput);
    })
  );
}

export function deactivate() {}
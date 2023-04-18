/* eslint-disable @typescript-eslint/semi */
/* eslint-disable @typescript-eslint/naming-convention */
import MarkdownIt = require('markdown-it'); 
import * as vscode from 'vscode'
import { Configuration, OpenAIApi } from 'openai'
import { TextEditor } from 'vscode'

let openai: any
let defaultModel: string = 'gpt-3.5-turbo'
let apiKey: string | undefined = undefined;
let model: string | undefined = undefined;

async function setApiKey(apiKey: string): Promise<void> {
  if (!isValidApiKey(apiKey)) {
    vscode.window.showErrorMessage(`Error: OpenAI API Key Format Invalid. Not Saved`)
    return
  } else {
    const config = vscode.workspace.getConfiguration('chadgpt')
    await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global)
    vscode.window.showInformationMessage('API Key has been set.')
    openai = new OpenAIApi(
      new Configuration({
        apiKey
      })
    )
  }
}

async function setModel(modelName: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('chadgpt')
  await config.update('model', modelName, vscode.ConfigurationTarget.Global)
  vscode.window.showInformationMessage('OpenAI model name has been set.')
}


async function getApiKey(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('chadgpt')
  return config.get('apiKey')
}


async function getModel(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('chadgpt')
  return config.get('model')
}

async function fetchResponse(prompt: string): Promise<string> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      cancellable: false,
      title: 'ChatGPT generating response...'
    },
    async progress => {

      progress.report({ increment: 0 })

      if (!apiKey || !model) {
        throw new Error('API Key or model not set.')
      }

      if (!isValidApiKey(apiKey)) {
        throw new Error('API Key not valid.')
      }
    
      const response = await openai.createChatCompletion({
        model,
        n: 1,
        temperature: 0.5,
        messages: [{ role: 'user', content: prompt }]
      })
    
      if (!response) {
        throw new Error('No response received.')
      }
    
      progress.report({ increment: 100 })
      
      return response.data.choices[0].message.content.trim()

    }
  )
}

function isValidApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) {
    return false
  }
  const apiKeyPattern = /^sk-[A-Za-z0-9-]{48}$/
  return apiKeyPattern.test(apiKey)
}

function showResponse(
  prompt: string,
  activeFileContent: string | undefined,
  selectedText: string | undefined,
  language: string | undefined,
  res: string
) {
  const panel = vscode.window.createWebviewPanel(
    "markdownPanel",
    "ChatGPT Results",
    vscode.ViewColumn.Two,
    { enableScripts: true }
  );

  const md = new MarkdownIt();
  const rendered = md.render(res);

  const codeContent = selectedText || activeFileContent;
  const langClass = language ? ` class="language-${language}"` : "";
  const codeBlock = codeContent
    ? `</div><pre><code${langClass}>${codeContent}</code></pre>`
    : "";

  panel.webview.html = `
      <body>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/default.min.css">
          <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/go.min.js"></script>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/base16/zenburn.min.css">
          <br/>
          <div><b>Prompt:</b></div><p>${prompt}</p>${codeBlock}
          <div><b>Response:</b>${rendered}</div>
          <script>hljs.highlightAll();</script>
      </body>
  `;
}

function hasSelection(editor: TextEditor): Boolean {
  if (editor) {
    const selections = editor.selections;
    return selections.some(selection => !selection.isEmpty);
  }
  return false;
}

function getLanguageId(): string | undefined {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
      const languageId = activeEditor.document.languageId;
      return languageId;
  } else {
      return undefined;
  }
}

async function askChatGPT() {
      
  const userInput = await vscode.window.showInputBox({
    placeHolder: 'Type your question here'
  })
  
  if (!userInput) {
    return
  }

  try {

    const prompt = `${userInput}`
    const response = await fetchResponse(prompt)
    showResponse(userInput, undefined, undefined, undefined, response)
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

async function askChatGPTWithCode(): Promise<void> {
  const userInput = await vscode.window.showInputBox({ placeHolder: 'Type your question here' });

  if (!userInput) { return; }

  let prompt: string;
  let language: string | undefined;
  let activeFileContent: string | undefined;
  let selectedText: string | undefined = '';
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
      prompt = userInput;
  } else {
      const selection = hasSelection(editor);

      if (selection) {
          const selections = editor.selections;
          const document = editor.document;

          selections.forEach((selection) => {
              if (!selection.isEmpty) {
                  selectedText += document.getText(selection);
              }
          });
          prompt = `${userInput}\n${selectedText}`;
      } else {
          activeFileContent = editor.document.getText() || '';
          prompt = `${userInput}\n${activeFileContent}`;
          language = getLanguageId();
      }
  }

  try {
      const response = await fetchResponse(prompt+'/nBe sure to put any responses that contain code in markdown code blocks');
      showResponse(userInput, activeFileContent, selectedText, language, response);
  } catch (error: any) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
  }
}

export async function activate(context: vscode.ExtensionContext) {

  apiKey = await getApiKey();
  model = await getModel();
  if (!model) {
    model = defaultModel;
  }

  if (apiKey && isValidApiKey(apiKey)) {
    openai = new OpenAIApi(
      new Configuration({
        apiKey: apiKey
      })
    )
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('chadgpt.askChatGPT', askChatGPT ))

  context.subscriptions.push(
    vscode.commands.registerCommand('chadgpt.askChatGPTWithCode', askChatGPTWithCode ))

  context.subscriptions.push(
    vscode.commands.registerCommand('chadgpt.setApiKey', async () => {
      const apiKeyInput = await vscode.window.showInputBox({
        placeHolder: 'Enter your OpenAI API Key'
      })

      if (!apiKeyInput) {
        return
      }

      await setApiKey(apiKeyInput)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('chadgpt.setAIModel', async () => {
      const modelName = await vscode.window.showInputBox({
        placeHolder: `gpt-3.5-turbo`
      })

      if (!modelName) {
        return
      }

      await setModel(modelName)
    })
  )
}

export function deactivate() {}
/* eslint-disable @typescript-eslint/semi */
/* eslint-disable @typescript-eslint/naming-convention */
import MarkdownIt = require('markdown-it'); 
import * as vscode from 'vscode'
import { Configuration, OpenAIApi } from 'openai'
import { TextEditor } from 'vscode'

let openai: any
let defaultModel: string = 'gpt-3.5-turbo'

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

      const apiKey = await getApiKey()
      const model = await getModel()

      if (!apiKey) {
        throw new Error('API Key not set.')
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

function showResponse(prompt: string, res: string) {
    const panel = vscode.window.createWebviewPanel(
      'markdownPanel', // Identifies the type of the webview
      'ChatGPT Results', // Title of the panel displayed to the user
      vscode.ViewColumn.Two, // Editor column to show the new webview panel
      {
        enableScripts: true
      }
      );
      
    const md = new MarkdownIt();
    const rendered = md.render(res)

    panel.webview.html = `
      <body>
        <br/>
        <div><b>Prompt:</b></div>
        <h3>${prompt}</h3>
        <div><b>Response:</b>${rendered}</div>
      </body>
    `;
}

function hasSelection(editor: TextEditor): Boolean {
  if (editor) {
    const selections = editor.selections
    let hasHighlightedText = false

    selections.forEach(selection => {
      if (!selection.isEmpty) {
        hasHighlightedText = true
      }
    })

    if (hasHighlightedText) {
      vscode.window.showInformationMessage('Highlighted text in editor will be included in query.')
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}

export async function activate(context: vscode.ExtensionContext) {

  // setModel(defaultModel)

  const key : string | undefined = await getApiKey()
  const isValid = isValidApiKey(key)

  if (typeof key !== 'undefined' && isValid) {
    openai = new OpenAIApi(
      new Configuration({
        apiKey: key
      })
    )
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('chadgpt.askChatGPT', async () => {
      
      const userInput = await vscode.window.showInputBox({
        placeHolder: 'Type your question here'
      })
      
      if (!userInput) {
        return
      }

      try {
    
        const prompt = `${userInput}`
        const response = await fetchResponse(prompt)
        showResponse(prompt, response)

      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`)
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('chadgpt.askChatGPTWithCode', async () => {
      
      const userInput = await vscode.window.showInputBox({
        placeHolder: 'Type your question here'
      })
      
      if (!userInput) {
        return
      }
      
      let prompt: string = ''
      const editor = vscode.window.activeTextEditor
      
      if (typeof editor === 'undefined') {
        prompt = `${userInput}`
      } else {
        const selection = hasSelection(editor)

        if (selection) {
          prompt = `${userInput}\n`
          const selections = editor.selections
          let document = editor.document

          selections.forEach(selection => {
            if (!selection.isEmpty) {
              const selectedText = document.getText(selection)
              prompt = prompt + selectedText
            }
          })
        } else {
          const activeFileContent = editor.document.getText() || ''
          prompt = `${userInput}\n${activeFileContent}`
        }
      }

      try {
        const response = await fetchResponse(prompt)
        showResponse(prompt, response)

      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`)
      }
    })
  )

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
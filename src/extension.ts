"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, workspace, window, commands } from "vscode";
import { paramCase } from "change-case";
import { Observable } from "rxjs";

import getConfig, { FileHelper, logger } from "./helpers";
import { Config as ConfigInterface } from "./config.interface";

const TEMPLATE_SUFFIX_SEPERATOR = "-";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
  const storyConfig = [
    getConfig().get("storybook.themeConfigName"),
    getConfig().get("storybook.themeConfigModuleName"),
    getConfig().get("storybook.styleProviderName"),
    getConfig().get("storybook.styleProviderModuleName")
  ];
  const hasConfig = storyConfig.reduce((acc, entry) => {
    if (!!acc && entry.length > 0) {
      return true;
    }
    return false;
  }, true);

  if (!hasConfig) {
    logger("error", "Please update settings for Storybook before proceeding!");
    throw new Error("Please update settings for Storybook before proceeding!");
  }

  const storybookThemeFileName = getConfig().get("storybook.themeConfigName");
  const storybookProviderFileName = getConfig().get(
    "storybook.styleProviderName"
  );

  const provider = await workspace.findFiles(
    `**/${storybookProviderFileName}`,
    "**/node_modules/**",
    10
  );
  const theme = await workspace.findFiles(
    `**/${storybookThemeFileName}`,
    "**/node_modules/**",
    10
  );

  let themePath, providerPath;
  for (const file of provider) {
    providerPath = file.fsPath;
  }
  for (const file of theme) {
    themePath = file.fsPath;
  }

  const createComponent = (
    uri,
    suffix: string = "",
    compType: string = undefined
  ) => {
    // Display a dialog to the user
    let enterComponentNameDialog$ = Observable.from(
      window.showInputBox({
        prompt:
          "Please enter component name in camelCase then I can convert it to PascalCase for you."
      })
    );

    enterComponentNameDialog$
      .concatMap(val => {
        if (val.length === 0) {
          logger("error", "Component name can not be empty!");
          throw new Error("Component name can not be empty!");
        }
        let componentName = paramCase(val);
        let componentDir = FileHelper.createComponentDir(uri, componentName);

        let filesToCreate = [
          FileHelper.createIndexFile(componentDir, componentName)
        ];
        if (suffix.includes("storybook")) {
          filesToCreate = [
            ...filesToCreate,
            FileHelper.createComponent(componentDir, componentName, compType),
            FileHelper.createStorybook(
              componentDir,
              componentName,
              suffix,
              themePath,
              providerPath
            )
          ];
        } else {
          filesToCreate = [
            ...filesToCreate,
            FileHelper.createComponent(componentDir, componentName, suffix)
          ];
        }

        return Observable.forkJoin(filesToCreate);
      })
      .concatMap(result => Observable.from(result))
      .do(val => console.log("val :", val))
      .filter(path => path.length > 0)
      .first()
      .concatMap(filename =>
        Observable.from(workspace.openTextDocument(filename))
      )
      .concatMap(textDocument => {
        if (!textDocument) {
          logger("error", "Could not open file!");
          throw new Error("Could not open file!");
        }
        return Observable.from(window.showTextDocument(textDocument));
      })
      .do(editor => {
        if (!editor) {
          logger("error", "Could not open file!");
          throw new Error("Could not open file!");
        }
      })
      .subscribe(
        c => logger("success", "React component successfully created!"),
        err => logger("error", err.message)
      );
  };

  const componentArray = [
    {
      type: "container",
      commandId: "extension.genReactContainerComponentFiles"
    },
    {
      type: "stateless",
      commandId: "extension.genReactStatelessComponentFiles"
    },
    {
      type: "reduxContainer",
      commandId: "extension.genReactReduxContainerComponentFiles"
    },
    {
      type: "reduxStateless",
      commandId: "extension.genReactReduxStatelessComponentFiles"
    },
    {
      type: "storybookContainer",
      compType: "reduxContainer",
      commandId: "extension.genReactStorybookContainerComponentFiles"
    },
    {
      type: "storybookStateless",
      compType: "reduxStateless",
      commandId: "extension.genReactStorybookStatelessComponentFiles"
    }
  ];

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  componentArray.forEach(c => {
    const suffix = `${TEMPLATE_SUFFIX_SEPERATOR}${c.type}`;
    const compSuffix = c.compType
      ? `${TEMPLATE_SUFFIX_SEPERATOR}${c.compType}`
      : undefined;
    const disposable = commands.registerCommand(c.commandId, uri =>
      createComponent(uri, suffix, compSuffix)
    );

    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(disposable);
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
  // code whe
}

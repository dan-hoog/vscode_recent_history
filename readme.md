# Overview
A Visual Studio Code extension for a Recent History that tracks changes and touches (any select) in a custom sidebar view that tracks the files and cursor locations you’ve recently changed or interacted with by selecting text. Designed to provide quick navigation to recently accessed parts of your code, using the select action as a signal if an important area was visited without changes. This extension presents a list of recently used files (most recent first), each with a few recent cursor positions (with line numbers and code snippets) under them. By clicking entries in this history list, developers can instantly jump back to those files and lines. The interface will be minimalist and consistent with VS Code’s look and feel, using the native Tree View API for integration into the sidebar (Tree View API | Visual Studio Code Extension API). Key considerations include making the feature configurable (how many files/entries to track) and ensuring it runs efficiently without slowing down the editor.

## Build Process Information from chatgpt
See https://chatgpt.com/share/67a753a7-a03c-8000-a90a-af4d9f6bc697

## Key Features
* Recent Files List: Automatically tracks a configured number of the most recently accessed files in the workspace. This includes files where a selection occurred even if no edits were made, capturing focused areas and edited areas. Files are listed in declining recency (most recent at top).
* Cursor History per File: Under each file entry, display the last few cursor positions visited in that file. Each history item shows the line number and a three-line snippet of code around that position for context. This helps identify the point in the file at a glance.
* Snippet Previews with Edit Highlighting: The snippet for each history entry is color-coded or marked to indicate if you made recent edits at that location. For example, an entry might have a colored icon or text highlighting if that line was part of a recent edit, versus a normal color for mere navigation. A red dot should be shown for edited areas and a green dot for all others.
* Quick Toggle Sidebar Icon: A dedicated icon/button in VS Code’s left sidebar (Activity Bar) allows quick show/hide of the Recent History panel. This behaves like any other VS Code view container icon (explorer, search, etc.), so users can easily toggle the panel visibility.
* Click to Open and Navigate: The file containers should default to open, but can be closed and opened by the user as needed. Clicking a file in the history list opens that file in the last active editor group (preserving your layout). Expanding a file reveals its recent cursor locations; clicking one of those line entries will navigate the already-open file to that specific line (or open it if not already open, then jump to the line). This enables one-click return to any recent context.
* Configurable Settings: A settings section is provided so users can adjust: the maximum number of recent files shown, the number of cursor history entries per file, and how many lines of code are shown in each snippet. These settings allow tailoring the panel’s length and detail to personal preference or performance needs.
* History Management Options: Users have the option to clear all history or to clear history for a single file by clicking a ‘-‘ action shown with each entry. This executes a “Clear history for this file” action, removing all its entries.
* Minimalist UI: The extension’s UI will follow VS Code’s design language—using the default font, colors, and icons where possible—to appear as a native part of the editor. The layout will be clean, likely a tree view with collapsible file nodes. Color-coding for edits will be subtle and theme-aware (respecting light/dark modes). No heavy graphics or distracting elements will be used, keeping the focus on code content.

Created with care by collaboration of OpenAI DeepResearch and Hatcher Plus team including Tim Growney and Dan Hoogterp.

## Making and distribution a VSIX image
Ensure the .js is complied with
npm run compile

Then build the VSXI with
Run vsce package
In the root of your extension project (where package.json resides), run:

bash
Copy
vsce package
(or npx vsce package if installed locally)

vsce will bundle everything into a single .vsix file (named something like publisher-name-version.vsix) based on what’s included or excluded in your .vscodeignore.
If you have a README.md or CHANGELOG.md, they will be included automatically.
By default, vsce excludes node_modules except production dependencies. If you want to exclude extra files (like .git or large dev dependencies), list them in .vscodeignore.

## Install or Share the .vsix File
You can then distribute that generated .vsix to others or install it manually:

Manual Installation in VS Code:

Open the Extensions view (Ctrl+Shift+X / Cmd+Shift+X).
Click the three-dot menu (top-right) → Install from VSIX...
Select your .vsix file.
Reload VS Code if prompted.
Sharing:

Anyone with the .vsix can install using the same steps.
Alternatively, you can publish to the VS Code Marketplace if you want broader distribution (requires a free Microsoft account and a “publisher” set up in the Azure DevOps Marketplace).

## Latest .vsix
* Included in distribution, easily installed with add extension from .vsix option!

## Send us bug reports or comments


### WishList
* Key Command to mark current location (same as a select)
* Key command to jump to the N-th most recent few location or cycle prev/next
* Key command to open/close the sidebar, returning to previous sidebar if applicable
* Don't show full path for file names
* On hover over entry, show full captured text, not line number
* Ideally, option to add panel at bottom of file explorer, either instead or in addition...


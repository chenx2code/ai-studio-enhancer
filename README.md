[简体中文](./README_zh-CN.md)

# AI Studio Enhancer Browser Extension

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**AI Studio Enhancer** is a browser extension designed to comprehensively enhance the **Google AI Studio** user experience, providing powerful conversation management and navigation features.

Main use cases include conversation archiving, content referencing, interaction sharing, data analysis, long conversation navigation, and quick review.

## ✨ Main Features

### 📋 Markdown Export Feature

*   **One-Click Copy:** Adds an easy-to-use "Copy conversation as Markdown" button to the conversation page toolbar.
*   **Structured Markdown:** Automatically converts conversations into standard Markdown format:
    *   Conversation title as level-1 heading (`#`).
    *   Each user prompt as level-2 heading (`##`).
    *   Model's thought process and final answer as body text, preserving original Markdown formatting.
    *   Uses `---` separator to distinguish different conversation rounds.

### 🧭 Conversation Navigation Feature

*   **One-Click Navigation**: Adds an easy-to-use "Open Conversation Catalog" button to the conversation page toolbar.
*   **Smart Catalog:** Displays conversation catalog in the right sidebar, listing previews of all user prompts.
*   **Quick Navigation:** Automatically identifies user prompts in conversations with one-click jump support:
    *   Text prompts show truncated preview (50 characters).
    *   Images display `[Image]` identifier.
    *   File and other formats display `[File]` identifier.
    *   Click any catalog item to quickly jump to the corresponding position.
*   **Visual Feedback:** Provides highlight effects during navigation, clearly marking target positions.
*   **Real-time Sync:** Automatically updates catalog content when conversation changes.
*   **Keyboard Navigation:** Enhanced accessibility:
    *   Users can navigate between catalog items using the Tab key.
    *   Visual indicators appear when a catalog item gains focus.
    *   Press Enter or Space to jump to the corresponding conversation position.

---

## 💡 How to Use

### :exclamation: Important Prerequisite: Enable Autosave

**Please note:** To ensure this extension works correctly, you **must** enable the **"Autosave"** feature in your Google AI Studio settings. (This extension relies on the internal data updates triggered by AI Studio's autosave to capture the most complete conversation history. If autosave is not enabled, the extension will not be able to retrieve real-time conversation content, leading to functionality failure or incomplete content.)

![Autosave](https://github.com/user-attachments/assets/acf72302-dc3d-4a45-b6a4-5e8e30050dd6)

---



### 📋 Markdown Export

1.  Chat with the model and wait for the conversation to be automatically saved to Google Drive.
2.  Click the Markdown icon in the toolbar.
3.  The browser will show a popup notification "Conversation copied successfully!".
4.  Now, the Markdown-formatted conversation content is in your clipboard. You can paste it into any text editor (like Typora, VS Code), note-taking software, or wherever you need to use the content.

<video src="https://github.com/user-attachments/assets/9b7db6ac-3912-4844-bd21-b6a085b15ea1"></video>



---

### 🧭 Conversation Navigation

1.  Click the list icon in the toolbar to open the conversation catalog.
2.  The catalog panel will slide out from the right side, displaying a list of all user prompts.
3.  Click any catalog item to quickly jump to the corresponding position in the conversation.
4.  A blue highlight effect will mark the target position during navigation.
5.  Click the list icon again or the close button in the catalog panel to close the catalog.

<video src="https://github.com/user-attachments/assets/d953b424-9503-4969-82c6-e032a2ff5c4a"></video>

---

## 🚀 Installation Methods

This extension is currently not available on the plugin store. You need to load it manually via developer mode.

### Method 1: Install from Release (Recommended)

1.  **Download ZIP Package:**
    *   Visit the project's [Releases page](https://github.com/chenx2code/ai-studio-enhancer/releases).
    *   Find the latest version and download the file named `ai-studio-enhancer-vX.X.X.zip`.

2.  **Extract Files:**
    *   Extract the downloaded `.zip` file to a permanent folder that you can easily find.

3.  **Load Extension in Chrome:**
    *   Open Chrome browser.
    *   Type `chrome://extensions` in the address bar and press Enter to go to the extensions management page.
    *   **Enable "Developer mode":** Make sure the "Developer mode" switch in the top-right corner is turned on.
    *   **Load Extension:** Click the "Load unpacked" button that appears in the top-left corner.
    *   **Select Folder:** In the file selection window, choose the **folder you extracted in the previous step** (make sure it contains `manifest.json`).
    *   Click "Select Folder".

4.  **Complete:**
    *   The "AI Studio Enhancer" extension should now appear in your extensions list and be enabled by default.

### Method 2: Load from Source Code (Developers)

This method is suitable for developers who want to get the latest code or do secondary development.

1.  **Get Project Files:**
    *   Clone this repository via `git clone https://github.com/chenx2code/ai-studio-enhancer.git`.
    *   Save all files in a folder that you can easily find.

2.  **Load Extension:**
    *   Follow steps 3 and 4 from "Method 1" to load the root folder containing the source code in Chrome.

---

## ⚠️ Known Issues & Limitations

*   **Dependency on Google AI Studio Page Structure and API:** This extension is highly dependent on the current HTML structure, CSS class names, and internal network request response data structures of the Google AI Studio website. If Google undertakes major website redesigns in the future, it may cause selectors or data parsing logic to fail, making the extension unable to work properly. Code updates would be required at that time.

---

## 🤝 Contributing

If you find any bugs, have improvement suggestions, or want to add new features, you are welcome to contribute through the following ways:

*   Submit an **Issue** to report problems or make suggestions.
*   Create a **Pull Request** to submit your code changes.

---

## 📄 License

This project is licensed under the terms of the [MIT License](LICENSE).



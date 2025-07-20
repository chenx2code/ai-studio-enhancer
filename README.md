[阅读中文版本](./README_zh-CN.md)

# Google AI Studio Markdown Copier Chrome Extension

 [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

This is a Chrome extension designed to simplify the process of exporting conversation content from Google AI Studio.

It adds a prominent **"Copy conversation as Markdown"** button to the toolbar on the AI Studio conversation page. After clicking the button, the extension automatically captures the complete history of the current conversation, formats it into clean, structured **Markdown**, and copies it directly to the user's clipboard.

This is very convenient for users who need to use the conversation content for:

*   Saving and archiving important conversation records.
*   Quoting AI responses in technical documents, blog posts, or notes.
*   Sharing the complete interaction process with others.
*   Importing conversations into other tools for analysis or processing.

## :exclamation: Important Prerequisite: Enable Autosave

**Please note:** To ensure this extension works correctly, you **must** enable the **"Autosave"** feature in your Google AI Studio settings.

This extension relies on the internal data updates triggered by AI Studio's autosave to capture the most complete conversation history. If autosave is not enabled, the extension will not be able to retrieve real-time conversation content, leading to failed or incomplete copies.

![screenshot-0](./assets/screenshot-0.png)

---

## ✨ Main Features

*   **One-Click Copy:** Adds an easy-to-use "Copy conversation as Markdown" button to the Google AI Studio conversation page toolbar.
*   **Structured Markdown:** Automatically converts the conversation into standard Markdown format:
    *   The conversation title becomes a level-1 heading (`#`).
    *   Each user prompt becomes a level-2 heading (`##`).
    *   The model's thought process and final answer are included as body text, preserving the original Markdown formatting.
    *   A `---` separator is used to distinguish between different conversation turns.

---

## 🚀 Installation Methods

This extension is not yet available on the Chrome Web Store. You need to load it manually via Developer Mode.

### Method 1: Install from Release (Recommended)

1.  **Download the ZIP Package:**
    *   Visit the project's [Releases Page](https://github.com/FIGHT1337/Google-AI-Studio-Markdown-Copier/releases).
    *   Find the latest release and download the file named `google-ai-studio-markdown-copier-vX.X.X.zip`.

2.  **Unzip the File:**
    *   Extract the downloaded `.zip` file into a permanent, easily accessible folder.

3.  **Load the Extension in Chrome:**
    *   Open the Chrome browser.
    *   Navigate to `chrome://extensions` by typing it in the address bar and pressing Enter.
    *   **Enable Developer Mode:** Ensure the "Developer mode" switch in the top-right corner is turned on.
    *   **Load Unpacked:** Click the "Load unpacked" button that appears on the top-left.
    *   **Select the Folder:** In the file selection window, choose the **folder you extracted in the previous step** (make sure it contains `manifest.json`).
    *   Click "Select Folder".

4.  **Done:**
    *   The "Google AI Studio Markdown Copier" extension should now appear in your extensions list and be enabled by default.

### Method 2: Load from Source (For Developers)

This method is for developers who want the latest code or wish to contribute.

1.  **Get the Project Files:**
    *   Clone this repository using `git clone https://github.com/FIGHT1337/Google-AI-Studio-Markdown-Copier.git`.
    *   Save all files in a convenient folder.

2.  **Load the Extension:**
    *   Follow steps 3 and 4 from "Method 1" to load the root folder containing the source code in Chrome.

---

## 💡 How to Use

1.  Ensure the extension is installed and enabled as described above.
2.  Open any Google AI Studio conversation page (e.g., `https://aistudio.google.com/prompts/...`).
3.  In the toolbar at the top of the page (near the "Save" and "Run" buttons), you should see a new **Markdown icon**.
4.  Hover over the icon to see the tooltip: "Copy conversation as Markdown".
5.  Interact with the model and wait for the conversation to be automatically saved to Google Drive.
6.  Click the copy button.
7.  A browser alert will confirm, "Conversation copied successfully!".
8.  The Markdown-formatted conversation is now on your clipboard. You can paste it into any text editor (like Typora, VS Code), note-taking software, or anywhere else you need it.

![screenshot-1](./assets/screenshot-1.png)

![screenshot-2](./assets/screenshot-2.png)

![screenshot-3](./assets/screenshot-3.png)

![screenshot-4](./assets/screenshot-4.png)

![screenshot-5](./assets/screenshot-5.png)

---

## ⚠️ Known Issues & Limitations

*   **Dependency on Google AI Studio's Structure and API:** This extension is highly dependent on the current HTML structure, CSS class names, and internal network request response data structures of the Google AI Studio website. If Google undertakes a major site redesign in the future, it could break the selectors or data parsing logic, causing the extension to fail. This would require a code update.

---

## 🤝 Contributing

If you find any bugs, have suggestions for improvements, or want to add new features, you are welcome to contribute by:

*   Submitting an **Issue** to report problems or make suggestions.
*   Creating a **Pull Request** to submit your code changes.

---

## 📄 License

This project is licensed under the terms of the [MIT License](LICENSE).

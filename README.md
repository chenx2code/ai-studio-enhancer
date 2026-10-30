<div align="center">
  <img src="https://raw.githubusercontent.com/chenx2code/ai-studio-enhancer/master/icons/icon128.png" width="100" alt="AI Studio Enhancer Logo" />
  <h1>AI Studio Enhancer</h1>
  <p><b>Browser Extension for Google AI Studio</b></p>
  <p><a href="README_zh-CN.md">简体中文</a> · English</p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" /></a>
  </p>
</div>

---

**AI Studio Enhancer** is a Chrome browser extension built for Google AI Studio. It delivers a floating sidebar catalog for long conversation navigation, structured Markdown export, seamless 1-click Obsidian sync, terminal-like prompt history recall, and background completion alerts—elevating your conversation archiving, knowledge management, and daily workflows.

---

## Features

### 1. Conversation Catalog and Quick Navigation

A collapsable sidebar catalog to eliminate endless scrolling through multi-turn chats.

* **Sidebar Catalog Panel:** Click the list icon in the toolbar to slide out the catalog, displaying chronological user prompt previews.
* **Intelligent Attachment Badges:** Accurately identifies and badges file attachments, including `[Image]`, `[PDF File]`, `[Markdown File]`, `[Audio File]`, `[YouTube Video]`, and generic documents `[Document]`.
* **Smooth High-Speed Cruise & Stabilization:** Click any catalog entry to smoothly scroll to the target turn with blue highlight feedback and landing stabilization.
* **Scroll-to-Bottom Floating Button:** When reviewing past turns, a floating button appears automatically in the lower right. Click it to return immediately to the latest response.
* **Keyboard Accessibility:** Use the Tab key to cycle through catalog items, and press Enter or Space to jump.

<!-- Media Suggestion: Short Video/GIF (6-8s)
     Flow: Click toolbar list icon to expand sidebar -> Browse attachment badges -> Click entry to cruise and highlight -> Click floating bottom button to jump back
     Format: <video src="YOUR_VIDEO_URL" controls width="100%"></video> OR ![Catalog Navigation Demo](YOUR_GIF_URL) -->

---

### 2. Markdown Export

Export full conversations into well-structured, standardized `.md` files with support for code blocks, tables, LaTeX math, and attachment badges.

* **One-Click Download:** Click the download icon in the toolbar to save a `.md` file named after your conversation title.
* **Smart Heading Demotion:** To avoid polluting outline trees in Typora, VS Code, or Obsidian, headings inside AI responses are dynamically demoted to level 3 (`###`) and below. Comments inside code blocks remain strictly intact.
* **Customizable Export Fields:** Toggle the following items in the extension settings popup:
  * Prompt sequence numbers (e.g. `## 1. User Prompt`)
  * Model thought reasoning process
  * Original chat URL
  * Active Google account email
* **Compact Attachment Grouping:** Prompts containing multiple images or file attachments are grouped and formatted cleanly per round.

<!-- Media Suggestion: Short Video/GIF (4-6s)
     Flow: Click toolbar download button -> Browser saves .md file -> (Optional) Open in editor to display clean Markdown structure and heading demotion
     Format: <video src="YOUR_VIDEO_URL" controls width="100%"></video> OR ![Markdown Export Demo](YOUR_GIF_URL) -->

---

### 3. 1-Click Export to Obsidian

Directly transfer conversations into your local Obsidian vault via the official Obsidian URI protocol without manual copy-pasting or file creation.

* **Official URI Protocol Dispatch:** Uses `obsidian://new` to communicate with the local Obsidian desktop client. Oversized conversations automatically use a fast clipboard transit route to prevent URL truncation.
* **Custom Destination Folder:** Specify any target folder (e.g. `AI Studio` or `Work/AI`); non-existent subfolders are automatically created by Obsidian.
* **Quick History Chips:** Automatically remembers recently used folders. Click any chip to fill the input instantly.
* **Default Folder and Silent Export:** Check "Set as default folder and do not ask again" in the modal or popup settings to export directly on subsequent clicks.
* **Target Vault Selection:** Configure a specific Vault name in settings, or leave blank to write into your currently active Obsidian vault.

<!-- Media Suggestion: Short Video/GIF (5-8s)
     Flow: Click toolbar gemstone icon -> Choose destination folder in modal -> Click Export -> Obsidian opens with newly created note
     Format: <video src="YOUR_VIDEO_URL" controls width="100%"></video> OR ![Obsidian Export Demo](YOUR_GIF_URL) -->

---

### 4. Terminal-like Prompt History Navigation

Brings the terminal's intuitive `ArrowUp` / `ArrowDown` command recall into the prompt input box.

* **Fast Cycling:** Press the up arrow in the input box to cycle backward through previous prompts, and the down arrow to cycle forward.
* **Anti-Interference Design:** History mode triggers **only** when your text cursor is at index 0 (the absolute start of the input box). Typing, pressing left/right arrow keys, or clicking the mouse will immediately exit history mode to avoid disrupting multi-line editing.
* **Draft Preservation:** If you have typed unsubmitted text, it is automatically cached as a draft when entering history mode. Cycle back to the bottom with `ArrowDown` to restore your draft intact.

<!-- Media Suggestion: Animated GIF / Short Video (4-6s)
     Flow: Cursor at index 0, press ArrowUp to trigger history mode -> Cycle previous prompts -> Press ArrowDown to restore draft
     Format: <video src="YOUR_VIDEO_URL" controls width="100%"></video> OR ![History Recall Demo](YOUR_GIF_URL) -->

---

### 5. Smart Background Desktop Notifications

Free yourself to switch tabs during long generations. Receive native desktop notifications as soon as the model finishes.

* **Generation Completion Alert:** Sends an OS desktop alert when generation finishes. Clicking the notification focuses the corresponding tab.
* **Smart Do-Not-Disturb:** Only triggers when the tab is blurred (e.g. switched tabs, minimized, or working on another monitor). It will never interrupt you while actively looking at the page.
* **Conversation Title Context:** Includes the current conversation title so you know which task finished when juggling multiple chats.

<!-- Media Suggestion: Real Screenshot or Short Video (3-5s)
     Content: Native OS desktop notification alert appearing in system corner when away from tab (showing task title)
     Format: ![Desktop Notification Screenshot](YOUR_IMAGE_URL) OR <video src="YOUR_VIDEO_URL" controls width="100%"></video> -->

---

### 6. Personalization Settings Center

Click the extension icon in your Chrome toolbar to open the configuration popup with instant auto-saving.

* **Export Preferences:** Toggle thought process, original link, account email, and prompt sequence numbers.
* **Notification Control:** Toggle background generation completion alerts.
* **Obsidian Preferences:** Toggle folder prompt before export, configure default destination folder, and specify target Vault name.

<!-- Media Suggestion: Real Static Screenshot
     Content: Settings popup opened by clicking extension icon in Chrome toolbar
     Format: ![Settings Popup Screenshot](YOUR_IMAGE_URL) -->

---

## Installation

This extension currently supports **Google Chrome** and can be loaded via Developer Mode.

### Method 1: Install from Release (Recommended)

1. **Download the ZIP Archive:**
   Go to the [Releases page](https://github.com/chenx2code/ai-studio-enhancer/releases), locate the latest release, and download `ai-studio-enhancer-vX.X.X.zip`.
2. **Extract Files:**
   Extract the downloaded `.zip` file into a permanent local folder (do not delete or move this folder after installing).
3. **Load in Chrome:**
   * Open Chrome and navigate to `chrome://extensions/`.
   * Enable the **"Developer mode"** toggle in the top-right corner.
   * Click the **"Load unpacked"** button in the top-left corner.
   * Select the extracted folder containing `manifest.json`.
4. **Pin to Toolbar:**
   Click the puzzle icon (Extensions) in Chrome's toolbar, locate **AI Studio Enhancer**, and click the pin icon to keep settings readily accessible.

### Method 2: Load from Source Code (Developers)

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/chenx2code/ai-studio-enhancer.git
   ```
2. **Load Extension:**
   Follow step 3 from Method 1 to load the cloned root directory in `chrome://extensions/`.

---

## FAQ & Known Limitations

* **Why does the export button not respond or say conversation not saved?**
  Google AI Studio automatically syncs conversation data to Google Drive in real time. This extension relies on the internal data stream triggered by this auto-save mechanism to capture the complete, lossless conversation history. If you just sent a prompt, wait 1–3 seconds until the cloud save indicator appears near the top (e.g. "Saved to Drive" / cloud icon) before exporting or refreshing the catalog.

  <!-- Media Suggestion: Real Static Screenshot
       Content: Google AI Studio top bar title area showing the "Saved to Drive" cloud status indicator
       Format: ![Cloud Save Status Indicator](YOUR_IMAGE_URL) -->

* **Why does "Export to Obsidian" not open Obsidian?**
  1-Click Obsidian export requires the Obsidian desktop application installed on your machine. On the first export, Chrome may prompt for permission to open the `obsidian://` protocol; click "Allow".
* **Browser Compatibility:**
  Currently tailored and tested specifically for Google Chrome. Official compatibility for Edge, Firefox, Safari, or other browsers is not yet supported.
* **Google AI Studio Interface Changes:**
  The extension depends on Google AI Studio's DOM structure and network responses. Major UI redesigns by Google may affect button placement or catalog parsing. If this occurs, please open an Issue and we will update promptly.

---

## Contributing

Contributions, bug reports, and feature requests are welcome! Feel free to open an **Issue** or submit a **Pull Request**.

---

## License

This project is licensed under the terms of the [MIT License](LICENSE).

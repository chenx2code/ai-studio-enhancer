# Privacy Policy for AI Studio Enhancer

Last updated: November 20, 2026

## 1. Introduction
**AI Studio Enhancer** is committed to protecting your privacy. This extension is designed as a local-first productivity tool for Google AI Studio (`https://aistudio.google.com/*`). We firmly believe in complete transparency and user privacy.

## 2. Data Collection and Usage
**AI Studio Enhancer does NOT collect, store on external servers, sell, or transmit any personal information, sensitive data, browsing history, or user activity.**

Specifically:
- **No Data Collection**: We do not track, collect, or monitor your prompts, AI responses, model outputs, or personal communications.
- **No Remote Telemetry**: We do not use any external analytics services, telemetry trackers, advertising frameworks, or third-party tracking scripts.
- **No External Servers**: The extension has no external backend server and does not transmit any information off your device.

## 3. Permissions Used and Why
The extension requests only the minimum set of permissions necessary to function:

- **Host Permission (`https://aistudio.google.com/*`)**:
  - Used strictly to inject content scripts into Google AI Studio to render the conversation navigation outline, extract conversation text (and optional page metadata such as the chat URL or displayed account email when explicitly enabled by the user in export settings) solely for local Markdown and Obsidian note export, and detect when prompt generation completes.
  - All extracted metadata remains strictly on the user's local device within the exported file and is never logged, stored remotely, or transmitted.
  - The extension never accesses any other websites, domains, or tabs.

- **`storage` Permission**:
  - Used solely with `chrome.storage.local` to store your extension preferences directly on your local device (such as notification toggles, Markdown export options, and recent Obsidian destination folders).
  - No data is synchronized across devices via cloud accounts or sent to any server.

- **`notifications` Permission**:
  - Used to display a native desktop notification when a background prompt generation completes in Google AI Studio, alerting you that your results are ready.

## 4. Third-Party Sharing
We do not sell, trade, license, or share any user data with third parties.

## 5. Security
Because all processing (generating conversation outlines, compiling Markdown, and preparing Obsidian notes) occurs entirely within your local browser environment, your data never leaves your computer.

## 6. Changes to This Policy
If we make any changes to this Privacy Policy, the updated version will be posted here with an updated "Last updated" date.

## 7. Contact
If you have any questions or feedback regarding this Privacy Policy or the extension, please open an issue on our GitHub repository:
[https://github.com/chenx2code/ai-studio-enhancer](https://github.com/chenx2code/ai-studio-enhancer)

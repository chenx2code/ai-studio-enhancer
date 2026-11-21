<div align="center">
  <img src="https://raw.githubusercontent.com/chenx2code/ai-studio-enhancer/master/icons/icon128.png" width="100" alt="AI Studio Enhancer Logo" />
  <h1>AI Studio Enhancer</h1>
  <p><b>Google AI Studio 增强浏览器扩展</b></p>
  <p>简体中文 · <a href="README.md">English</a></p>
  <p>
    <a href="https://chromewebstore.google.com/detail/ilomdejhlbkbfmmlakdgbnhbdjgdobmo"><img src="https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=googlechrome&logoColor=white" alt="Chrome Web Store" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" /></a>
    <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy_Policy-Read-lightgrey.svg" alt="Privacy Policy" /></a>
  </p>
</div>

---

AI Studio Enhancer 是一款专为 Google AI Studio 设计的 Chrome 浏览器扩展，提供长对话侧边栏目录导航、结构化 Markdown 导出、Obsidian 一键同步、终端式提问回溯以及后台生成通知等功能，显著提升对话管理、内容沉淀与日常交互体验。

---

## 功能特性

### 1. 长对话目录与快速定位

在对话右侧提供可随时收起的悬浮大纲目录，解决多轮长会话中来回滚动翻找 prompt 的痛点。

* **侧边栏目录面板：** 点击工具栏列表按钮展开侧边栏，按时间顺序列出所有用户提问的摘要预览。
* **智能附件标识：** 自动精准识别并标记各种附件类型，包括 `[Image]`、`[PDF File]`、`[Markdown File]`、`[Audio File]`、`[YouTube Video]` 以及通用文档 `[Document]`。
* **平滑巡航与稳着陆定位：** 点击目录项即可平滑滚动至对应对话轮次，并带有蓝色高亮视觉反馈，确保精准着陆。
* **一键返回底部：** 向上翻阅历史内容时，右下角自动浮现“跳转到底部”按钮，单次点击立刻回到最新生成的回答处。
* **键盘无障碍导航：** 支持 Tab 键在目录项间切换，按 Enter 或空格键快速跳转。

https://github.com/user-attachments/assets/ea16fde3-ffd6-4485-937b-f260c0f063e9

---

### 2. Markdown 格式导出

一键将长对话转录为结构清晰、排版规范的 `.md` 文件，完整支持代码块、表格、数学公式与附件信息。

* **一键下载：** 点击工具栏下载按钮，直接下载以对话标题命名的 Markdown 文件。
* **大纲层级智能平移：** 为防止 AI 生成的多级标题破坏 Typora、VS Code 或 Obsidian 的大纲树，AI 回答中的各级标题自动降级至三级（`###`）及以下，代码块注释严格保持原样。
* **灵活可配置选项：** 可在设置面板自由开关以下导出字段：
  * 提问轮次序号（如 `## 1. 用户提问`）
  * 模型的思考推理过程（Thought process）
  * 对话原网页链接
  * 当前 Google 账号邮箱
* **紧凑附件与多图排版：** 对话中包含的多张图片或文件附件按轮次紧凑归类排版，清晰美观。

https://github.com/user-attachments/assets/5f37b679-7d8b-43fd-a595-6e12fdd25da4

---

### 3. Obsidian 一键导出

直接通过官方 Obsidian URI 协议将当前对话无缝写入本地 Obsidian 知识库，免去手动复制粘贴与创建文件的繁琐步骤。

* **官方 URI 协议直连：** 采用 `obsidian://new` 协议无缝调起本地 Obsidian 客户端，超长内容自动走剪贴板快速通道，稳定防截断。
* **自定义目标文件夹：** 导出时可自由输入存放路径（如 `AI Studio` 或 `Work/AI`），自动创建不存在的多级目录。
* **快捷历史标签：** 自动记录最近使用的文件夹，点击标签即可一秒填入。
* **默认路径与静默导出：** 支持在弹窗或设置中勾选“设为默认文件夹且不再提醒”，后续点击工具栏图标即可静默完成同步。
* **指定 Vault 仓库：** 支持在设置中指定目标 Vault 仓库名称，留空则默认写入当前活动的 Vault。

https://github.com/user-attachments/assets/c9f30f30-e1d1-4c28-a439-1bb026cef5a0

---

### 4. 终端式提问历史回溯

把终端命令行极度顺手的 `ArrowUp` / `ArrowDown` 体验带入 AI Studio 输入框，轻松调出曾经发过的 Prompt。

* **快速翻阅：** 在输入框中按下上箭头连续查看历史提问，按下箭头向前翻阅。
* **智能防误触：** 仅当光标位于输入框最前（索引 0）时按 `ArrowUp` 才会触发历史回溯模式；正常多行编辑、按左右键移动光标或鼠标点击时立刻自动退出，绝不干扰正常打字。
* **未发送草稿保护：** 若当前输入框已有未发出的内容，进入历史模式时会被自动暂存为草稿；只需按 `ArrowDown` 回到底部即可完美还原草稿。

---

### 5. 智能后台桌面通知

在生成长文本或深度思考内容时放心切换标签页，AI 生成完毕后自动接收系统原生桌面通知。

* **生成完成提醒：** 当模型完成整段回复后发送系统原生通知，点击通知可直接切换回对应标签页。
* **智能离开检测：** 仅在用户离开当前页面（如切换至其他标签页、最小化窗口或在其他屏幕工作）时才会触发，正视页面时绝不弹窗打扰。
* **会话标题感知：** 通知卡片包含当前对话的标题，多开任务时一目了然。

---

### 6. 个性化设置中心

点击浏览器工具栏中的扩展图标，即可呼出设置面板，所有配置实时自动生效。

* **导出偏好控制：** 自由开关思考过程、对话原链接、账号邮箱与提问轮次序号。
* **后台通知开关：** 随时开启或关闭生成完成桌面通知。
* **Obsidian 行为配置：** 切换是否在导出前询问目标文件夹、设定默认目标路径及 Obsidian Vault 仓库名称。

https://github.com/user-attachments/assets/89bf6814-e9eb-4359-b51a-203464d3181c

---

## 安装方法

本扩展支持 **Google Chrome** 及主流 Chromium 内核浏览器（如 Microsoft Edge、Brave 等）。

### 方法一：从 Chrome Web Store 安装（强烈推荐）

最便捷的安装方式，无需开启开发者模式，且后续支持跟随商店**自动静默更新**：

1. 前往 [Chrome 网上应用店 - AI Studio Enhancer](https://chromewebstore.google.com/detail/ilomdejhlbkbfmmlakdgbnhbdjgdobmo)。
2. 点击 **“添加至 Chrome”** (Add to Chrome)。
3. 在浏览器工具栏中点击拼图图标（扩展程序），找到 **AI Studio Enhancer** 并点击图钉固定，方便随时查看状态与配置。

---

### 方法二：从 Release 离线安装（无法访问商店时）

如果网络环境无法直接访问 Chrome 应用店，可下载离线包手动安装：

1. **下载 ZIP 压缩包：**
   访问本项目的 [Releases 页面](https://github.com/chenx2code/ai-studio-enhancer/releases)，找到最新版本并下载 `ai-studio-enhancer-vX.X.X.zip`。
2. **解压文件：**
   将下载的 `.zip` 文件解压到一个固定的本地文件夹中（请勿解压后移动或删除该文件夹）。
3. **在 Chrome 中加载扩展：**
   * 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并按回车。
   * 打开页面右上角的**“开发者模式 (Developer mode)”**开关。
   * 点击左上角的**“加载已解压的扩展程序 (Load unpacked)”**按钮。
   * 在弹出的文件选择器中，选中刚解压出的文件夹（确保该目录下直接包含 `manifest.json`）。
4. **固定到工具栏：**
   点击 Chrome 右上角的拼图图标（扩展管理），找到 **AI Studio Enhancer** 并点击图钉图标，将其固定在浏览器工具栏以便随时打开设置。

---

### 方法三：从源码加载（开发者）

1. **克隆仓库：**
   ```bash
   git clone https://github.com/chenx2code/ai-studio-enhancer.git
   ```
2. **加载扩展：**
   参照“方法二”中的步骤 3，在 `chrome://extensions/` 中选择克隆下来的项目根目录即可。

---

## 常见问题与说明

* **为什么点击导出按钮没有反应或提示未保存？**
  Google AI Studio 会实时将对话内容自动同步至 Google Drive。本扩展依赖自动保存时触发的内部数据流来捕获完整、无损的对话历史。如果刚刚完成提问，请等待 1~3 秒直到页面顶部出现云端保存状态（如 "Saved to Drive" / 云端图标）后再点击导出或刷新目录。

* **点击“导出至 Obsidian”后没有唤起软件？**
  一键导出功能依赖本机已安装的 Obsidian 客户端。如果是首次使用，Chrome 可能会弹出“是否允许打开 Obsidian”的系统授权提示，点击“允许”即可。
* **浏览器兼容性说明：**
  当前版本专为 Google Chrome 深度定制和测试，暂未对 Edge、Firefox、Safari 或其他浏览器进行官方适配。
* **网页结构变动风险：**
  本扩展依赖 Google AI Studio 当前的前端 DOM 结构与内部网络响应。如果 Google 官方进行了重大界面改版，可能会导致部分按钮或目录定位失效。遇此情况欢迎提交 Issue，我们将第一时间跟进更新。

---

## 贡献

欢迎提交 Issue 报告问题或提出功能建议，也欢迎提交 Pull Request 共同改进本项目。

---

## 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

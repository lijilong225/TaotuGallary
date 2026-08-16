# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction Summary]
- Date: 2026-08-15
- Context: 套图管理器项目开发中，用户要求代码修改后同步提交到 GitHub
- Instructions:
  - 每次完成代码修改后，自动执行 git add + git commit + git push，同步提交到远程 GitHub 仓库（无需用户手动要求）
  - 用户明确要求暂不提交时，保持改动为未提交状态

[Version File Workflow]
- Date: 2026-08-16
- Context: 用户要求新增 version 文件存储版本号，每次提交前递增
- Category: Workflow & Collaboration
- Instructions:
  - 项目根目录 `version` 文件存储当前版本号（如 `1.1.0`），不包含 `v` 前缀
  - 每次代码提交前，先将 `version` 文件中的版本号递增（patch 递增，即 `1.1.0` → `1.1.1`）
  - 版本号递增后，再执行 git add / commit / push
  - 登录页和主页显示的版本号来自 `version` 文件

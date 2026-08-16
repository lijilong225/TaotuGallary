# Requirements Document

## Introduction

在浏览区新增缩略图尺寸调整功能，支持小、中、大三种显示尺寸。小尺寸 160px，中尺寸 240px，大尺寸 320px。默认显示中尺寸。尺寸调整按钮放置于页面右侧。

## Glossary

- **缩略图尺寸**: 图片宫格中单个缩略图卡片的最小显示宽度，分为小、中、大三档
- **小尺寸**: 缩略图最小显示宽度 160px
- **中尺寸**: 缩略图最小显示宽度 240px
- **大尺寸**: 缩略图最小显示宽度 320px
- **尺寸调整按钮**: 用于切换缩略图尺寸的交互控件，放置于页面右侧

## Requirements

### Requirement 1: 三档缩略图尺寸

**User Story:** AS 用户, I want 缩略图支持小、中、大三种显示尺寸, so that 根据浏览需求选择合适的大小

#### Acceptance Criteria

1. WHEN 用户浏览图片宫格, 系统 SHALL 提供小、中、大三种缩略图尺寸选项
2. WHEN 尺寸为小, 系统 SHALL 以 160px 为最小宽度渲染缩略图卡片
3. WHEN 尺寸为中, 系统 SHALL 以 240px 为最小宽度渲染缩略图卡片
4. WHEN 尺寸为大, 系统 SHALL 以 320px 为最小宽度渲染缩略图卡片

### Requirement 2: 默认中尺寸

**User Story:** AS 用户, I want 首次进入页面时默认使用中尺寸, so that 获得平衡的浏览体验

#### Acceptance Criteria

1. WHEN 用户首次登录并浏览图片宫格, 系统 SHALL 默认使用中尺寸渲染缩略图

### Requirement 3: 尺寸调整按钮位于顶栏右上角

**User Story:** AS 用户, I want 尺寸调整按钮位于顶栏右上角, so that 便于操作且始终可见

#### Acceptance Criteria

1. WHEN 主界面可见, 系统 SHALL 在顶栏右上角展示尺寸调整按钮
2. WHILE 顶栏右上角展示按钮, 系统 SHALL 将按钮置于当前用户名与退出登录按钮旁

### Requirement 4: 三按钮并排切换即时生效

**User Story:** AS 用户, I want 通过小、中、大三个并排按钮切换尺寸, so that 直观操作并快速看到效果

#### Acceptance Criteria

1. WHEN 用户浏览图片宫格, 系统 SHALL 展示小、中、大三个并排的尺寸按钮
2. WHEN 当前尺寸生效, 系统 SHALL 高亮对应的尺寸按钮
3. WHEN 用户点击某尺寸按钮, 系统 SHALL 立即以新尺寸重新渲染当前图片宫格
4. WHEN 用户点击某尺寸按钮, 系统 SHALL 高亮该按钮并取消其他按钮的高亮
5. WHILE 切换尺寸, 系统 SHALL 保持当前浏览目录与分页状态不变

### Requirement 5: 大尺寸下缩略图清晰度

**User Story:** AS 用户, I want 大尺寸显示时缩略图保持清晰, so that 避免图片放大模糊

#### Acceptance Criteria

1. IF 当前尺寸为大, 系统 SHALL 请求并展示宽度不小于 320px 的缩略图
2. IF 当前尺寸为中, 系统 SHALL 请求并展示宽度不小于 240px 的缩略图
3. IF 当前尺寸为小, 系统 SHALL 请求并展示宽度不小于 160px 的缩略图

# Requirements Document

## Introduction

在图片放大预览（lightbox）中，新增右侧详情面板。点击图片放大显示后，用户可通过工具栏按钮展开或收起右侧面板，面板展示当前媒体文件（图片或视频）的标准元数据信息。面板默认收起。

## Glossary

- **Lightbox**: 图片/视频的放大预览视图
- **详情面板**: lightbox 右侧展示媒体元数据的面板
- **媒体文件**: 图片或视频文件，包含文件系统直存文件与压缩包内条目
- **标准字段**: 文件名、路径、类型、文件大小、修改时间；图片额外包含宽高尺寸，视频额外包含播放时长

## Requirements

### Requirement 1: 详情面板切换按钮

**User Story:** AS 用户, I want 在 lightbox 中通过按钮控制详情面板的显示与隐藏, so that 需要时查看详情，不需要时保持画面简洁

#### Acceptance Criteria

1. WHEN lightbox 处于打开状态, 系统 SHALL 在工具栏提供详情面板切换按钮
2. WHEN 用户点击切换按钮且面板当前收起, 系统 SHALL 展开右侧详情面板
3. WHEN 用户点击切换按钮且面板当前展开, 系统 SHALL 收起右侧详情面板

### Requirement 2: 面板默认收起

**User Story:** AS 用户, I want 打开 lightbox 时详情面板默认不显示, so that 优先获得完整浏览画面

#### Acceptance Criteria

1. WHEN 打开 lightbox 预览媒体, 系统 SHALL 保持详情面板处于收起状态
2. WHILE 详情面板收起, 系统 SHALL 隐藏面板且不占用 lightbox 布局空间

### Requirement 3: 标准字段展示

**User Story:** AS 用户, I want 详情面板展示媒体文件的标准元数据, so that 了解文件的基本属性

#### Acceptance Criteria

1. WHEN 详情面板展开且当前为图片, 系统 SHALL 展示文件名、路径、类型、文件大小、图片宽度、图片高度、修改时间
2. WHEN 详情面板展开且当前为视频, 系统 SHALL 展示文件名、路径、类型、文件大小、播放时长、修改时间
3. WHEN 详情面板展开且当前媒体位于压缩包内, 系统 SHALL 同时展示所属压缩包名称与压缩包内条目路径
4. IF 文件大小大于等于 1MB, 系统 SHALL 以 MB 为单位展示文件大小
5. IF 文件大小小于 1MB, 系统 SHALL 以 KB 为单位展示文件大小

### Requirement 4: 切换时内容同步更新

**User Story:** AS 用户, I want 切换到上一张或下一张时详情内容随之更新, so that 面板始终反映当前预览文件

#### Acceptance Criteria

1. WHEN 用户切换 lightbox 到下一个媒体且面板处于展开状态, 系统 SHALL 刷新面板内容为当前媒体元数据
2. WHEN 用户切换 lightbox 到上一个媒体且面板处于展开状态, 系统 SHALL 刷新面板内容为当前媒体元数据

### Requirement 5: 元数据获取失败处理

**User Story:** AS 用户, I want 元数据无法获取时有明确提示, so that 不会误以为功能故障

#### Acceptance Criteria

1. IF 当前媒体的元数据获取失败, 系统 SHALL 在面板中展示友好错误提示
2. IF 请求的路径或压缩包条目不存在, 系统 SHALL 返回 404 错误响应
3. IF 请求的路径超出图库根目录, 系统 SHALL 返回 403 错误响应

# Requirements Document

## Introduction

排序功能新增"修改时间"排序方式，并将默认排序调整为按修改时间倒序，即最新修改的文件排在最前。

## Glossary

- **修改时间**: 文件或压缩包条目的最近修改时间，由服务端以 `mtime` 字段提供
- **排序方式**: 浏览区媒体项与文件夹的排列依据，支持"修改时间"与"文件名"

## Requirements

### Requirement 1: 新增修改时间排序方式

**User Story:** AS 用户, I want 按修改时间排序浏览内容, so that 优先看到最新更新的文件

#### Acceptance Criteria

1. WHEN 用户浏览图片宫格或目录, 系统 SHALL 在排序方式选项中提供"修改时间"
2. WHEN 排序方式为修改时间, 系统 SHALL 依据媒体项与文件夹的修改时间确定排列顺序

### Requirement 2: 默认修改时间倒序

**User Story:** AS 用户, I want 首次使用时默认按修改时间倒序排列, so that 最新修改的文件始终排在最前

#### Acceptance Criteria

1. WHEN 用户首次登录并浏览内容, 系统 SHALL 默认按修改时间倒序排列媒体项与文件夹
2. WHEN 用户修改排序方式或顺序, 系统 SHALL 以用户选择的排序方式显示

### Requirement 3: 倒序即最新在前

**User Story:** AS 用户, I want 修改时间倒序时最新修改的文件排在最前, so that 快速定位最近更新的内容

#### Acceptance Criteria

1. WHEN 排序为修改时间且顺序为倒序, 系统 SHALL 将修改时间最新的项排列在最前
2. WHEN 修改时间相同的项存在, 系统 SHALL 以文件名排序确定先后
3. WHILE 排序为修改时间, 系统 SHALL 在文件夹、压缩包、图片与视频项上统一生效

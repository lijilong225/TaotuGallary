# Requirements Document

## Introduction

在浏览区新增瀑布流布局，用户可通过切换按钮在网格布局与瀑布流布局之间切换。切换按钮放置于缩略图尺寸调整按钮右侧。默认显示网格布局。布局模式在浏览器本地记忆，用户重新登录后保持不变。

## Glossary

- **布局模式**: 图片宫格的展示方式，分为网格布局与瀑布流布局
- **网格布局**: 缩略图按固定行列整齐排列，每格宽高一致
- **瀑布流布局**: 缩略图按多列错落排列，列数自适应容器宽度，每列内图片依次堆叠
- **布局切换按钮**: 用于切换布局模式的交互控件，放置于缩略图尺寸调整按钮右侧

## Requirements

### Requirement 1: 两种布局模式

**User Story:** AS 用户, I want 在网格布局与瀑布流布局之间切换, so that 根据浏览习惯选择展示方式

#### Acceptance Criteria

1. WHEN 用户浏览图片宫格, 系统 SHALL 支持网格布局与瀑布流布局两种模式
2. WHEN 布局为网格, 系统 SHALL 按固定行列整齐展示缩略图
3. WHEN 布局为瀑布流, 系统 SHALL 将缩略图分布到多个自适应列中错落展示

### Requirement 2: 布局切换按钮位于尺寸调整右侧

**User Story:** AS 用户, I want 布局切换按钮位于缩略图尺寸调整按钮右侧, so that 与尺寸调整、排序操作集中在同一区域便于操作

#### Acceptance Criteria

1. WHEN 排序栏可见, 系统 SHALL 在缩略图尺寸调整按钮右侧展示布局切换按钮
2. WHILE 排序栏展示布局切换按钮, 系统 SHALL 将按钮与排序控件置于同一行

### Requirement 3: 单个布局切换按钮

**User Story:** AS 用户, I want 通过单个"瀑布流/网格"切换按钮切换布局, so that 界面简洁并直观切换

#### Acceptance Criteria

1. WHEN 排序栏展示布局切换按钮, 系统 SHALL 在缩略图尺寸调整按钮右侧展示单个布局切换按钮
2. WHEN 当前布局为网格, 系统 SHALL 将切换按钮文案显示为"瀑布流"
3. WHEN 当前布局为瀑布流, 系统 SHALL 将切换按钮文案显示为"网格"
4. WHEN 用户点击切换按钮, 系统 SHALL 立即以新布局重新渲染当前图片宫格
5. WHILE 切换布局, 系统 SHALL 保持当前浏览目录、分页状态与缩略图尺寸档位不变

### Requirement 4: 默认网格布局

**User Story:** AS 用户, I want 首次使用时默认网格布局, so that 获得整齐一致的初始浏览体验

#### Acceptance Criteria

1. WHEN 用户首次登录且无已保存的布局偏好, 系统 SHALL 默认使用网格布局

### Requirement 5: 服务端布局模式记忆

**User Story:** AS 用户, I want 布局模式在服务端按账号记忆, so that 重新登录或更换设备后保持一致

#### Acceptance Criteria

1. WHEN 用户切换布局模式, 系统 SHALL 将布局模式保存到服务端当前用户偏好
2. WHEN 用户登录后浏览图片宫格, 系统 SHALL 读取服务端当前用户的布局偏好并应用
3. WHEN 同一账号在不同设备登录, 系统 SHALL 展示相同的布局模式
4. IF 当前用户无已保存的布局偏好, 系统 SHALL 使用网格布局

### Requirement 6: 瀑布流与缩略图尺寸档位协同

**User Story:** AS 用户, I want 瀑布流下缩略图尺寸档位仍然生效, so that 瀑布流列宽与缩略图清晰度可调节

#### Acceptance Criteria

1. WHEN 布局为瀑布流, 系统 SHALL 依据当前缩略图尺寸档位确定列宽
2. WHEN 用户在瀑布流下调整缩略图尺寸, 系统 SHALL 以新尺寸重新渲染瀑布流列

### Requirement 7: 视频缩略图参与瀑布流

**User Story:** AS 用户, I want 视频缩略图在瀑布流中按视频原始宽高比错落显示, so that 视频与图片统一呈现瀑布流效果

#### Acceptance Criteria

1. WHEN 布局为瀑布流, 系统 SHALL 按视频原始宽高比渲染视频缩略图
2. WHEN 视频缩略图生成, 系统 SHALL 保持视频帧原始宽高比且最长边不超过当前尺寸档位
3. WHEN 视频缩略图生成, 系统 SHALL 不使用黑色填充边
4. WHEN 视频原始宽高比未知, 系统 SHALL 以正方形缩略图兜底显示

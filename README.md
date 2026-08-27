# 满载一缕星辉 Starglow · 个人摄影网站

一个以风光摄影为主的个人作品集静态网站，风格参考 Ruud Luijten（`rluijten.photography`）：大字号衬线排版、大量留黑、全屏沉浸式浏览、滚动视差与进场动效。同时适配手机与电脑端。

## 特色交互

- **随机配色**：仿 Coolors 的思路，每次按空格键（或点 Photographs 旁的圆形按钮）都会随机生成一套柔和的相近色配色；生成规则保证文字与背景对比舒适、不刺眼，上次配色会被记住。
- **Photographs 悬停子菜单**：鼠标悬停（手机端点击）顶部 Photographs，即可展开照片分类列表，点击跳转到对应分类；滚动页面时会自动高亮当前分类。
- 导航只有 **Photographs** 和 **About Me** 两个入口（外加一个配色按钮）。
- 每张照片下方右侧只显示拍摄参数（光圈 / 快门 / 焦距），不遮挡图片本身。

## 本地预览

直接双击 `index.html` 即可打开；或者在当前目录启动一个本地服务器：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 目录结构

```text
index.html            作品页（Photographs）
about.html            关于页（About Me）
assets/
  css/style.css       全部样式与主题变量
  js/config.js        站点信息、分类与照片配置（改这里）
  js/main.js          动效与交互脚本
  photos/             照片目录（目前是占位图）
```

## 怎么换成你自己的照片

照片已按《网站上传照片分类及路径.docx》导入，13 个分类、267 张，全部压缩为网页版（1920px 长边、JPG），存放在 `assets/photos/<分类>/`（“菲林时光”下还有 4 个胶片分组目录）。

每张照片的 EXIF（光圈 / 快门 / 焦距）已自动提取并写入 `assets/js/config.js`；检测不到参数的照片不会显示参数。分类内照片顺序随机。

以后新增或替换照片，运行导入脚本即可（原片不会被修改）：

```powershell
powershell -ExecutionPolicy Bypass -File tools\import-photos.ps1
```

想单独提取某文件夹的 EXIF 参数，用：

```powershell
powershell -ExecutionPolicy Bypass -File tools\extract-exif.ps1 -Folder "D:\照片\某个分类"
```

两个脚本都使用系统自带的 .NET 能力，不需要安装任何软件。分类增删改在 `tools/import-photos.ps1` 顶部的 `$CATS` 列表里调整。

顶部导航固定只有 **Photographs** 和 **About Me** 两个入口，不需要改动。

## 配色方案

- 默认是一套深墨蓝配色；每次按空格键或点击 Photographs 旁的按钮，会随机生成新的柔和配色。
- 配色生成逻辑在 `assets/js/main.js` 的 `randomPalette()` 中：随机选择一个主色相，再派生相近的背景、文字与点缀色，深浅随机、饱和度被限制在舒适区间。

## 换名字 / 联系方式

站名、邮箱等集中在两处：`assets/js/config.js` 的 `SITE` 对象，以及两个 HTML 文件里的页脚文字。搜索“满载一缕星辉”“Starglow”“baowenze2007@foxmail.com”即可全部替换。

## 占位图说明

`assets/photos/` 下目前是程序生成的占位风景图（SVG），用于预览版式。正式上线前请用真实照片替换。

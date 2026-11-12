# 白话文翻译与人物关系图

## 内容

- `translations/NN.json`：第 NN 回逐段白话文译文，键为 `_blocks/NN.json` 中的三位段落编号。
- `_blocks/`：从原文提取的段落原文及插入位置，不改动原文件。
- `translation.css`、`site.js`：译文样式、译文显示开关、正文人名自动链接。
- `characters.html`、`characters-data.js`、`characters.js`、`characters.css`：人物关系图页面。
- `_build_characters.py`：人物数据与关系图的生成脚本。

## 生成与校验

```bash
cd book
python3 _build_blocks.py        # 从构建时的原文副本 /tmp/opencode/hlm-original 重新提取段落
python3 _apply_translations.py  # 将 translations/*.json 插入各回原文
python3 _validate_translations.py
python3 _build_characters.py    # 生成 characters-data.js
```

仓库中的 80 回页面已经生成，通常不需要重跑上述脚本。若要重跑，请先把未改动的原文副本放到 `/tmp/opencode/hlm-original/`，以免把已插入的译文再次当作原文。

`_apply_translations.py` 只做插入：原文、脂批和原有 HTML 标记均保持原样；新增内容只有译文块、样式表、脚本和阅读工具栏。插入位置会避开未闭合的红色批语 `<span>`，避免译文落入批语内部。

## 翻译规模

- 80 回
- 1974 个译文块
- 原文约 58.6 万字，译文约 62.2 万字

## 人物链接

章节正文中的 151 位人物姓名及别名由 `site.js` 在浏览器中自动识别并链接到 `characters.html#人物id`。打开人物页后，对应人物卡片与关系图中的节点会高亮，并显示身份、简介和主要关系。人物关系图只列主要人物，完整人物索引见同一页下方。

/* 章节页交互：白话文开关 + 人名自动链接 + 人物页高亮 */
(function () {
  "use strict";

  var STORAGE_KEY = "hlm-translations-hidden";

  function setupTranslationToggle() {
    var button = document.getElementById("toggleTranslations");
    if (!button) return;
    var hidden = false;
    try {
      hidden = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      hidden = false;
    }
    function apply(value) {
      document.body.classList.toggle("translations-hidden", value);
      button.textContent = value ? "显示白话文翻译" : "隐藏白话文翻译";
      button.setAttribute("aria-pressed", value ? "true" : "false");
    }
    apply(hidden);
    button.addEventListener("click", function () {
      hidden = !hidden;
      apply(hidden);
      try {
        window.localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
      } catch (e) {
        /* 忽略隐私模式下的存储错误 */
      }
    });
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function setupCharacterLinks() {
    if (!window.HLM_CHARACTERS || !document.body) return;

    var byAlias = Object.create(null);
    window.HLM_CHARACTERS.forEach(function (person) {
      var names = [person.name].concat(person.aliases || []);
      names.forEach(function (name) {
        name = String(name || "").trim();
        if (name.length < 2 || byAlias[name]) return;
        byAlias[name] = person;
      });
    });
    var aliases = Object.keys(byAlias).sort(function (a, b) {
      return b.length - a.length;
    });
    if (!aliases.length) return;

    var pattern = new RegExp(aliases.map(escapeRegExp).join("|"), "g");
    var skipSelector =
      ".red, .translation-block, .reader-tools, script, style, a, h1, h2, h3, title, .no-char-link";
    var root = document.querySelector("p[align='left']") || document.body;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.length < 2) {
          return NodeFilter.FILTER_REJECT;
        }
        var parent = node.parentElement;
        if (!parent || parent.closest(skipSelector)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      if (!pattern.test(text)) {
        pattern.lastIndex = 0;
        return;
      }
      pattern.lastIndex = 0;
      var fragment = document.createDocumentFragment();
      var last = 0;
      var match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) {
          fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
        }
        var person = byAlias[match[0]];
        var link = document.createElement("a");
        link.className = "char-link";
        link.href = "characters.html#" + encodeURIComponent(person.id);
        link.title = "查看" + person.name + "的人物关系";
        link.textContent = match[0];
        fragment.appendChild(link);
        last = match.index + match[0].length;
      }
      if (last < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(last)));
      }
      node.parentNode.replaceChild(fragment, node);
    });
  }

  function init() {
    setupTranslationToggle();
    setupCharacterLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

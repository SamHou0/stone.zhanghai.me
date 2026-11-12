/* 人物关系图渲染与交互 */
(function () {
  "use strict";

  var people = window.HLM_CHARACTERS || [];
  var graph = window.HLM_GRAPH || { nodes: [], edges: [] };
  var byId = Object.create(null);
  var graphNodeById = Object.create(null);
  var selectedId = null;

  var HOUSE_ORDER = [
    "贾府·宁国府",
    "贾府·荣国府",
    "史家",
    "王家",
    "薛家",
    "林家",
    "金陵甄家",
    "姑苏甄家",
    "刘家",
    "太虚幻境",
    "其他",
  ];

  people.forEach(function (p) {
    byId[p.id] = p;
  });
  graph.nodes.forEach(function (n) {
    graphNodeById[n.id] = n;
  });

  var svgNS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs) {
    var node = document.createElementNS(svgNS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function nodeWidth(name) {
    return Math.max(54, name.length * 14 + 18);
  }

  function edgeClass(label) {
    if (/夫妻|妾室|未婚|恋人|知己|情感/.test(label)) return "edge-marriage";
    if (/主仆|陪房|老仆|丫鬟/.test(label)) return "edge-servant";
    if (/父子|父女|母子|母女|祖孙|养父|收养|姐妹|兄妹|姐弟|叔侄|舅甥|外祖母|侄孙女|夫妻/.test(label)) {
      return "edge-parent";
    }
    return "edge-other";
  }

  function renderGraph() {
    var svg = document.getElementById("relationGraph");
    if (!svg) return;
    svg.innerHTML = "";

    var edgeLayer = svgEl("g", { class: "edge-layer" });
    var labelLayer = svgEl("g", { class: "edge-label-layer" });
    var nodeLayer = svgEl("g", { class: "node-layer" });
    svg.appendChild(edgeLayer);
    svg.appendChild(labelLayer);
    svg.appendChild(nodeLayer);

    var seen = Object.create(null);
    var edges = graph.edges.filter(function (edge) {
      var key = [edge.from, edge.to].sort().join("|");
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    edges.forEach(function (edge, index) {
      var a = graphNodeById[edge.from];
      var b = graphNodeById[edge.to];
      if (!a || !b) return;
      var mx = (a.x + b.x) / 2;
      var my = (a.y + b.y) / 2 + (index % 2 === 0 ? -5 : 5);
      var bend = index % 2 === 0 ? -12 : 12;
      var path = svgEl("path", {
        d: "M " + a.x + " " + a.y + " Q " + (mx + bend) + " " + (my + bend) + " " + b.x + " " + b.y,
        class: "graph-edge " + edgeClass(edge.label),
        "data-from": edge.from,
        "data-to": edge.to,
      });
      edgeLayer.appendChild(path);

      var label = svgEl("text", {
        x: mx + bend,
        y: my + bend - 3,
        class: "graph-edge-label",
        "data-from": edge.from,
        "data-to": edge.to,
      });
      label.textContent = edge.label;
      labelLayer.appendChild(label);
    });

    graph.nodes.forEach(function (n) {
      var person = byId[n.id];
      if (!person) return;
      var width = nodeWidth(person.name);
      var group = svgEl("g", {
        class: "graph-node group-" + n.group,
        "data-id": n.id,
        tabindex: "0",
        role: "button",
        "aria-label": person.name + "，" + person.role,
      });
      var rect = svgEl("rect", {
        x: n.x - width / 2,
        y: n.y - 15,
        width: width,
        height: 30,
        rx: 7,
        ry: 7,
      });
      var text = svgEl("text", { x: n.x, y: n.y + 1 });
      text.textContent = person.name;
      var title = svgEl("title");
      title.textContent = person.name + "｜" + person.role + "｜" + person.desc;
      group.appendChild(title);
      group.appendChild(rect);
      group.appendChild(text);
      group.addEventListener("click", function () {
        selectPerson(n.id, true, true);
      });
      group.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectPerson(n.id, true, true);
        }
      });
      group.addEventListener("mouseenter", function () {
        highlightGraph(n.id, false);
      });
      group.addEventListener("mouseleave", function () {
        if (selectedId) highlightGraph(selectedId, false);
        else clearGraphHighlight();
      });
      nodeLayer.appendChild(group);
    });
  }

  function clearGraphHighlight() {
    document.querySelectorAll(".graph-node").forEach(function (node) {
      node.classList.remove("is-selected", "is-related", "is-dimmed");
    });
    document.querySelectorAll(".graph-edge, .graph-edge-label").forEach(function (node) {
      node.classList.remove("is-active");
    });
  }

  function highlightGraph(id, dimOthers) {
    var person = byId[id];
    if (!person) return;
    var related = Object.create(null);
    person.relations.forEach(function (relation) {
      related[relation.id] = true;
    });
    document.querySelectorAll(".graph-node").forEach(function (node) {
      var nodeId = node.getAttribute("data-id");
      node.classList.toggle("is-selected", nodeId === id);
      node.classList.toggle("is-related", !!related[nodeId]);
      if (dimOthers) node.classList.toggle("is-dimmed", nodeId !== id && !related[nodeId]);
    });
    document.querySelectorAll(".graph-edge, .graph-edge-label").forEach(function (node) {
      var a = node.getAttribute("data-from");
      var b = node.getAttribute("data-to");
      node.classList.toggle("is-active", a === id || b === id);
    });
  }

  function renderDetail(person) {
    var panel = document.getElementById("detailPanel");
    if (!panel) return;
    if (!person) {
      panel.innerHTML = '<p class="detail-placeholder">点击图中人物或下方人物卡片，查看身份与关系。</p>';
      return;
    }
    panel.innerHTML = "";

    var head = document.createElement("div");
    head.className = "detail-head";
    var name = document.createElement("strong");
    name.textContent = person.name;
    var role = document.createElement("span");
    role.className = "detail-role";
    role.textContent = person.role;
    var house = document.createElement("span");
    house.className = "detail-house";
    house.textContent = person.house;
    head.appendChild(name);
    head.appendChild(role);
    head.appendChild(house);
    panel.appendChild(head);

    var desc = document.createElement("p");
    desc.className = "detail-desc";
    desc.textContent = person.desc;
    panel.appendChild(desc);

    if (person.relations.length) {
      var relTitle = document.createElement("p");
      relTitle.className = "detail-relations";
      relTitle.textContent = "主要关系：";
      panel.appendChild(relTitle);

      person.relations.forEach(function (relation) {
        var chip = document.createElement("a");
        chip.className = "relation-chip";
        chip.href = "#" + encodeURIComponent(relation.id);
        chip.textContent = relation.name;
        var label = document.createElement("small");
        label.textContent = relation.label;
        chip.appendChild(label);
        chip.addEventListener("click", function (event) {
          event.preventDefault();
          selectPerson(relation.id, true, true);
        });
        panel.appendChild(chip);
      });
    }
  }

  function selectPerson(id, scroll, updateHash) {
    var person = byId[id];
    if (!person) return;
    selectedId = id;

    document.querySelectorAll(".person-card.is-selected").forEach(function (card) {
      card.classList.remove("is-selected");
    });
    document.querySelectorAll(".person-card").forEach(function (card) {
      card.classList.toggle("is-selected", card.getAttribute("data-id") === id);
    });
    highlightGraph(id, true);

    var card = document.getElementById(id);
    if (card && scroll) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    renderDetail(person);
    document.title = person.name + " · 红楼梦人物关系图";
    if (updateHash !== false) {
      try {
        history.replaceState(null, "", "#" + encodeURIComponent(id));
      } catch (e) {
        location.hash = encodeURIComponent(id);
      }
    }
  }

  function resetSelection() {
    selectedId = null;
    document.querySelectorAll(".person-card.is-selected").forEach(function (card) {
      card.classList.remove("is-selected");
    });
    clearGraphHighlight();
    renderDetail(null);
    document.title = "红楼梦人物关系图";
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {
      location.hash = "";
    }
  }

  function renderHouses() {
    var container = document.getElementById("houses");
    if (!container || !people.length) return;
    container.innerHTML = "";

    var groups = Object.create(null);
    people.forEach(function (person) {
      if (!groups[person.house]) groups[person.house] = [];
      groups[person.house].push(person);
    });

    var houses = HOUSE_ORDER.filter(function (house) {
      return groups[house] && groups[house].length;
    });
    Object.keys(groups).forEach(function (house) {
      if (houses.indexOf(house) === -1) houses.push(house);
    });

    houses.forEach(function (house) {
      var section = document.createElement("section");
      section.className = "section-house";
      section.setAttribute("data-house", house);

      var title = document.createElement("h3");
      title.className = "house-title";
      title.textContent = house;
      var count = document.createElement("small");
      count.textContent = groups[house].length + " 人";
      title.appendChild(count);
      section.appendChild(title);

      var grid = document.createElement("div");
      grid.className = "card-grid";

      groups[house].forEach(function (person) {
        var card = document.createElement("article");
        card.className = "person-card";
        card.id = person.id;
        card.setAttribute("data-id", person.id);
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", "查看" + person.name + "的人物关系");

        var heading = document.createElement("h3");
        var link = document.createElement("a");
        link.href = "#" + encodeURIComponent(person.id);
        link.textContent = person.name;
        heading.appendChild(link);
        card.appendChild(heading);

        var role = document.createElement("p");
        role.className = "card-role";
        role.textContent = person.role;
        card.appendChild(role);

        var desc = document.createElement("p");
        desc.className = "card-desc";
        desc.textContent = person.desc;
        card.appendChild(desc);

        if (person.relations.length) {
          var rel = document.createElement("p");
          rel.className = "card-relations";
          person.relations.slice(0, 3).forEach(function (relation) {
            var span = document.createElement("span");
            span.textContent = relation.name;
            rel.appendChild(span);
          });
          card.appendChild(rel);
        }

        card.addEventListener("click", function (event) {
          if (event.target.closest("a")) return;
          selectPerson(person.id, false, true);
        });
        card.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectPerson(person.id, false, true);
          }
        });
        link.addEventListener("click", function (event) {
          event.preventDefault();
          selectPerson(person.id, true, true);
        });

        grid.appendChild(card);
      });

      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  function applySearch(query) {
    var q = String(query || "").trim().toLowerCase();
    var visible = 0;
    document.querySelectorAll(".person-card").forEach(function (card) {
      var person = byId[card.getAttribute("data-id")];
      var haystack = [
        person.name,
        person.role,
        person.house,
        person.desc,
        (person.aliases || []).join(" "),
        person.relations.map(function (r) { return r.name; }).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      var match = !q || haystack.indexOf(q) !== -1;
      card.classList.toggle("is-hidden", !match);
      if (match) visible += 1;
    });

    document.querySelectorAll(".section-house").forEach(function (section) {
      var count = section.querySelectorAll(".person-card:not(.is-hidden)").length;
      section.style.display = count ? "" : "none";
    });

    var graphIds = Object.create(null);
    people.forEach(function (person) {
      if (!q) return;
      var haystack = [
        person.name,
        person.role,
        person.house,
        person.desc,
        (person.aliases || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (haystack.indexOf(q) !== -1) graphIds[person.id] = true;
    });
    document.querySelectorAll(".graph-node").forEach(function (node) {
      var id = node.getAttribute("data-id");
      node.classList.toggle("is-dimmed", !!q && !graphIds[id] && id !== selectedId);
    });

    var countEl = document.getElementById("searchCount");
    if (countEl) {
      countEl.textContent = q
        ? "显示 " + visible + " / " + people.length + " 位人物"
        : "共 " + people.length + " 位人物";
    }

    var noResults = document.getElementById("noResults");
    if (!visible && q) {
      if (!noResults) {
        noResults = document.createElement("p");
        noResults.id = "noResults";
        noResults.className = "no-results";
        noResults.textContent = "没有找到匹配的人物，请换一个关键词试试。";
        document.getElementById("houses").appendChild(noResults);
      }
    } else if (noResults) {
      noResults.remove();
    }
  }

  function handleHash(scroll) {
    var id = "";
    try {
      id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    } catch (e) {
      id = (location.hash || "").replace(/^#/, "");
    }
    if (id && byId[id]) {
      selectPerson(id, scroll !== false, false);
    }
  }

  function init() {
    renderGraph();
    renderHouses();
    var search = document.getElementById("searchInput");
    if (search) {
      search.addEventListener("input", function () {
        applySearch(search.value);
      });
    }
    var reset = document.getElementById("resetButton");
    if (reset) {
      reset.addEventListener("click", function () {
        if (search) search.value = "";
        applySearch("");
        resetSelection();
      });
    }
    applySearch("");
    window.addEventListener("hashchange", function () {
      handleHash(true);
    });
    if (location.hash) {
      window.setTimeout(function () {
        handleHash(true);
      }, 60);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

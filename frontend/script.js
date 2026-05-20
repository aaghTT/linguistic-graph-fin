let svg, simulation, gLinks, gNodes;
let currentNode = null;
let zoom;

let allNodes = new Map();
let allEdges = new Map();
let visibleNodes = new Set();
let nodeDataCache = new Map();
let isLoading = false;

const CONFIG = {
    nodeRadius: 28,
    linkDistance: 150,
    chargeStrength: -300,
    horizontalSpacing: 120,
    childrenSpread: 80,
    verticalSpacing: 80
};

//INITIALIZATION

function initSimulation() {
    const container = document.getElementById("graph-container");
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    svg = d3.select("#graph-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    
    zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            if (gLinks && gNodes) {
                gLinks.attr("transform", event.transform);
                gNodes.attr("transform", event.transform);
            }
        });
    
    svg.call(zoom);
    
    gLinks = svg.append("g").attr("class", "links");
    gNodes = svg.append("g").attr("class", "nodes");
    
    simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(CONFIG.linkDistance))
        .force("charge", d3.forceManyBody().strength(CONFIG.chargeStrength))
        .force("center", d3.forceCenter(width/2, height/2))
        .force("collision", d3.forceCollide().radius(CONFIG.nodeRadius + 10));
    
    simulation.alphaDecay(0.02);
    simulation.velocityDecay(0.6);
}

//HELPER FUNCTIONS

function truncateText(text, maxLen = 18) {
    if (!text) return "?";
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + "...";
}

function showNotification(msg, type = "info") {
    const colors = {
        success: "#4b996e",
        error: "#dd5d4f",
        warning: "#d39e49",
        info: "#4B6399"
    };
    
    const notif = document.createElement("div");
    notif.textContent = msg;
    notif.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        z-index: 10000;
        background: ${colors[type]}; color: white; padding: 12px 24px;
        border-radius: 8px; font-size: 13px;
        animation: notificationSlide 4s ease forwards;
        font-family: 'Raleway', sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 450px;
        text-align: center;
        word-wrap: break-word;
        white-space: normal;
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
}

function getParentId(nodeId) {
    for (const edge of allEdges.values()) {
        if (edge.source === nodeId && edge.relation === "hypernym") {
            return edge.target;
        }
    }
    return null;
}

function getChildrenIds(nodeId) {
    const children = [];
    for (const edge of allEdges.values()) {
        if (edge.target === nodeId && edge.relation === "hypernym") {
            children.push(edge.source);
        }
    }
    return children;
}

function getAllAncestors(nodeId) {
    const ancestors = [];
    let current = nodeId;
    const visited = new Set();
    
    while (current && !visited.has(current)) {
        visited.add(current);
        const parent = getParentId(current);
        if (!parent) break;
        ancestors.push(parent);
        current = parent;
    }
    return ancestors;
}

function removeNodeAndEdges(nodeId) {
    const edgesToDelete = [];
    for (const [key, edge] of allEdges.entries()) {
        if (edge.source === nodeId || edge.target === nodeId) {
            edgesToDelete.push(key);
        }
    }
    edgesToDelete.forEach(key => allEdges.delete(key));
    allNodes.delete(nodeId);
}

//NODE и EDGE MANAGEMENT

function ensureNodeExists(nodeData, parentId = null, position = null) {
    const nodeId = nodeData.id;
    
    if (allNodes.has(nodeId)) {
        const existing = allNodes.get(nodeId);
        if (!existing.ru_name && nodeData.ru_name) {
            existing.ru_name = nodeData.ru_name;
            existing.en_name = nodeData.en_name;
            existing.type = nodeData.type;
        }
        return existing;
    }
    
    let x, y;
    const container = document.getElementById("graph-container");
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    
    if (position) {
        x = position.x;
        y = position.y;
    } else if (parentId && allNodes.has(parentId)) {
        const parent = allNodes.get(parentId);
        x = parent.x || centerX;
        y = parent.y || centerY;
    } else {
        x = centerX + (Math.random() - 0.5) * 150;
        y = centerY + (Math.random() - 0.5) * 100;
    }
    
    const node = {
        id: nodeId,
        ru_name: nodeData.ru_name || nodeData.id,
        en_name: nodeData.en_name || "",
        type: nodeData.type || "unknown",
        x: x, y: y,
        fx: x, fy: y
    };
    allNodes.set(nodeId, node);
    return node;
}

function addEdge(childId, parentId, relation = "hypernym") {
    const key = `${childId}|${parentId}`;
    const reverseKey = `${parentId}|${childId}`;
    
    if (!allEdges.has(key) && !allEdges.has(reverseKey)) {
        allEdges.set(key, { source: childId, target: parentId, relation: relation });
        return true;
    }
    return false;
}

function positionParent(parentNode, childNode) {
    parentNode.x = childNode.x - CONFIG.horizontalSpacing;
    parentNode.y = childNode.y;
    parentNode.fx = parentNode.x;
    parentNode.fy = parentNode.y;
}

function positionChildren(childrenNodes, parentNode) {
    const count = childrenNodes.length;
    const startY = parentNode.y - (count - 1) * CONFIG.childrenSpread / 2;
    
    childrenNodes.forEach((child, index) => {
        child.x = parentNode.x + CONFIG.horizontalSpacing;
        child.y = startY + index * CONFIG.childrenSpread;
        child.fx = child.x;
        child.fy = child.y;
    });
}

function repositionNodes() {
    if (!currentNode) return;
    
    const current = allNodes.get(currentNode);
    if (!current) return;
    
    const parentId = getParentId(currentNode);
    if (parentId && allNodes.has(parentId)) {
        const parent = allNodes.get(parentId);
        if (parent) {
            positionParent(parent, current);
        }
    }
    
    const childrenIds = getChildrenIds(currentNode);
    if (childrenIds.length > 0) {
        const children = childrenIds.map(id => allNodes.get(id)).filter(c => c && c.id);
        if (children.length > 0) {
            positionChildren(children, current);
        }
    }
}

//API CALLS

async function fetchNodeData(nodeId) {
    if (nodeDataCache.has(nodeId)) return nodeDataCache.get(nodeId);
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/concept/${nodeId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        nodeDataCache.set(nodeId, data);
        return data;
    } catch (error) {
        console.error("Fetch error:", error);
        return null;
    }
}

function updateVisibleNodes() {
    if (!currentNode) return;
    
    const ancestors = getAllAncestors(currentNode);
    const directChildren = getChildrenIds(currentNode);
    
    const keepNodes = new Set();
    keepNodes.add(currentNode);
    ancestors.forEach(a => keepNodes.add(a));
    directChildren.forEach(c => keepNodes.add(c));
    
    const nodesToRemove = [];
    for (const nodeId of allNodes.keys()) {
        if (!keepNodes.has(nodeId)) {
            nodesToRemove.push(nodeId);
        }
    }
    
    for (const nodeId of nodesToRemove) {
        removeNodeAndEdges(nodeId);
    }
    
    if (nodesToRemove.length > 0) {
        console.log(`Deleted ${nodesToRemove.length} nodes from memory`);
    }
    
    visibleNodes.clear();
    for (const nodeId of allNodes.keys()) {
        visibleNodes.add(nodeId);
    }
    
    repositionNodes();
    renderGraph();
    updateStatsPanel();
    refreshSearchResults();
}

async function expandParentOfCurrent() {
    if (!currentNode) {
        showNotification("Нет главного узла", "warning");
        return;
    }
    
    if (isLoading) {
        showNotification("Загрузка...", "warning");
        return;
    }
    
    console.log(`Expanding parent of current node: ${currentNode}`);
    isLoading = true;
    
    try {
        const nodeData = await fetchNodeData(currentNode);
        if (!nodeData) throw new Error("No data");
        
        const parentId = nodeData.hypernym;
        if (!parentId) {
            showNotification(`У узла "${nodeData.ru_name}" нет parent`, "warning");
            return;
        }
        
        if (getParentId(currentNode)) {
            showNotification(`parent уже добавлен`, "info");
            isLoading = false;
            return;
        }
        
        const parentData = await fetchNodeData(parentId);
        if (!parentData) throw new Error("No parent data");
        
        const current = allNodes.get(currentNode);
        const parent = ensureNodeExists(parentData);
        positionParent(parent, current);
        
        addEdge(currentNode, parentId, "hypernym");
        updateVisibleNodes();
        
        setTimeout(() => centerOnNode(parentId), 100);
        
        showNotification(`parent "${truncateText(parentData.ru_name, 15)}" добавлен`, "success");
        
    } catch (error) {
        console.error("Error expanding parent:", error);
        showNotification(`Ошибка загрузки parent`, "error");
    } finally {
        isLoading = false;
    }
    refreshSearchResults();
}

async function expandChildrenOfCurrent() {
    if (!currentNode) {
        showNotification("Нет главного узла", "warning");
        return;
    }
    
    if (isLoading) {
        showNotification("Загрузка...", "warning");
        return;
    }
    
    console.log(`Expanding children of current node: ${currentNode}`);
    isLoading = true;
    
    try {
        const nodeData = await fetchNodeData(currentNode);
        if (!nodeData) throw new Error("No data");
        
        const children = nodeData.children || [];
        
        if (children.length === 0) {
            showNotification(`У узла "${nodeData.ru_name}" нет children`, "warning");
            return;
        }
        
        const current = allNodes.get(currentNode);
        const newChildren = [];
        
        for (const child of children) {
            const existingChildren = getChildrenIds(currentNode);
            if (!existingChildren.includes(child.id)) {
                const childData = await fetchNodeData(child.id);
                if (childData) {
                    const childNode = ensureNodeExists(childData);
                    newChildren.push(childNode);
                    addEdge(child.id, currentNode, "hypernym");
                }
            }
        }
        
        if (newChildren.length > 0) {
            positionChildren(newChildren, current);
        }
        
        if (newChildren.length === 0) {
            showNotification(`children уже добавлены`, "info");
        } else {
            showNotification(`Добавлено ${newChildren.length} children`, "success");
        }
        
        updateVisibleNodes();
        
    } catch (error) {
        console.error("Error expanding children:", error);
        showNotification(`Ошибка загрузки children`, "error");
    } finally {
        isLoading = false;
    }
    refreshSearchResults();
}

async function setAsCurrentNode(newNodeId) {
    if (isLoading) return;
    if (newNodeId === currentNode) return;
    
    console.log(`Setting current node to: ${newNodeId}`);
    isLoading = true;
    
    try {
        const newNodeData = await fetchNodeData(newNodeId);
        if (!newNodeData) throw new Error("No data");
        
        ensureNodeExists(newNodeData);
        currentNode = newNodeId;
        
        updateVisibleNodes();
        
        setTimeout(() => centerOnNode(newNodeId), 100);
        
        const nodeName = truncateText(newNodeData.ru_name, 20);
        showNotification(`Главный узел: "${nodeName}"`, "success");
        
    } catch (error) {
        console.error("Error setting current node:", error);
        showNotification(`Ошибка`, "error");
    } finally {
        isLoading = false;
    }
    refreshSearchResults();
}

//CRUD OPERATIONS

async function addNodeToDatabase(nodeData) {
    try {
        console.log("Sending node data:", nodeData);
        const response = await fetch(`http://127.0.0.1:8000/api/concept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nodeData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server response:", errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Add node error:", error);
        return null;
    }
}

async function updateNodeInDatabase(nodeId, updateData) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/concept/${nodeId}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Update node error:", error);
        return null;
    }
}

async function deleteNodeFromDatabase(nodeId) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/concept/${nodeId}/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Delete node error:", error);
        return null;
    }
}

async function addEdgeToDatabase(parentId, childId, relation) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/semantic-edge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from_id: parentId, to_id: childId, rel_type: relation })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Add edge error:", error);
        return null;
    }
}

//FUNCTIONS FOR EDITING

async function loadNodeDataForEdit(nodeId) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/concept/${nodeId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Load node error:", error);
        return null;
    }
}

async function openEditModal() {
    if (!currentNode) {
        showNotification("Нет выбранного узла. Сначала кликните на узел, чтобы сделать его главным.", "warning");
        return;
    }
    
    const nodeData = await loadNodeDataForEdit(currentNode);
    if (!nodeData) {
        showNotification("Не удалось загрузить данные узла", "error");
        return;
    }
    
    document.getElementById("editNodeId").value = nodeData.id;
    document.getElementById("editNodeRuName").value = nodeData.ru_name || "";
    document.getElementById("editNodeEnName").value = nodeData.en_name || "";
    document.getElementById("editNodeType").value = nodeData.type || "object_concept";
    document.getElementById("editNodeHypernym").value = nodeData.hypernym || "";
    
    openModal("editNodeModal");
}

async function saveNodeEdit() {
    const nodeId = parseInt(document.getElementById("editNodeId").value);
    const newRuName = document.getElementById("editNodeRuName").value.trim();
    const newEnName = document.getElementById("editNodeEnName").value.trim();
    const newType = document.getElementById("editNodeType").value;
    const newHypernym = document.getElementById("editNodeHypernym").value ? parseInt(document.getElementById("editNodeHypernym").value) : null;
    
    if (!newRuName) {
        showNotification("Введите русское имя", "warning");
        return;
    }
    if (!newEnName) {
        showNotification("Введите английское имя", "warning");
        return;
    }
    if (newHypernym !== null && (isNaN(newHypernym) || newHypernym < 1 || newHypernym > 999999999)) {
        showNotification("ID parent должен быть от 1 до 999 999 999", "warning");
        return;
    }
    
    const updateData = {
        new_ru_name: newRuName,
        new_en_name: newEnName,
        new_type: newType,
        new_hypernym: newHypernym
    };
    
    const result = await updateNodeInDatabase(nodeId, updateData);
    if (result && result.status === "updated") {
        showNotification(`Узел "${newRuName}" обновлён`, "success");
        closeModal("editNodeModal");
        
        if (allNodes.has(nodeId)) {
            const node = allNodes.get(nodeId);
            node.ru_name = newRuName;
            node.en_name = newEnName;
            node.type = newType;
        }
        
        nodeDataCache.delete(nodeId);
        
        if (currentNode === nodeId) {
            updateVisibleNodes();
        } else {
            renderGraph();
            updateStatsPanel();
        }
    } else {
        showNotification(`Ошибка обновления узла`, "error");
    }
    refreshSearchResults();
}

async function deleteCurrentNode() {
    if (!currentNode) {
        showNotification("Нет выбранного узла", "warning");
        return;
    }
    
    const node = allNodes.get(currentNode);
    const nodeName = node?.ru_name || currentNode;
    
    const confirmed = confirm(`Вы уверены, что хотите удалить узел "${nodeName}" (ID: ${currentNode})?\n\nУдалятся также все связи этого узла!`);
    
    if (!confirmed) return;
    
    const result = await deleteNodeFromDatabase(currentNode);
    if (result && result.status === "deleted") {
        showNotification(`Узел "${nodeName}" удалён`, "success");
        closeModal("editNodeModal");
        
        removeNodeAndEdges(currentNode);
        nodeDataCache.delete(currentNode);
        currentNode = null;
        
        visibleNodes.clear();
        for (const nodeId of allNodes.keys()) {
            visibleNodes.add(nodeId);
        }
        
        renderGraph();
        updateStatsPanel();
    } else {
        showNotification(`Ошибка удаления узла`, "error");
    }
    refreshSearchResults();
}

//SEARCH

async function searchAndExpand() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) {
        showNotification("Введите слово для поиска", "warning");
        return;
    }
    
    if (isLoading) {
        showNotification("Подождите...", "warning");
        return;
    }
    
    isLoading = true;
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/search/?q=${encodeURIComponent(query)}&limit=20`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            showNotification(`Ничего не найдено для "${query}"`, "warning");
            isLoading = false;
            return;
        }
        
        allNodes.clear();
        allEdges.clear();
        visibleNodes.clear();
        nodeDataCache.clear();
        currentNode = null;
        
        gLinks.selectAll("*").remove();
        gNodes.selectAll("*").remove();
        
        simulation.nodes([]);
        simulation.force("link").links([]);
        simulation.alpha(0);
        simulation.stop();
        
        const container = document.getElementById("graph-container");
        const centerX = container.clientWidth / 2;
        let startY = container.clientHeight / 2 - (data.results.length - 1) * CONFIG.verticalSpacing / 2;
        
        for (let i = 0; i < data.results.length; i++) {
            const result = data.results[i];
            const nodeData = await fetchNodeData(result.id);
            if (nodeData) {
                const node = ensureNodeExists(nodeData);
                node.x = centerX;
                node.y = startY + i * CONFIG.verticalSpacing;
                node.fx = node.x;
                node.fy = node.y;
                visibleNodes.add(result.id);
            }
        }
        
        if (visibleNodes.size === 1) {
            const firstId = data.results[0].id;
            currentNode = firstId;
            
            simulation.nodes(Array.from(allNodes.values()));
            simulation.alpha(0.5).restart();
            
            renderGraph();
            updateStatsPanel();
            
            setTimeout(() => {
                const node = allNodes.get(firstId);
                if (node) {
                    const transform = d3.zoomIdentity
                        .translate(container.clientWidth / 2 - node.x, container.clientHeight / 2 - node.y)
                        .scale(1);
                    svg.transition().duration(400).call(zoom.transform, transform);
                }
            }, 100);
            
        } else if (visibleNodes.size > 1) {
            currentNode = null;
            
            simulation.nodes(Array.from(allNodes.values()));
            simulation.alpha(0.5).restart();
            
            renderGraph();
            updateStatsPanel();
            
            setTimeout(() => {
                const nodes = Array.from(allNodes.values());
                if (nodes.length > 0) {
                    const sumX = nodes.reduce((sum, n) => sum + n.x, 0);
                    const sumY = nodes.reduce((sum, n) => sum + n.y, 0);
                    const centerX = sumX / nodes.length;
                    const centerY = sumY / nodes.length;
                    
                    const transform = d3.zoomIdentity
                        .translate(container.clientWidth / 2 - centerX, container.clientHeight / 2 - centerY)
                        .scale(1);
                    svg.transition().duration(400).call(zoom.transform, transform);
                }
            }, 100);
        } else {
            simulation.nodes(Array.from(allNodes.values()));
            simulation.alpha(0.5).restart();
            renderGraph();
            updateStatsPanel();
        }
        
        document.getElementById("searchNodesInput").value = "";
        document.getElementById("searchResults").style.display = "none";
        
        showNotification(`Найдено ${data.results.length} результатов для "${query}"`, "success");
        
    } catch (error) {
        console.error("Search error:", error);
        showNotification(`Ошибка поиска`, "error");
    } finally {
        isLoading = false;
    }
}

//GRAPH RENDERING

function renderGraph() {
    const visibleNodeIds = new Set(visibleNodes);
    const nodeObjects = Array.from(allNodes.values()).filter(n => visibleNodeIds.has(n.id));
    
    const edgeObjects = [];
    for (const edge of allEdges.values()) {
        if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
            const sourceNode = allNodes.get(edge.source);
            const targetNode = allNodes.get(edge.target);
            if (sourceNode && targetNode) {
                edgeObjects.push({
                    source: sourceNode,
                    target: targetNode,
                    relation: edge.relation
                });
            }
        }
    }
    
    const linkSelection = gLinks.selectAll(".link")
        .data(edgeObjects, d => `${d.source.id}|${d.target.id}`);
    linkSelection.exit().remove();
    
    const linkEnter = linkSelection.enter().append("g").attr("class", "link");
    linkEnter.append("line")
        .attr("stroke", "#C8D0D8")
        .attr("stroke-width", 1.5);
    
    const nodeSelection = gNodes.selectAll(".node")
        .data(nodeObjects, d => d.id);
    nodeSelection.exit().remove();
    
    const nodeEnter = nodeSelection.enter()
        .append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded)
        );
    
    nodeEnter.append("circle")
        .attr("r", CONFIG.nodeRadius)
        .attr("fill", "#4B6399")
        .attr("stroke", "#0E2134")
        .attr("stroke-width", 2);
    
    nodeEnter.append("text")
        .attr("dy", 5)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", "11px")
        .attr("font-family", "Raleway, sans-serif")
        .attr("font-weight", "700")
        .text(d => truncateText(d.ru_name, 18));
    
    nodeEnter.append("title")
        .text(d => {
            const enNameText = (d.en_name && d.en_name !== "") ? d.en_name : "—";
            const typeText = (d.type && d.type !== "") ? d.type : "—";
            return `${d.ru_name || "—"}\nАнгл: ${enNameText}\nID: ${d.id}\nТип: ${typeText}`;
        });
    
    nodeEnter.on("click", (event, d) => {
        event.stopPropagation();
        if (d.id === currentNode) {
            expandParentOfCurrent();
        } else {
            setAsCurrentNode(d.id);
        }
    });
    
    nodeEnter.on("contextmenu", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        if (d.id === currentNode) {
            expandChildrenOfCurrent();
        } else {
            setAsCurrentNode(d.id);
        }
        return false;
    });
    
    nodeEnter.on("mouseenter", function() {
        d3.select(this).select("circle").attr("stroke-width", 3);
    }).on("mouseleave", function() {
        d3.select(this).select("circle").attr("stroke-width", 2);
    });
    
    const allNodesElem = nodeEnter.merge(nodeSelection);
    const allLinks = linkEnter.merge(linkSelection);
    
    simulation.nodes(nodeObjects);
    simulation.force("link").links(edgeObjects);
    
    nodeObjects.forEach(node => {
        if (node.fx !== undefined && node.fx !== null) {
            node.x = node.fx;
            node.y = node.fy;
        }
    });
    
    simulation.alpha(0.3).restart();
    
    simulation.on("tick", () => {
        allLinks.selectAll("line")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        
        allNodesElem.attr("transform", d => `translate(${d.x},${d.y})`);
    });
    
    setTimeout(() => {
        if (simulation.alpha() < 0.05) simulation.stop();
    }, 2000);
    
    refreshSearchResults();
}

//DRAG HANDLERS

function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
    d.x = event.x;
    d.y = event.y;
}

function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);
}

//RESET

function resetGraph(soft = false) {
    if (!soft) {
        allNodes.clear();
        allEdges.clear();
        visibleNodes.clear();
        nodeDataCache.clear();
        currentNode = null;
        isLoading = false;
    }
    
    gLinks.selectAll("*").remove();
    gNodes.selectAll("*").remove();
    
    simulation.nodes([]);
    simulation.force("link").links([]);
    simulation.alpha(0);
    simulation.stop();
    
    updateStatsPanel();
    
    const container = document.getElementById("graph-container");
    const transform = d3.zoomIdentity.translate(container.clientWidth / 2, container.clientHeight / 2);
    svg.transition().duration(400).call(zoom.transform, transform);
    
    if (!soft) {
        document.getElementById("searchInput").value = "";
        document.getElementById("searchInput").focus();
        showNotification("Полотно очищено", "success");
    }
    refreshSearchResults();
}

function centerOnNode(nodeId) {
    const node = allNodes.get(nodeId);
    if (!node) return;
    
    const container = document.getElementById("graph-container");
    const transform = d3.zoomIdentity
        .translate(container.clientWidth / 2 - node.x, container.clientHeight / 2 - node.y)
        .scale(1);
    
    svg.transition().duration(400).call(zoom.transform, transform);
}

//UI UPDATE

function updateStatsPanel() {
    const childrenCount = currentNode ? getChildrenIds(currentNode).length : 0;
    const ancestorsCount = currentNode ? getAllAncestors(currentNode).length : 0;
    const currentName = currentNode ? (allNodes.get(currentNode)?.ru_name || currentNode) : "—";
    
    document.getElementById("statVisible").textContent = visibleNodes.size;
    document.getElementById("statMemory").textContent = allNodes.size;
    document.getElementById("statEdges").textContent = allEdges.size;
    document.getElementById("statChildren").textContent = childrenCount;
    document.getElementById("statAncestors").textContent = ancestorsCount;
    document.getElementById("statCurrent").textContent = truncateText(currentName, 20);
    document.getElementById("currentNodeDisplay").textContent = truncateText(currentName, 30);
}

function searchVisibleNodes() {
    const query = document.getElementById("searchNodesInput").value.trim().toLowerCase();
    const resultsDiv = document.getElementById("searchResults");
    const resultsList = document.getElementById("searchResultsList");
    
    if (!query) {
        resultsDiv.style.display = "none";
        resultsList.innerHTML = "";
        return;
    }
    
    const visibleNodeIds = new Set(visibleNodes);
    const matches = [];
    
    for (const nodeId of visibleNodeIds) {
        const node = allNodes.get(nodeId);
        if (node && node.ru_name) {
            const ruName = node.ru_name.toLowerCase();
            if (ruName.includes(query)) {
                matches.push({
                    id: node.id,
                    ru_name: node.ru_name,
                    type: node.type
                });
            }
        }
    }
    
    if (matches.length === 0) {
        resultsList.innerHTML = '<div style="color: #8A9AAA; padding: 4px;">Ничего не найдено</div>';
        resultsDiv.style.display = "block";
        return;
    }
    
    const displayMatches = matches.slice(0, 10);
    
    resultsList.innerHTML = displayMatches.map(match => `
        <div style="padding: 6px 8px; margin: 2px 0; cursor: pointer; border-radius: 6px; background: #FFFFFF;"
             onclick="window.jumpToNodeAndHighlight(${match.id})">
            <strong>${truncateText(match.ru_name, 30)}</strong>
            <span style="color: #8A9AAA; font-size: 9px;"> (ID: ${match.id})</span>
        </div>
    `).join('');
    
    if (matches.length > 10) {
        resultsList.innerHTML += `<div style="padding: 4px; color: #8A9AAA; font-size: 9px;">... и ещё ${matches.length - 10} результатов</div>`;
    }
    
    resultsDiv.style.display = "block";
}

function refreshSearchResults() {
    const query = document.getElementById("searchNodesInput").value.trim();
    if (query) {
        searchVisibleNodes();
    } else {
        document.getElementById("searchResults").style.display = "none";
    }
}

function highlightNode(nodeId) {
    const nodeElement = gNodes.selectAll(".node")
        .filter(d => d.id === nodeId)
        .select("circle");
    
    if (nodeElement.empty()) return;
    
    nodeElement.transition()
        .duration(150)
        .attr("r", CONFIG.nodeRadius + 4)
        .transition()
        .duration(150)
        .attr("r", CONFIG.nodeRadius)
        .transition()
        .duration(150)
        .attr("r", CONFIG.nodeRadius + 3)
        .transition()
        .duration(150)
        .attr("r", CONFIG.nodeRadius);
}

async function jumpToNodeAndHighlight(nodeId) {
    await setAsCurrentNode(nodeId);

    setTimeout(() => {
        highlightNode(nodeId);
        showNotification(`Вы на "${truncateText(allNodes.get(nodeId)?.ru_name || nodeId, 25)}" узле`, "success");
    }, 300);
}

//MODAL HANDLERS

function openModal(modalId) {
    document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

async function suggestNextId() {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/concepts?limit=100`);
        if (response.ok) {
            const data = await response.json();
            if (data.concepts && data.concepts.length > 0) {
                const maxId = Math.max(...data.concepts.map(c => c.id)) + 1;
                const idInput = document.getElementById("nodeId");
                idInput.placeholder = `например, ${maxId}`;
                idInput.value = maxId;
            }
        }
    } catch (e) {
        console.log("Cannot suggest ID");
    }
}

function setupModals() {
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.onclick = () => {
            const modalId = closeBtn.getAttribute('data-modal');
            closeModal(modalId);
        };
    });
    
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    };
    
    document.getElementById("addNodeBtn").onclick = () => {
        suggestNextId();
        openModal("addNodeModal");
    };
    
    document.getElementById("addNodeForm").onsubmit = async (e) => {
        e.preventDefault();
        
        const idInput = document.getElementById("nodeId");
        const ruNameInput = document.getElementById("nodeRuName");
        const enNameInput = document.getElementById("nodeEnName");
        const typeSelect = document.getElementById("nodeType");
        const hypernymInput = document.getElementById("nodeHypernym");
        
        const id = parseInt(idInput.value);
        const ru_name = ruNameInput.value.trim();
        const en_name = enNameInput.value.trim();
        const type = typeSelect.value;
        const hypernym = hypernymInput.value ? parseInt(hypernymInput.value) : null;
        
        if (isNaN(id) || id < 1 || id > 999999999) {
            showNotification("ID должен быть целым числом от 1 до 999 999 999", "warning");
            idInput.focus();
            return;
        }
        
        if (!ru_name) {
            showNotification("Введите русское имя", "warning");
            ruNameInput.focus();
            return;
        }
        
        if (ru_name.length > 500) {
            showNotification("Русское имя не должно превышать 500 символов", "warning");
            ruNameInput.focus();
            return;
        }
        
        if (!en_name) {
            showNotification("Введите английское имя", "warning");
            enNameInput.focus();
            return;
        }
        
        if (en_name.length > 500) {
            showNotification("Английское имя не должно превышать 500 символов", "warning");
            enNameInput.focus();
            return;
        }
        
        if (hypernym !== null && (isNaN(hypernym) || hypernym < 1 || hypernym > 999999999)) {
            showNotification("ID parent должен быть целым числом от 1 до 999 999 999", "warning");
            hypernymInput.focus();
            return;
        }
        
        const nodeData = { id, ru_name, en_name, type, hypernym };
        
        const result = await addNodeToDatabase(nodeData);
        if (result && result.status === "ok") {
            showNotification(`Узел "${ru_name}" (ID: ${id}) создан`, "success");
            closeModal("addNodeModal");
            document.getElementById("addNodeForm").reset();
            nodeDataCache.delete(id);
            if (currentNode) {
                nodeDataCache.delete(currentNode);
                updateVisibleNodes();
            }
        } else {
            showNotification(`Ошибка создания узла. Возможно, ID уже существует или parent не найден.`, "error");
        }
        refreshSearchResults();
    };
    
    document.getElementById("addEdgeBtn").onclick = () => openModal("addEdgeModal");
    
    document.getElementById("addEdgeForm").onsubmit = async (e) => {
        e.preventDefault();
        const parentId = parseInt(document.getElementById("edgeParentId").value);
        const childId = parseInt(document.getElementById("edgeChildId").value);
        const relType = document.getElementById("edgeType").value;
        
        if (isNaN(parentId) || parentId < 1 || parentId > 999999999) {
            showNotification("ID parent должен быть от 1 до 999 999 999", "warning");
            return;
        }
        
        if (isNaN(childId) || childId < 1 || childId > 999999999) {
            showNotification("ID child должен быть от 1 до 999 999 999", "warning");
            return;
        }
        
        const result = await addEdgeToDatabase(parentId, childId, relType);
        if (result && result.status === "ok") {
            showNotification(`Связь создана`, "success");
            closeModal("addEdgeModal");
            document.getElementById("addEdgeForm").reset();
            if (currentNode) {
                nodeDataCache.delete(currentNode);
                updateVisibleNodes();
            }
        } else {
            showNotification(`Ошибка создания связи`, "error");
        }
        refreshSearchResults();
    };
    
    document.getElementById("editNodeBtn").onclick = openEditModal;
    
    document.getElementById("editNodeForm").onsubmit = async (e) => {
        e.preventDefault();
        await saveNodeEdit();
    };
    
    document.getElementById("deleteNodeBtn").onclick = deleteCurrentNode;
    
    document.getElementById("exportBtn").onclick = exportGraph;
}

function exportGraph() {
    const exportData = {
        metadata: {
            exportDate: new Date().toISOString(),
            totalNodes: allNodes.size,
            totalEdges: allEdges.size,
            visibleNodes: visibleNodes.size,
            currentNode: currentNode
        },
        nodes: Array.from(allNodes.values()).map(n => ({ 
            id: n.id, 
            ru_name: n.ru_name,
            en_name: n.en_name,
            type: n.type,
            x: n.x, 
            y: n.y
        })),
        edges: Array.from(allEdges.values())
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graph_export_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Граф экспортирован в JSON", "success");
}

//EVENT HANDLERS

function setupEventHandlers() {
    document.getElementById("searchBtn").onclick = searchAndExpand;
    document.getElementById("searchInput").onkeypress = e => {
        if (e.key === "Enter") searchAndExpand();
    };
    document.getElementById("resetBtn").onclick = () => resetGraph(false);
    
    const searchNodesInput = document.getElementById("searchNodesInput");
    const searchNodesBtn = document.getElementById("searchNodesBtn");
    
    searchNodesBtn.onclick = searchVisibleNodes;
    searchNodesInput.onkeyup = (e) => {
        if (e.key === "Enter") {
            searchVisibleNodes();
        } else {
            searchVisibleNodes();
        }
    };
    
    document.addEventListener("click", (e) => {
        if (!searchNodesInput.contains(e.target) && !searchNodesBtn.contains(e.target) && !document.getElementById("searchResults").contains(e.target)) {
            document.getElementById("searchResults").style.display = "none";
        }
    });
}

function handleResize() {
    const container = document.getElementById("graph-container");
    svg.attr("width", container.clientWidth).attr("height", container.clientHeight);
    simulation.force("center", d3.forceCenter(container.clientWidth / 2, container.clientHeight / 2));
    simulation.alpha(0.2).restart();
}

//INIT

window.addEventListener("DOMContentLoaded", () => {
    console.log("Graph Explorer — Linguistic Graph");
    
    initSimulation();
    setupEventHandlers();
    setupModals();
    updateStatsPanel();
    
    document.getElementById("searchInput").focus();
    window.addEventListener('resize', handleResize);
    window.jumpToNodeAndHighlight = jumpToNodeAndHighlight;
});
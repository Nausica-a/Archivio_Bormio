function computeCategoryPositions() {
    const mapByKey = new Map();
    images.forEach(d => {
        const raw = String(getLabel(d.meta) || 'Unknown');
        const trimmed = raw.trim().replace(/\s+/g, ' ');
        const key = trimmed.toLowerCase();
        if (!mapByKey.has(key)) mapByKey.set(key, { label: trimmed || 'Unknown', items: [] });
        mapByKey.get(key).items.push(d);
    });

    const spacing = Math.max(12, baseSize * 0.8); // much tighter spacing between photos
    const groupInfos = Array.from(mapByKey.values()).map(g => {
        const list = g.items || [];
        const approxR = spacing * Math.sqrt(Math.max(1, list.length)) * 0.10;
        return { label: g.label, count: list.length, radius: approxR, items: list };
    }).sort((a, b) => b.count - a.count);

    const n = groupInfos.length;
    if (n === 0) { categoryGroups = []; return; }

    categoryGroups = [];
    const golden = 2.399963229728653;
    
    // spiral layout: largest at center, others spiral outward
    groupInfos.forEach((g, idx) => {
        let cx, cy;
        if (idx === 0) {
            // largest cluster at center
            cx = 0;
            cy = 0;
        } else {
            // spiral positioning - more space for central clusters, consistent for outer ones
            const angle = idx * golden * 1;
            // Add extra spacing for early clusters (idx 1-5), then transition to normal
            const baseSpiral = Math.sqrt(idx) * Math.max(220, g.radius * 1.6);
            const centralBoost = idx <= 5 ? (6 - idx) * 40 : 0; // extra space for central clusters
            const spiralRadius = baseSpiral + centralBoost;
            cx = spiralRadius * Math.cos(angle);
            cy = spiralRadius * Math.sin(angle);
        }

        // position items within each cluster
        g.items.forEach((d, j) => {
            const rr = spacing * Math.pow(j, 0.50); // much lower exponent for tighter packing
            const a = j * golden;
            d.catX = cx + rr * Math.cos(a);
            d.catY = cy + rr * Math.sin(a);
        });

        categoryGroups.push({ label: g.label, cx: cx, cy: cy, radius: g.radius });
    });

}

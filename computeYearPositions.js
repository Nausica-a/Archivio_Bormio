function getYearClusterLabel(meta) {
    const raw = meta && meta.year != null ? String(meta.year).trim() : '';
    const match = raw.match(/\d{4}/);
    if (!match) return 'Unknown';

    const year = +match[0];
    if (!Number.isFinite(year)) return 'Unknown';

    if (year === 2024 || year === 2025 || year === 2026) return String(year);

    if (year >= 1850 && year < 1890) return '1850-1890';

    const start = Math.floor(year / 10) * 10;
    const end = start + 10;
    return start + '-' + end;
}

function getYearClusterSortValue(label) {
    if (label === 'Unknown') return Number.POSITIVE_INFINITY;
    const m = String(label).match(/\d{4}/);
    if (!m) return Number.POSITIVE_INFINITY;
    return +m[0];
}

function computeYearPositions() {
    const mapByKey = new Map();
    images.forEach(d => {
        const label = getYearClusterLabel(d.meta);
        const key = label.toLowerCase();
        if (!mapByKey.has(key)) mapByKey.set(key, { label: label, items: [] });
        mapByKey.get(key).items.push(d);
    });

    const spacing = Math.max(12, baseSize * 0.8);
    const groupInfos = Array.from(mapByKey.values()).map(g => {
        const list = g.items || [];
        const approxR = spacing * Math.sqrt(Math.max(1, list.length)) * 0.12;
        return {
            label: g.label,
            count: list.length,
            radius: approxR,
            sortValue: getYearClusterSortValue(g.label),
            items: list
        };
    }).sort((a, b) => {
        if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue;
        return a.label.localeCompare(b.label);
    });

    const n = groupInfos.length;
    if (n === 0) { yearGroups = []; return; }

    yearGroups = [];
    const golden = 2.399963229728653;
    const spiralCenters = [];

    groupInfos.forEach((g, idx) => {
        let cx, cy;
        if (idx === 0) {
            cx = 0;
            cy = 0;
        } else {
            const angle = idx * golden;
            const baseSpiral = Math.sqrt(idx) * Math.max(220, g.radius * 1.5);
            const centralBoost = idx <= 5 ? (6 - idx) * 40 : 0;
            const spiralRadius = baseSpiral + centralBoost;
            cx = spiralRadius * Math.cos(angle);
            cy = spiralRadius * Math.sin(angle);
        }

        spiralCenters.push({ cx: cx, cy: cy });
    });

    const centersTopToBottom = spiralCenters.slice().sort((a, b) => {
        if (a.cy !== b.cy) return a.cy - b.cy;
        return a.cx - b.cx;
    });

    groupInfos.forEach((g, idx) => {
        const center = centersTopToBottom[idx] || { cx: 0, cy: 0 };
        let cx = center.cx;
        let cy = center.cy;

        if (g.label === '2000-2010') {
            cy -= 120;
        }
        if (g.label === '2026') {
            cx -= 120;
        }

        g.items.forEach((d, j) => {
            const rr = spacing * Math.pow(j, 0.50);
            const a = j * golden;
            d.yearX = cx + rr * Math.cos(a);
            d.yearY = cy + rr * Math.sin(a);
        });

        yearGroups.push({ label: g.label, cx: cx, cy: cy, radius: g.radius });
    });
}

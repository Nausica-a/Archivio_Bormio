function animateToLayout(targetMode, duration = 600) {
    if (targetMode === layoutMode) return;
    if (targetMode === 'category') computeCategoryPositions();
    if (targetMode === 'archivio') computeArchivePositions();

    const t0 = performance.now();
    const startPositions = images.map(d => ({ x: d.x, y: d.y }));
    const endPositions = images.map(d => {
        if (targetMode === 'category') return { x: d.catX, y: d.catY };
        if (targetMode === 'archivio') return { x: d.archX, y: d.archY };
        return { x: d.umapX, y: d.umapY };
    });

    function step(now) {
        const t = Math.min(1, (now - t0) / duration);
        const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
        images.forEach((d, i) => {
            d.x = startPositions[i].x + (endPositions[i].x - startPositions[i].x) * ease;
            d.y = startPositions[i].y + (endPositions[i].y - startPositions[i].y) * ease;
        });
        draw();
        if (t < 1) requestAnimationFrame(step);
        else layoutMode = targetMode;
    }
    requestAnimationFrame(step);
}
